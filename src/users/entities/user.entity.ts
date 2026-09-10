import { Exclude } from 'class-transformer';

export interface UserEntityInput {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
}

export class UserEntity {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;

  @Exclude()
  passwordHash?: string;

  @Exclude()
  hashedRefreshToken?: string | null;

  protected constructor(user: UserEntityInput) {
    this.id = user.id;
    this.email = user.email;
    this.name = user.name;
    this.role = user.role;
    this.createdAt = user.createdAt;
  }

  static from(user: UserEntityInput): UserEntity {
    return new UserEntity(user);
  }

  static fromMany(users: UserEntityInput[]): UserEntity[] {
    return users.map((user) => UserEntity.from(user));
  }
}

export interface UserProfileEntityInput extends UserEntityInput {
  balanceMinutes: number;
}

export class UserProfileEntity extends UserEntity {
  balanceMinutes: number;

  protected constructor(user: UserProfileEntityInput) {
    super(user);
    this.balanceMinutes = user.balanceMinutes;
  }

  static override from(user: UserProfileEntityInput): UserProfileEntity {
    return new UserProfileEntity(user);
  }
}

export interface AdminUserEntityInput extends UserProfileEntityInput {
  isActive: boolean;
}

export class AdminUserEntity extends UserProfileEntity {
  isActive: boolean;

  private constructor(user: AdminUserEntityInput) {
    super(user);
    this.isActive = user.isActive;
  }

  static override from(user: AdminUserEntityInput): AdminUserEntity {
    return new AdminUserEntity(user);
  }

  static override fromMany(users: AdminUserEntityInput[]): AdminUserEntity[] {
    return users.map((user) => AdminUserEntity.from(user));
  }
}

export interface UserSummaryEntityInput {
  id: string;
  name: string;
}

export class UserSummaryEntity {
  id: string;
  name: string;

  @Exclude()
  passwordHash?: string;

  @Exclude()
  hashedRefreshToken?: string | null;

  private constructor(user: UserSummaryEntityInput) {
    this.id = user.id;
    this.name = user.name;
  }

  static from(user: UserSummaryEntityInput): UserSummaryEntity {
    return new UserSummaryEntity(user);
  }
}

export interface BalanceGrantEntityInput {
  id: number;
  issuerId: string;
  recipientId: string;
  amount: number;
  reason: string;
  createdAt: Date;
}

export class BalanceGrantEntity {
  id: number;
  issuerId: string;
  recipientId: string;
  amount: number;
  reason: string;
  createdAt: Date;

  private constructor(grant: BalanceGrantEntityInput) {
    this.id = grant.id;
    this.issuerId = grant.issuerId;
    this.recipientId = grant.recipientId;
    this.amount = grant.amount;
    this.reason = grant.reason;
    this.createdAt = grant.createdAt;
  }

  static from(grant: BalanceGrantEntityInput): BalanceGrantEntity {
    return new BalanceGrantEntity(grant);
  }
}

export interface BalanceGrantResponseEntityInput {
  user: AdminUserEntityInput;
  grant: BalanceGrantEntityInput;
}

export class BalanceGrantResponseEntity {
  user: AdminUserEntity;
  grant: BalanceGrantEntity;

  private constructor(response: BalanceGrantResponseEntityInput) {
    this.user = AdminUserEntity.from(response.user);
    this.grant = BalanceGrantEntity.from(response.grant);
  }

  static from(response: BalanceGrantResponseEntityInput): BalanceGrantResponseEntity {
    return new BalanceGrantResponseEntity(response);
  }
}
