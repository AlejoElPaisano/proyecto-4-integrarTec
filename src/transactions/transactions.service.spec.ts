import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, TransactionStatus } from '../generated/prisma/client';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from './transactions.service';

const payerId = 'payer-id';
const earnerId = 'earner-id';
const otherId = 'other-id';
const user: JwtPayload = { sub: payerId, email: 'payer@example.com', role: Role.MEMBER };
const earner: JwtPayload = { sub: earnerId, email: 'earner@example.com', role: Role.MEMBER };
const moderator: JwtPayload = {
  sub: otherId,
  email: 'coordinator@example.com',
  role: Role.COORDINATOR,
};

const serviceRow = {
  id: 7,
  providerId: earnerId,
  durationMin: 45,
};

const transactionRow = {
  id: 12,
  fromUserId: payerId,
  toUserId: earnerId,
  serviceId: serviceRow.id,
  minutes: serviceRow.durationMin,
  status: TransactionStatus.PENDING,
  confirmedAt: null,
  cancelledAt: null,
  createdAt: new Date('2026-03-12T10:00:00Z'),
  updatedAt: new Date('2026-03-12T10:00:00Z'),
  service: { id: 7, title: 'Consultoría', durationMin: 45 },
  fromUser: { id: payerId, name: 'Payer' },
  toUser: { id: earnerId, name: 'Earner' },
};

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('Database error', {
    code,
    clientVersion: '7.0.0',
  });

type MockPrisma = {
  transaction: {
    findMany: jest.Mock;
    count: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    updateMany: jest.Mock;
  };
  service: { findFirst: jest.Mock };
  user: { findUnique: jest.Mock; updateMany: jest.Mock; update: jest.Mock };
  $transaction: jest.Mock;
};

