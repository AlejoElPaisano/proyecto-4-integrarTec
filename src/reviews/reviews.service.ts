import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransactionStatus } from '../generated/prisma/client';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

const privateReviewSelect = {
  id: true,
  transactionId: true,
  reviewerId: true,
  rating: true,
  comment: true,
  isHidden: true,
  hiddenAt: true,
  hiddenById: true,
  createdAt: true,
  reviewer: {
    select: {
      id: true,
      name: true,
    },
  },
  hiddenBy: {
    select: {
      id: true,
      name: true,
    },
  },
  transaction: {
    select: {
      id: true,
      status: true,
      service: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  },
} as const;

const publicReviewSelect = {
  id: true,
  rating: true,
  comment: true,
  createdAt: true,
  reviewer: {
    select: {
      id: true,
      name: true,
    },
  },
  transaction: {
    select: {
      id: true,
      service: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReviewDto, reviewerId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: dto.transactionId },
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
      transaction.fromUserId === reviewerId || transaction.toUserId === reviewerId;
    if (!isParticipant) {
      throw new ForbiddenException('Solo los participantes pueden crear una reseña');
    }
    if (transaction.fromUserId === transaction.toUserId) {
      throw new BadRequestException('No podés reseñar una transacción con vos mismo');
    }
    if (transaction.status !== TransactionStatus.CONFIRMED) {
      throw new ConflictException('Solo se pueden reseñar transacciones confirmadas');
    }

    const comment = this.normalizeComment(dto.comment);
    try {
      return await this.prisma.review.create({
        data: {
          transactionId: transaction.id,
          reviewerId,
          rating: dto.rating,
          ...(comment === undefined ? {} : { comment }),
        },
        select: privateReviewSelect,
      });
    } catch (error) {
      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException('Ya creaste una reseña para esta transacción');
      }
      throw error;
    }
  }

  findMine(reviewerId: string) {
    return this.prisma.review.findMany({
      where: { reviewerId },
      select: privateReviewSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  findByUser(userId: string) {
    return this.prisma.review.findMany({
      where: {
        isHidden: false,
        OR: [
          {
            transaction: { fromUserId: userId },
            reviewerId: { not: userId },
          },
          {
            transaction: { toUserId: userId },
            reviewerId: { not: userId },
          },
        ],
      },
      select: publicReviewSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async hide(id: number, admin: JwtPayload) {
    try {
      return await this.prisma.review.update({
        where: { id },
        data: {
          isHidden: true,
          hiddenAt: new Date(),
          hiddenById: admin.sub,
        },
        select: privateReviewSelect,
      });
    } catch (error) {
      if (this.isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Reseña no encontrada');
      }
      throw error;
    }
  }

  private normalizeComment(comment: string | undefined): string | null | undefined {
    if (comment === undefined) {
      return undefined;
    }

    const normalized = comment.trim();
    if (normalized.length > 1000) {
      throw new BadRequestException('El comentario no puede superar los 1000 caracteres');
    }
    return normalized || null;
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
    );
  }
}
