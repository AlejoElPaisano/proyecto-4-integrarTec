import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

const safeCategorySelect = {
  id: true,
  name: true,
} as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.category.findMany({
      select: safeCategorySelect,
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateCategoryDto) {
    const name = this.normalizeName(dto.name);

    try {
      return await this.prisma.category.create({
        data: { name },
        select: safeCategorySelect,
      });
    } catch (error) {
      this.throwMappedError(error);
      throw error;
    }
  }

  async update(id: number, dto: UpdateCategoryDto) {
    const data = dto.name === undefined ? {} : { name: this.normalizeName(dto.name) };

    try {
      return await this.prisma.category.update({
        where: { id },
        data,
        select: safeCategorySelect,
      });
    } catch (error) {
      this.throwMappedError(error);
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    try {
      await this.prisma.category.delete({
        where: { id },
      });
    } catch (error) {
      if (this.isPrismaError(error, 'P2003')) {
        throw new ConflictException(
          'No se puede eliminar la categoría porque tiene servicios asociados',
        );
      }
      if (this.isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Categoría no encontrada');
      }
      throw error;
    }
  }

  private normalizeName(name: string): string {
    const normalizedName = name.trim();
    if (normalizedName.length < 2) {
      throw new BadRequestException('El nombre debe tener al menos 2 caracteres');
    }
    if (normalizedName.length > 100) {
      throw new BadRequestException('El nombre no puede superar los 100 caracteres');
    }
    return normalizedName;
  }

  private throwMappedError(error: unknown): void {
    if (this.isPrismaError(error, 'P2002')) {
      throw new ConflictException('La categoría ya existe');
    }
    if (this.isPrismaError(error, 'P2025')) {
      throw new NotFoundException('Categoría no encontrada');
    }
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
    );
  }
}
