import {
  UserSummaryEntity,
  UserSummaryEntityInput,
} from '../../users/entities/user.entity';

export interface TransactionServiceSummaryEntityInput {
  id: number;
  title: string;
  durationMin: number;
}

export class TransactionServiceSummaryEntity {
  id: number;
  title: string;
  durationMin: number;

  private constructor(service: TransactionServiceSummaryEntityInput) {
    this.id = service.id;
    this.title = service.title;
    this.durationMin = service.durationMin;
  }

  static from(
    service: TransactionServiceSummaryEntityInput,
  ): TransactionServiceSummaryEntity {
    return new TransactionServiceSummaryEntity(service);
  }
}

export interface TransactionEntityInput {
  id: number;
  fromUserId: string;
  toUserId: string;
  serviceId: number;
  minutes: number;
  status: string;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  service: TransactionServiceSummaryEntityInput;
  fromUser: UserSummaryEntityInput;
  toUser: UserSummaryEntityInput;
}

export class TransactionEntity {
  id: number;
  fromUserId: string;
  toUserId: string;
  serviceId: number;
  minutes: number;
  status: string;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  service: TransactionServiceSummaryEntity;
  fromUser: UserSummaryEntity;
  toUser: UserSummaryEntity;

  private constructor(transaction: TransactionEntityInput) {
    this.id = transaction.id;
    this.fromUserId = transaction.fromUserId;
    this.toUserId = transaction.toUserId;
    this.serviceId = transaction.serviceId;
    this.minutes = transaction.minutes;
    this.status = transaction.status;
    this.confirmedAt = transaction.confirmedAt;
    this.cancelledAt = transaction.cancelledAt;
    this.createdAt = transaction.createdAt;
    this.updatedAt = transaction.updatedAt;
    this.service = TransactionServiceSummaryEntity.from(transaction.service);
    this.fromUser = UserSummaryEntity.from(transaction.fromUser);
    this.toUser = UserSummaryEntity.from(transaction.toUser);
  }

  static from(transaction: TransactionEntityInput): TransactionEntity {
    return new TransactionEntity(transaction);
  }

  static fromMany(transactions: TransactionEntityInput[]): TransactionEntity[] {
    return transactions.map((transaction) => TransactionEntity.from(transaction));
  }
}

export interface TransactionPageEntityInput {
  items: TransactionEntityInput[];
  page: number;
  pageSize: number;
  total: number;
}

export class TransactionPageEntity {
  items: TransactionEntity[];
  page: number;
  pageSize: number;
  total: number;

  private constructor(page: TransactionPageEntityInput) {
    this.items = TransactionEntity.fromMany(page.items);
    this.page = page.page;
    this.pageSize = page.pageSize;
    this.total = page.total;
  }

  static from(page: TransactionPageEntityInput): TransactionPageEntity {
    return new TransactionPageEntity(page);
  }
}
