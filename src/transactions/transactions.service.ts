import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, TransactionStatus } from '../generated/prisma/client';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FindTransactionsQueryDto } from './dto/find-transactions-query.dto';

const MAX_RETRIES = 3;

const safeTransactionSelect = {
  id: true,
  fromUserId: true,
  toUserId: true,
  serviceId: true,
  minutes: true,
  status: true,
  confirmedAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  service: {
    select: {
      id: true,
      title: true,
      durationMin: true,
    },
  },
  fromUser: {
    select: {
      id: true,
      name: true,
    },
  },
  toUser: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

type TransactionClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(userId: string, query: FindTransactionsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.TransactionWhereInput = {
      OR: [{ fromUserId: userId }, { toUserId: userId }],
    };

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        select: safeTransactionSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async findOne(id: number, user: JwtPayload) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      select: safeTransactionSelect,
    });

    if (!transaction) {
      throw new NotFoundException('Transacción no encontrada');
    }

    if (!this.canAccess(transaction.fromUserId, transaction.toUserId, user)) {
      throw new ForbiddenException('No tenés permiso para ver esta transacción');
    }

    return transaction;
  }

  async create(dto: CreateTransactionDto, payerId: string) {
    const [service, payer] = await Promise.all([
      this.prisma.service.findFirst({
        where: {
          id: dto.serviceId,
          isActive: true,
          provider: { isActive: true },
        },
        select: {
          id: true,
          providerId: true,
          durationMin: true,
        },
      }),
      this.prisma.user.findUnique({
        where: { id: payerId },
        select: {
          id: true,
          isActive: true,
          balanceMinutes: true,
        },
      }),
    ]);

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }
    if (!payer) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (!payer.isActive) {
      throw new BadRequestException('El usuario debe estar activo');
    }
    if (service.providerId === payerId) {
      throw new BadRequestException('No podés crear una transacción con vos mismo');
    }
    if (payer.balanceMinutes < service.durationMin) {
      throw new BadRequestException('Saldo insuficiente para crear la transacción');
    }

    return this.prisma.transaction.create({
      data: {
        fromUserId: payerId,
        toUserId: service.providerId,
        serviceId: service.id,
        minutes: service.durationMin,
        status: TransactionStatus.PENDING,
      },
      select: safeTransactionSelect,
    });
  }

  async confirm(id: number, user: JwtPayload) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => this.confirmInTransaction(tx, id, user),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (!this.isPrismaError(error, 'P2034')) {
          throw error;
        }
        if (attempt === MAX_RETRIES) {
          throw new ConflictException(
            'No se pudo confirmar la transacción por concurrencia; intentá nuevamente',
          );
        }
      }
    }

    throw new ConflictException(
      'No se pudo confirmar la transacción por concurrencia; intentá nuevamente',
    );
  }

  async cancel(id: number, user: JwtPayload) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        status: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transacción no encontrada');
    }

    const isParticipant =
      transaction.fromUserId === user.sub || transaction.toUserId === user.sub;
    const isModerator = this.isModerator(user);
    if (!isParticipant && !isModerator) {
      throw new ForbiddenException('No tenés permiso para cancelar esta transacción');
    }
    if (transaction.status !== TransactionStatus.PENDING) {
      throw new ConflictException('La transacción ya no está pendiente');
    }

    const result = await this.prisma.transaction.updateMany({
      where: { id, status: TransactionStatus.PENDING },
      data: {
        status: TransactionStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    if (result.count !== 1) {
      throw new ConflictException('La transacción ya no está pendiente');
    }

    const cancelled = await this.prisma.transaction.findUnique({
      where: { id },
      select: safeTransactionSelect,
    });
    if (!cancelled) {
      throw new NotFoundException('Transacción no encontrada');
    }
    return cancelled;
  }

  private async confirmInTransaction(
    tx: TransactionClient,
    id: number,
    user: JwtPayload,
  ) {
    const transaction = await tx.transaction.findUnique({
      where: { id },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        minutes: true,
        status: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transacción no encontrada');
    }
    if (transaction.toUserId !== user.sub) {
      throw new ForbiddenException('Solo quien recibe puede confirmar la transacción');
    }
    if (transaction.status !== TransactionStatus.PENDING) {
      throw new ConflictException('La transacción ya no está pendiente');
    }

    const confirmedAt = new Date();
    const transactionUpdate = await tx.transaction.updateMany({
      where: {
        id,
        toUserId: user.sub,
        status: TransactionStatus.PENDING,
      },
      data: {
        status: TransactionStatus.CONFIRMED,
        confirmedAt,
      },
    });
    if (transactionUpdate.count !== 1) {
      throw new ConflictException('La transacción ya no está pendiente');
    }

    const payerUpdate = await tx.user.updateMany({
      where: {
        id: transaction.fromUserId,
        balanceMinutes: { gte: transaction.minutes },
      },
      data: { balanceMinutes: { decrement: transaction.minutes } },
    });
    if (payerUpdate.count !== 1) {
      throw new ConflictException('Saldo insuficiente para confirmar la transacción');
    }

    await tx.user.update({
      where: { id: transaction.toUserId },
      data: { balanceMinutes: { increment: transaction.minutes } },
    });

    const confirmed = await tx.transaction.findUnique({
      where: { id },
      select: safeTransactionSelect,
    });
    if (!confirmed) {
      throw new NotFoundException('Transacción no encontrada');
    }
    return confirmed;
  }

  private canAccess(fromUserId: string, toUserId: string, user: JwtPayload): boolean {
    return (
      fromUserId === user.sub ||
      toUserId === user.sub ||
      this.isModerator(user)
    );
  }

  private isModerator(user: JwtPayload): boolean {
    return user.role === Role.COORDINATOR || user.role === Role.ADMIN;
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
    );
  }
}