const makePrisma = (): MockPrisma => ({
  transaction: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  service: { findFirst: jest.fn() },
  user: { findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
});

describe('TransactionsService', () => {
  let prisma: MockPrisma;
  let sut: TransactionsService;

  beforeEach(() => {
    prisma = makePrisma();
    sut = new TransactionsService(prisma as unknown as PrismaService);
  });

  it('derives the provider and minutes from an active service on create', async () => {
    prisma.service.findFirst.mockResolvedValue(serviceRow);
    prisma.user.findUnique.mockResolvedValue({
      id: payerId,
      isActive: true,
      balanceMinutes: 60,
    });
    prisma.transaction.create.mockResolvedValue(transactionRow);

    await sut.create({ serviceId: serviceRow.id }, payerId);

    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          fromUserId: payerId,
          toUserId: earnerId,
          serviceId: serviceRow.id,
          minutes: 45,
          status: TransactionStatus.PENDING,
        },
      }),
    );
    expect(prisma.transaction.create.mock.calls[0]?.[0].data).not.toHaveProperty('balanceMinutes');
  });

  it('rejects inactive payer, self-transactions, and insufficient initial balance', async () => {
    prisma.service.findFirst.mockResolvedValue(serviceRow);
    prisma.user.findUnique.mockResolvedValue({ id: payerId, isActive: false, balanceMinutes: 100 });
    await expect(sut.create({ serviceId: 7 }, payerId)).rejects.toEqual(
      new BadRequestException('El usuario debe estar activo'),
    );

    prisma.user.findUnique.mockResolvedValue({ id: payerId, isActive: true, balanceMinutes: 100 });
    prisma.service.findFirst.mockResolvedValue({ ...serviceRow, providerId: payerId });
    await expect(sut.create({ serviceId: 7 }, payerId)).rejects.toEqual(
      new BadRequestException('No podés crear una transacción con vos mismo'),
    );

    prisma.service.findFirst.mockResolvedValue(serviceRow);
    prisma.user.findUnique.mockResolvedValue({ id: payerId, isActive: true, balanceMinutes: 44 });
    await expect(sut.create({ serviceId: 7 }, payerId)).rejects.toEqual(
      new BadRequestException('Saldo insuficiente para crear la transacción'),
    );
  });

  it('paginates mine with a participant-only OR scope and stable ordering', async () => {
    prisma.transaction.findMany.mockResolvedValue([transactionRow]);
    prisma.transaction.count.mockResolvedValue(1);

    await expect(sut.findMine(payerId, { page: 2, pageSize: 10 })).resolves.toEqual({
      items: [transactionRow],
      page: 2,
      pageSize: 10,
      total: 1,
    });
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ fromUserId: payerId }, { toUserId: payerId }] },
        skip: 10,
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('protects detail from unrelated members while allowing moderators and returning 404', async () => {
    prisma.transaction.findUnique.mockResolvedValue(transactionRow);
    await expect(sut.findOne(12, { ...user, sub: otherId })).rejects.toEqual(
      new ForbiddenException('No tenés permiso para ver esta transacción'),
    );

    await expect(sut.findOne(12, moderator)).resolves.toEqual(transactionRow);
    prisma.transaction.findUnique.mockResolvedValue(null);
    await expect(sut.findOne(99, user)).rejects.toEqual(
      new NotFoundException('Transacción no encontrada'),
    );
  });

  it('allows confirmation only for the earner and performs a serializable transfer', async () => {
    const tx = makePrisma();
    tx.transaction.findUnique
      .mockResolvedValueOnce({
        id: 12,
        fromUserId: payerId,
        toUserId: earnerId,
        minutes: 45,
        status: TransactionStatus.PENDING,
      })
      .mockResolvedValueOnce({ ...transactionRow, status: TransactionStatus.CONFIRMED });
    tx.transaction.updateMany.mockResolvedValue({ count: 1 });
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    tx.user.update.mockResolvedValue({ id: earnerId });
    prisma.$transaction.mockImplementation(async (callback: (client: MockPrisma) => unknown) =>
      callback(tx),
    );

    await expect(sut.confirm(12, earner)).resolves.toMatchObject({
      status: TransactionStatus.CONFIRMED,
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    expect(tx.transaction.updateMany).toHaveBeenCalledWith({
      where: {
        id: 12,
        toUserId: earnerId,
        status: TransactionStatus.PENDING,
      },
      data: {
        status: TransactionStatus.CONFIRMED,
        confirmedAt: expect.any(Date),
      },
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: payerId, balanceMinutes: { gte: 45 } },
      data: { balanceMinutes: { decrement: 45 } },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: earnerId },
      data: { balanceMinutes: { increment: 45 } },
    });

    tx.transaction.findUnique.mockResolvedValueOnce({
      id: 12,
      fromUserId: payerId,
      toUserId: earnerId,
      minutes: 45,
      status: TransactionStatus.PENDING,
    });
    await expect(sut.confirm(12, user)).rejects.toEqual(
      new ForbiddenException('Solo quien recibe puede confirmar la transacción'),
    );
  });

  it('rolls back the transfer path when the payer balance is insufficient', async () => {
    const tx = makePrisma();
    tx.transaction.findUnique.mockResolvedValue({
      id: 12,
      fromUserId: payerId,
      toUserId: earnerId,
      minutes: 45,
      status: TransactionStatus.PENDING,
    });
    tx.transaction.updateMany.mockResolvedValue({ count: 1 });
    tx.user.updateMany.mockResolvedValue({ count: 0 });
    prisma.$transaction.mockImplementation(async (callback: (client: MockPrisma) => unknown) =>
      callback(tx),
    );

    await expect(sut.confirm(12, earner)).rejects.toEqual(
      new ConflictException('Saldo insuficiente para confirmar la transacción'),
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('rejects terminal and duplicate transitions and enforces cancel permissions', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 12,
      fromUserId: payerId,
      toUserId: earnerId,
      status: TransactionStatus.CONFIRMED,
    });
    await expect(sut.cancel(12, user)).rejects.toEqual(
      new ConflictException('La transacción ya no está pendiente'),
    );

    prisma.transaction.findUnique.mockResolvedValue({
      id: 12,
      fromUserId: payerId,
      toUserId: earnerId,
      status: TransactionStatus.PENDING,
    });
    await expect(sut.cancel(12, { ...user, sub: otherId })).rejects.toEqual(
      new ForbiddenException('No tenés permiso para cancelar esta transacción'),
    );

    prisma.transaction.findUnique
      .mockResolvedValueOnce({
        id: 12,
        fromUserId: payerId,
        toUserId: earnerId,
        status: TransactionStatus.PENDING,
      })
      .mockResolvedValueOnce({ ...transactionRow, status: TransactionStatus.CANCELLED });
    prisma.transaction.updateMany.mockResolvedValue({ count: 1 });
    await expect(sut.cancel(12, moderator)).resolves.toMatchObject({
      status: TransactionStatus.CANCELLED,
    });
  });

  it('retries P2034 up to three attempts and maps a final P2034 to 409', async () => {
    prisma.$transaction
      .mockRejectedValueOnce(knownError('P2034'))
      .mockImplementationOnce(async (callback: (client: MockPrisma) => unknown) =>
        callback(makePrisma()),
      );
    const retryTx = makePrisma();
    retryTx.transaction.findUnique
      .mockResolvedValueOnce({
        id: 12,
        fromUserId: payerId,
        toUserId: earnerId,
        minutes: 45,
        status: TransactionStatus.PENDING,
      })
      .mockResolvedValueOnce({ ...transactionRow, status: TransactionStatus.CONFIRMED });
    retryTx.transaction.updateMany.mockResolvedValue({ count: 1 });
    retryTx.user.updateMany.mockResolvedValue({ count: 1 });
    retryTx.user.update.mockResolvedValue({ id: earnerId });
    prisma.$transaction.mockReset();
    prisma.$transaction
      .mockRejectedValueOnce(knownError('P2034'))
      .mockImplementationOnce(async (callback: (client: MockPrisma) => unknown) =>
        callback(retryTx),
      );

    await expect(sut.confirm(12, earner)).resolves.toMatchObject({
      status: TransactionStatus.CONFIRMED,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);

    prisma.$transaction.mockRejectedValue(knownError('P2034'));
    await expect(sut.confirm(12, earner)).rejects.toEqual(
      new ConflictException(
        'No se pudo confirmar la transacción por concurrencia; intentá nuevamente',
      ),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(5);
  });
});
