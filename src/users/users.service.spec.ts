import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BalanceGrantDto } from './dto/balance-grant.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UsersService } from './users.service';

describe('UsersService admin operations', () => {
  const user = {
    id: 'recipient-id',
    email: 'recipient@example.com',
    name: 'Recipient',
    role: 'MEMBER',
    balanceMinutes: 90,
    isActive: true,
    createdAt: new Date(),
  };
  const prisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    service: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists only safe administrative user fields', async () => {
    jest.mocked(prisma.user.findMany).mockResolvedValue([user] as never);
    const service = new UsersService(prisma);

    await expect(service.findAll()).resolves.toEqual([user]);

    const [args] = jest.mocked(prisma.user.findMany).mock.calls[0] ?? [];
    if (!args) {
      throw new Error('Expected findMany to be called');
    }
    expect(args).toMatchObject({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        balanceMinutes: true,
        isActive: true,
        createdAt: true,
      },
    });
    expect(args.select).not.toHaveProperty('passwordHash');
    expect(args.select).not.toHaveProperty('hashedRefreshToken');
  });

  it('updates a target user role with a safe select', async () => {
    jest.mocked(prisma.user.update).mockResolvedValue({ ...user, role: Role.COORDINATOR } as never);
    const service = new UsersService(prisma);
    const dto: UpdateRoleDto = { role: Role.COORDINATOR };

    await service.updateRole('recipient-id', dto);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'recipient-id' },
        data: { role: Role.COORDINATOR },
      }),
    );
  });

  it('prevents an administrator from deactivating themself', async () => {
    const service = new UsersService(prisma);

    await expect(
      service.updateStatus('admin-id', 'admin-id', { isActive: false }),
    ).rejects.toEqual(new BadRequestException('No podés desactivarte a vos mismo'));
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('hides provider services and clears the refresh token atomically on deactivation', async () => {
    const transaction = {
      user: { update: jest.fn() },
      service: { updateMany: jest.fn() },
    };
    jest.mocked(transaction.user.update).mockResolvedValue({ ...user, isActive: false } as never);
    jest.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback(transaction as never),
    );
    const service = new UsersService(prisma);

    await service.updateStatus('recipient-id', 'admin-id', { isActive: false });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'recipient-id' },
        data: { isActive: false, hashedRefreshToken: null },
      }),
    );
    expect(transaction.service.updateMany).toHaveBeenCalledWith({
      where: { providerId: 'recipient-id' },
      data: { isActive: false },
    });
  });

  it('reactivates a user without reactivating hidden services', async () => {
    jest.mocked(prisma.user.update).mockResolvedValue({ ...user, isActive: true } as never);
    const service = new UsersService(prisma);

    await service.updateStatus('recipient-id', 'admin-id', { isActive: true });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'recipient-id' },
        data: { isActive: true },
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.service.updateMany).not.toHaveBeenCalled();
  });

  it('rejects balance grants to an inactive recipient', async () => {
    const transaction = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      balanceGrant: { create: jest.fn() },
    };
    jest.mocked(transaction.user.findUnique).mockResolvedValue({
      id: 'recipient-id',
      isActive: false,
    } as never);
    jest.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback(transaction as never),
    );
    const service = new UsersService(prisma);

    await expect(
      service.grantBalance('recipient-id', 'admin-id', {
        amount: 30,
        reason: 'Community support',
      }),
    ).rejects.toEqual(
      new BadRequestException('No se puede otorgar saldo a un usuario inactivo'),
    );
    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(transaction.balanceGrant.create).not.toHaveBeenCalled();
  });

  it('rejects grants when the recipient does not exist', async () => {
    const transaction = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      balanceGrant: { create: jest.fn() },
    };
    jest.mocked(transaction.user.findUnique).mockResolvedValue(null);
    jest.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback(transaction as never),
    );
    const service = new UsersService(prisma);

    await expect(
      service.grantBalance('missing-id', 'admin-id', {
        amount: 30,
        reason: 'Community support',
      }),
    ).rejects.toEqual(new NotFoundException('Usuario no encontrado'));
  });

  it('increments balance and records the grant in one transaction', async () => {
    const transaction = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      balanceGrant: { create: jest.fn() },
    };
    jest.mocked(transaction.user.findUnique).mockResolvedValue({
      id: 'recipient-id',
      isActive: true,
    } as never);
    jest.mocked(transaction.user.update).mockResolvedValue(user as never);
    const grant = {
      id: 'grant-id',
      issuerId: 'admin-id',
      recipientId: 'recipient-id',
      amount: 30,
      reason: 'Community support',
      createdAt: new Date(),
    };
    jest.mocked(transaction.balanceGrant.create).mockResolvedValue(grant);
    jest.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback(transaction as never),
    );
    const service = new UsersService(prisma);
    const dto: BalanceGrantDto = {
      amount: 30,
      reason: '  Community support  ',
    };

    await expect(
      service.grantBalance('recipient-id', 'admin-id', dto),
    ).resolves.toEqual({ user, grant });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'recipient-id' },
        data: { balanceMinutes: { increment: 30 } },
      }),
    );
    expect(transaction.balanceGrant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          issuerId: 'admin-id',
          recipientId: 'recipient-id',
          amount: 30,
          reason: 'Community support',
        },
      }),
    );
  });
});
