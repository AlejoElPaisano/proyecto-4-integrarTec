export interface CategoryEntityInput {
  id: number;
  name: string;
}

export class CategoryEntity {
  id: number;
  name: string;

  private constructor(category: CategoryEntityInput) {
    this.id = category.id;
    this.name = category.name;
  }

  static from(category: CategoryEntityInput): CategoryEntity {
    return new CategoryEntity(category);
  }

  static fromMany(categories: CategoryEntityInput[]): CategoryEntity[] {
    return categories.map((category) => CategoryEntity.from(category));
  }
}
