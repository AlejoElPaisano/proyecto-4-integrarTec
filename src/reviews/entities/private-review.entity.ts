import {
  ReviewServiceSummaryEntity,
  ReviewServiceSummaryEntityInput,
  ReviewUserSummaryEntity,
  ReviewUserSummaryEntityInput,
} from './public-review.entity';

export interface PrivateReviewTransactionEntityInput {
  id: number;
  status: string;
  service: ReviewServiceSummaryEntityInput;
}

export class PrivateReviewTransactionEntity {
  id: number;
  status: string;
  service: ReviewServiceSummaryEntity;

  private constructor(transaction: PrivateReviewTransactionEntityInput) {
    this.id = transaction.id;
    this.status = transaction.status;
    this.service = ReviewServiceSummaryEntity.from(transaction.service);
  }

  static from(
    transaction: PrivateReviewTransactionEntityInput,
  ): PrivateReviewTransactionEntity {
    return new PrivateReviewTransactionEntity(transaction);
  }
}

export interface PrivateReviewEntityInput {
  id: number;
  transactionId: number;
  reviewerId: string;
  rating: number;
  comment: string | null;
  isHidden: boolean;
  hiddenAt: Date | null;
  hiddenById: string | null;
  createdAt: Date;
  reviewer: ReviewUserSummaryEntityInput;
  hiddenBy: ReviewUserSummaryEntityInput | null;
  transaction: PrivateReviewTransactionEntityInput;
}

export class PrivateReviewEntity {
  id: number;
  transactionId: number;
  reviewerId: string;
  rating: number;
  comment: string | null;
  isHidden: boolean;
  hiddenAt: Date | null;
  hiddenById: string | null;
  createdAt: Date;
  reviewer: ReviewUserSummaryEntity;
  hiddenBy: ReviewUserSummaryEntity | null;
  transaction: PrivateReviewTransactionEntity;

  private constructor(review: PrivateReviewEntityInput) {
    this.id = review.id;
    this.transactionId = review.transactionId;
    this.reviewerId = review.reviewerId;
    this.rating = review.rating;
    this.comment = review.comment;
    this.isHidden = review.isHidden;
    this.hiddenAt = review.hiddenAt;
    this.hiddenById = review.hiddenById;
    this.createdAt = review.createdAt;
    this.reviewer = ReviewUserSummaryEntity.from(review.reviewer);
    this.hiddenBy = review.hiddenBy
      ? ReviewUserSummaryEntity.from(review.hiddenBy)
      : null;
    this.transaction = PrivateReviewTransactionEntity.from(review.transaction);
  }

  static from(review: PrivateReviewEntityInput): PrivateReviewEntity {
    return new PrivateReviewEntity(review);
  }

  static fromMany(reviews: PrivateReviewEntityInput[]): PrivateReviewEntity[] {
    return reviews.map((review) => PrivateReviewEntity.from(review));
  }
}
