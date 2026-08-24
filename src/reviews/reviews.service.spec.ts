import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, TransactionStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewsService } from './reviews.service';

const payerId = '11111111-1111-4111-8111-111111111111';
const earnerId = '22222222-2222-4222-8222-222222222222';
const otherId = '33333333-3333-4333-8333-333333333333';
const adminId = '44444444-4444-4444-8444-444444444444';

const confirmedTransaction = {
  id: 12,
  fromUserId: payerId,
  toUserId: earnerId,
  status: TransactionStatus.CONFIRMED,
};

const privateReview = {
  id: 21,
  transactionId: 12,
  reviewerId: payerId,
  rating: 5,
  comment: 'Excelente',
  isHidden: false,
  hiddenAt: null,
  hiddenById: null,
  createdAt: new Date('2026-03-13T10:00:00Z'),
  reviewer: { id: payerId, name: 'Payer' },
  hiddenBy: null,
  transaction: {
    id: 12,
    status: TransactionStatus.CONFIRMED,
    service: { id: 7, title: 'Consultoría' },
  },
};

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('Database error', {
    code,
    clientVersion: '7.0.0',
  });

type MockPrisma = {
  transaction: { findUnique: jest.Mock };
  review: { create: jest.Mock; findMany: jest.Mock; update: jest.Mock };
};

const makePrisma = (): MockPrisma => ({
  transaction: { findUnique: jest.fn() },
  review: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
});

describe('ReviewsService', () => {
  let prisma: MockPrisma;
  let sut: ReviewsService;

  beforeEach(() => {
    prisma = makePrisma();
    sut = new ReviewsService(prisma as unknown as PrismaService);
  });

  it('creates a review for a confirmed payer', async () => {
    prisma.transaction.findUnique.mockResolvedValue(confirmedTransaction);
    prisma.review.create.mockResolvedValue(privateReview);

    await expect(
      sut.create({ transactionId: 12, rating: 5, comment: '  Excelente  ' }, payerId),
    ).resolves.toEqual(privateReview);

    expect(prisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          transactionId: 12,
          reviewerId: payerId,
          rating: 5,
          comment: 'Excelente',
        },
      }),
    );
  });

  it('stores a whitespace-only comment as null', async () => {
    prisma.transaction.findUnique.mockResolvedValue(confirmedTransaction);
    prisma.review.create.mockResolvedValue(privateReview);

    await sut.create({ transactionId: 12, rating: 5, comment: '   ' }, payerId);

    expect(prisma.review.create.mock.calls[0]?.[0].data).toEqual({
      transactionId: 12,
      reviewerId: payerId,
      rating: 5,
      comment: null,
    });
  });

  it('creates a review for a confirmed earner', async () => {
    prisma.transaction.findUnique.mockResolvedValue(confirmedTransaction);
    prisma.review.create.mockResolvedValue({ ...privateReview, reviewerId: earnerId });

    await sut.create({ transactionId: 12, rating: 4 }, earnerId);

    expect(prisma.review.create.mock.calls[0]?.[0].data).toEqual({
      transactionId: 12,
      reviewerId: earnerId,
      rating: 4,
    });
  });

  it.each([TransactionStatus.PENDING, TransactionStatus.CANCELLED])(
    'rejects %s transactions',
    async (status) => {
      prisma.transaction.findUnique.mockResolvedValue({ ...confirmedTransaction, status });

      await expect(sut.create({ transactionId: 12, rating: 5 }, payerId)).rejects.toEqual(
        new ConflictException('Solo se pueden reseñar transacciones confirmadas'),
      );
      expect(prisma.review.create).not.toHaveBeenCalled();
    },
  );

  it('rejects an unrelated member with 403', async () => {
    prisma.transaction.findUnique.mockResolvedValue(confirmedTransaction);

    await expect(sut.create({ transactionId: 12, rating: 5 }, otherId)).rejects.toEqual(
      new ForbiddenException('Solo los participantes pueden crear una reseña'),
    );
  });

  it('defends against self-review transactions', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      ...confirmedTransaction,
      fromUserId: payerId,
      toUserId: payerId,
    });

    await expect(sut.create({ transactionId: 12, rating: 5 }, payerId)).rejects.toEqual(
      new BadRequestException('No podés reseñar una transacción con vos mismo'),
    );
  });

  it('maps the database duplicate constraint to 409', async () => {
    prisma.transaction.findUnique.mockResolvedValue(confirmedTransaction);
    prisma.review.create.mockRejectedValue(knownError('P2002'));

    await expect(sut.create({ transactionId: 12, rating: 5 }, payerId)).rejects.toEqual(
      new ConflictException('Ya creaste una reseña para esta transacción'),
    );
  });

  it('scopes mine to the JWT reviewer and includes private history', async () => {
    prisma.review.findMany.mockResolvedValue([privateReview]);

    await expect(sut.findMine(payerId)).resolves.toEqual([privateReview]);
    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reviewerId: payerId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('uses both transaction directions and excludes hidden or self-authored public reviews', async () => {
    prisma.review.findMany.mockResolvedValue([privateReview]);

    await expect(sut.findByUser(payerId)).resolves.toEqual([privateReview]);
    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isHidden: false,
          OR: [
            { transaction: { fromUserId: payerId }, reviewerId: { not: payerId } },
            { transaction: { toUserId: payerId }, reviewerId: { not: payerId } },
          ],
        },
      }),
    );
  });

  it('hides a review by preserving it and recording moderation metadata', async () => {
    const hiddenAt = new Date('2026-03-13T12:00:00Z');
    jest.useFakeTimers().setSystemTime(hiddenAt);
    prisma.review.update.mockResolvedValue({
      ...privateReview,
      isHidden: true,
      hiddenAt,
      hiddenById: adminId,
    });

    await expect(
      sut.hide(21, { sub: adminId, email: 'admin@example.com', role: Role.ADMIN }),
    ).resolves.toMatchObject({ isHidden: true, hiddenById: adminId, hiddenAt });
    expect(prisma.review.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 21 },
        data: { isHidden: true, hiddenAt, hiddenById: adminId },
      }),
    );
    jest.useRealTimers();
  });

  it('maps a missing review during hide to 404', async () => {
    prisma.review.update.mockRejectedValue(knownError('P2025'));

    await expect(
      sut.hide(99, { sub: adminId, email: 'admin@example.com', role: Role.ADMIN }),
    ).rejects.toEqual(new NotFoundException('Reseña no encontrada'));
  });
});
