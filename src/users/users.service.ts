import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BalanceGrantDto } from './dto/balance-grant.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} as const;

const profileUserSelect = {
  ...safeUserSelect,
  balanceMinutes: true,
} as const;

const adminUserSelect = {
  ...profileUserSelect,
  isActive: true,
} as const;

const balanceGrantSelect = {
  id: true,
  issuerId: true,
  recipientId: true,
  amount: true,
  reason: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async create(email: string, name: string, passwordHash: string) {
    try {
      return await this.prisma.user.create({
        data: {
          email: this.normalizeEmail(email),
          name: name.trim(),
          passwordHash,
        },
        select: safeUserSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('El email ya está registrado');
      }
      throw error;
    }
  }

  async findByEmailForAuth(email: string) {
    return this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
      select: {
        ...safeUserSelect,
        passwordHash: true,
        isActive: true,
      },
    });
  }

  async findByIdForAccess(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        ...safeUserSelect,
        isActive: true,
      },
    });
  }

  async findByIdWithRefreshToken(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        ...safeUserSelect,
        isActive: true,
        hashedRefreshToken: true,
      },
    });
  }

  async updateRefreshToken(userId: string, hashedRefreshToken: string | null): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken },
    });
  }

  async findProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: profileUserSelect,
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  async findPublicProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: adminUserSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateProfile(id: string, dto: UpdateUserDto) {
    const data = dto.name === undefined ? {} : { name: dto.name.trim() };
    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: profileUserSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Usuario no encontrado');
      }
      throw error;
    }
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: { role: dto.role },
        select: adminUserSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Usuario no encontrado');
      }
      throw error;
    }
  }

  async updateStatus(id: string, issuerId: string, dto: UpdateStatusDto) {
    if (!dto.isActive && id === issuerId) {
      throw new BadRequestException('No podés desactivarte a vos mismo');
    }

    try {
      if (dto.isActive) {
        return await this.prisma.user.update({
          where: { id },
          data: { isActive: true },
          select: adminUserSelect,
        });
      }

      return await this.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id },
          data: { isActive: false, hashedRefreshToken: null },
          select: adminUserSelect,
        });
        await tx.service.updateMany({
          where: { providerId: id },
          data: { isActive: false },
        });
        return updatedUser;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Usuario no encontrado');
      }
      throw error;
    }
  }

  async grantBalance(
    recipientId: string,
    issuerId: string,
    dto: BalanceGrantDto,
  ) {
    if (recipientId === issuerId) {
      throw new BadRequestException('No podés otorgarte saldo a vos mismo');
    }

    const reason = dto.reason.trim();
    if (!reason) {
      throw new BadRequestException('El motivo no puede estar vacío');
    }

    return this.prisma.$transaction(async (tx) => {
      const recipient = await tx.user.findUnique({
        where: { id: recipientId },
        select: { id: true, isActive: true },
      });

      if (!recipient) {
        throw new NotFoundException('Usuario no encontrado');
      }
      if (!recipient.isActive) {
        throw new BadRequestException(
          'No se puede otorgar saldo a un usuario inactivo',
        );
      }

      const updatedUser = await tx.user.update({
        where: { id: recipientId },
        data: { balanceMinutes: { increment: dto.amount } },
        select: adminUserSelect,
      });

      const grant = await tx.balanceGrant.create({
        data: {
          issuerId,
          recipientId,
          amount: dto.amount,
          reason,
        },
        select: balanceGrantSelect,
      });

      return { user: updatedUser, grant };
    });
  }
}
