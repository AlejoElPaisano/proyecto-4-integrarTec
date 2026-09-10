import { instanceToPlain } from 'class-transformer';
import { AuthResponseEntity } from '../../auth/entities/auth-response.entity';
import { PrivateReviewEntity } from '../../reviews/entities/private-review.entity';
import { PublicReviewEntity } from '../../reviews/entities/public-review.entity';
import { ServiceEntity } from '../../services/entities/service.entity';
import { TransactionPageEntity } from '../../transactions/entities/transaction-page.entity';
import {
  BalanceGrantResponseEntity,
  UserEntity,
} from './user.entity';

const unsafeUser = {
  id: 'user-1',
  email: 'member@example.com',
  name: 'Member',
  role: 'MEMBER',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  passwordHash: 'credential-hash',
  hashedRefreshToken: 'refresh-hash',
  internalNote: 'must not cross the HTTP boundary',
};

describe('response serialization entities', () => {
  it('excludes credentials from a direct user response', () => {
    const entity = UserEntity.from(unsafeUser);

    expect(entity).toBeInstanceOf(UserEntity);
    expect(instanceToPlain(entity)).toEqual({
      id: unsafeUser.id,
      email: unsafeUser.email,
      name: unsafeUser.name,
      role: unsafeUser.role,
      createdAt: unsafeUser.createdAt,
    });
  });

  it('excludes credentials from an authentication envelope', () => {
    const entity = AuthResponseEntity.from({
      user: unsafeUser,
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });

    expect(instanceToPlain(entity)).toEqual({
      user: {
        id: unsafeUser.id,
        email: unsafeUser.email,
        name: unsafeUser.name,
        role: unsafeUser.role,
        createdAt: unsafeUser.createdAt,
      },
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
  });

  it('maps nested service data and arrays to response entities', () => {
    const unsafeService = {
      id: 1,
      title: 'Gardening',
      description: 'Garden maintenance',
      durationMin: 60,
      isActive: true,
      providerId: unsafeUser.id,
      categoryId: 5,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-03T00:00:00.000Z'),
      provider: unsafeUser,
      category: { id: 5, name: 'Home', internalCode: 'home' },
    };
    const entities = ServiceEntity.fromMany([unsafeService]);

    expect(entities[0]).toBeInstanceOf(ServiceEntity);
    expect(instanceToPlain(entities)).toEqual([
      {
        id: 1,
        title: 'Gardening',
        description: 'Garden maintenance',
        durationMin: 60,
        isActive: true,
        providerId: unsafeUser.id,
        categoryId: 5,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedAt: new Date('2026-01-03T00:00:00.000Z'),
        provider: { id: unsafeUser.id, name: unsafeUser.name },
        category: { id: 5, name: 'Home' },
      },
    ]);
  });

  it('maps transaction pagination wrappers and nested summaries', () => {
    const unsafeTransaction = {
      id: 10,
      fromUserId: 'user-1',
      toUserId: 'user-2',
      serviceId: 1,
      minutes: 60,
      status: 'PENDING',
      confirmedAt: null,
      cancelledAt: null,
      createdAt: new Date('2026-01-04T00:00:00.000Z'),
      updatedAt: new Date('2026-01-04T00:00:00.000Z'),
      service: { id: 1, title: 'Gardening', durationMin: 60, private: true },
      fromUser: unsafeUser,
      toUser: { ...unsafeUser, id: 'user-2', name: 'Provider' },
    };
    const entity = TransactionPageEntity.from({
      items: [unsafeTransaction],
      page: 1,
      pageSize: 20,
      total: 1,
    });

    expect(instanceToPlain(entity)).toEqual({
      items: [
        {
          id: 10,
          fromUserId: 'user-1',
          toUserId: 'user-2',
          serviceId: 1,
          minutes: 60,
          status: 'PENDING',
          confirmedAt: null,
          cancelledAt: null,
          createdAt: new Date('2026-01-04T00:00:00.000Z'),
          updatedAt: new Date('2026-01-04T00:00:00.000Z'),
          service: { id: 1, title: 'Gardening', durationMin: 60 },
          fromUser: { id: unsafeUser.id, name: unsafeUser.name },
          toUser: { id: 'user-2', name: 'Provider' },
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    });
  });

  it('maps balance-grant composite responses without credentials', () => {
    const unsafeGrant = {
      id: 3,
      issuerId: 'admin-1',
      recipientId: unsafeUser.id,
      amount: 60,
      reason: 'Community contribution',
      createdAt: new Date('2026-01-05T00:00:00.000Z'),
      internalAudit: 'private',
    };
    const entity = BalanceGrantResponseEntity.from({
      user: { ...unsafeUser, balanceMinutes: 120, isActive: true },
      grant: unsafeGrant,
    });

    expect(instanceToPlain(entity)).toEqual({
      user: {
        id: unsafeUser.id,
        email: unsafeUser.email,
        name: unsafeUser.name,
        role: unsafeUser.role,
        createdAt: unsafeUser.createdAt,
        balanceMinutes: 120,
        isActive: true,
      },
      grant: {
        id: 3,
        issuerId: 'admin-1',
        recipientId: unsafeUser.id,
        amount: 60,
        reason: 'Community contribution',
        createdAt: new Date('2026-01-05T00:00:00.000Z'),
      },
    });
  });

  it('keeps public and private review visibility distinct', () => {
    const review = {
      id: 7,
      transactionId: 10,
      reviewerId: unsafeUser.id,
      rating: 5,
      comment: 'Excellent',
      isHidden: true,
      hiddenAt: new Date('2026-01-06T00:00:00.000Z'),
      hiddenById: 'admin-1',
      createdAt: new Date('2026-01-05T00:00:00.000Z'),
      reviewer: unsafeUser,
      hiddenBy: { id: 'admin-1', name: 'Admin', passwordHash: 'never-return' },
      transaction: {
        id: 10,
        status: 'CONFIRMED',
        service: { id: 1, title: 'Gardening', private: true },
      },
    };

    expect(instanceToPlain(PublicReviewEntity.from(review))).toEqual({
      id: 7,
      rating: 5,
      comment: 'Excellent',
      createdAt: new Date('2026-01-05T00:00:00.000Z'),
      reviewer: { id: unsafeUser.id, name: unsafeUser.name },
      transaction: { id: 10, service: { id: 1, title: 'Gardening' } },
    });
    expect(instanceToPlain(PrivateReviewEntity.from(review))).toEqual({
      id: 7,
      transactionId: 10,
      reviewerId: unsafeUser.id,
      rating: 5,
      comment: 'Excellent',
      isHidden: true,
      hiddenAt: new Date('2026-01-06T00:00:00.000Z'),
      hiddenById: 'admin-1',
      createdAt: new Date('2026-01-05T00:00:00.000Z'),
      reviewer: { id: unsafeUser.id, name: unsafeUser.name },
      hiddenBy: { id: 'admin-1', name: 'Admin' },
      transaction: {
        id: 10,
        status: 'CONFIRMED',
        service: { id: 1, title: 'Gardening' },
      },
    });
  });
});
