import {
  CategoryEntity,
  CategoryEntityInput,
} from '../../categories/entities/category.entity';
import {
  UserSummaryEntity,
  UserSummaryEntityInput,
} from '../../users/entities/user.entity';

export interface ServiceEntityInput {
  id: number;
  title: string;
  description: string;
  durationMin: number;
  isActive: boolean;
  providerId: string;
  categoryId: number;
  createdAt: Date;
  updatedAt: Date;
  provider: UserSummaryEntityInput;
  category: CategoryEntityInput;
}

export class ServiceEntity {
  id: number;
  title: string;
  description: string;
  durationMin: number;
  isActive: boolean;
  providerId: string;
  categoryId: number;
  createdAt: Date;
  updatedAt: Date;
  provider: UserSummaryEntity;
  category: CategoryEntity;

  private constructor(service: ServiceEntityInput) {
    this.id = service.id;
    this.title = service.title;
    this.description = service.description;
    this.durationMin = service.durationMin;
    this.isActive = service.isActive;
    this.providerId = service.providerId;
    this.categoryId = service.categoryId;
    this.createdAt = service.createdAt;
    this.updatedAt = service.updatedAt;
    this.provider = UserSummaryEntity.from(service.provider);
    this.category = CategoryEntity.from(service.category);
  }

  static from(service: ServiceEntityInput): ServiceEntity {
    return new ServiceEntity(service);
  }

  static fromMany(services: ServiceEntityInput[]): ServiceEntity[] {
    return services.map((service) => ServiceEntity.from(service));
  }
}
