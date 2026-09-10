import { Exclude } from 'class-transformer';

export interface ReviewUserSummaryEntityInput {
  id: string;
  name: string;
}

export class ReviewUserSummaryEntity {
  id: string;
  name: string;

  @Exclude()
  passwordHash?: string;

  @Exclude()
  hashedRefreshToken?: string | null;

  private constructor(user: ReviewUserSummaryEntityInput) {
    this.id = user.id;
    this.name = user.name;
  }

  static from(user: ReviewUserSummaryEntityInput): ReviewUserSummaryEntity {
    return new ReviewUserSummaryEntity(user);
  }
}

export interface ReviewServiceSummaryEntityInput {
  id: number;
  title: string;
}

export class ReviewServiceSummaryEntity {
  id: number;
  title: string;

  private constructor(service: ReviewServiceSummaryEntityInput) {
    this.id = service.id;
    this.title = service.title;
  }

  static from(
    service: ReviewServiceSummaryEntityInput,
  ): ReviewServiceSummaryEntity {
    return new ReviewServiceSummaryEntity(service);
  }
}

export interface PublicReviewTransactionEntityInput {
  id: number;
  service: ReviewServiceSummaryEntityInput;
}

export class PublicReviewTransactionEntity {
  id: number;
  service: ReviewServiceSummaryEntity;

  private constructor(transaction: PublicReviewTransactionEntityInput) {
    this.id = transaction.id;
    this.service = ReviewServiceSummaryEntity.from(transaction.service);
  }

  static from(
    transaction: PublicReviewTransactionEntityInput,
  ): PublicReviewTransactionEntity {
    return new PublicReviewTransactionEntity(transaction);
  }
}

export interface PublicReviewEntityInput {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: Date;
  reviewer: ReviewUserSummaryEntityInput;
  transaction: PublicReviewTransactionEntityInput;
}

export class PublicReviewEntity {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: Date;
  reviewer: ReviewUserSummaryEntity;
  transaction: PublicReviewTransactionEntity;

  private constructor(review: PublicReviewEntityInput) {
    this.id = review.id;
    this.rating = review.rating;
    this.comment = review.comment;
    this.createdAt = review.createdAt;
    this.reviewer = ReviewUserSummaryEntity.from(review.reviewer);
    this.transaction = PublicReviewTransactionEntity.from(review.transaction);
  }

  static from(review: PublicReviewEntityInput): PublicReviewEntity {
    return new PublicReviewEntity(review);
  }

  static fromMany(reviews: PublicReviewEntityInput[]): PublicReviewEntity[] {
    return reviews.map((review) => PublicReviewEntity.from(review));
  }
}
