import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '../generated/prisma/client';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { FindServicesQueryDto } from './dto/find-services-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

const safeServiceSelect = {
  id: true,
  title: true,
  description: true,
  durationMin: true,
  isActive: true,
  providerId: true,
  categoryId: true,
  createdAt: true,
  updatedAt: true,
  provider: {
    select: {
      id: true,
      name: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

const authorizationServiceSelect = {
  providerId: true,
} as const;

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindServicesQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.ServiceWhereInput = {
      isActive: true,
      provider: { isActive: true },
      ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
      ...(query.providerId === undefined ? {} : { providerId: query.providerId }),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.service.findMany({
      where,
      select: safeServiceSelect,
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
    });
  }

  async findMine(providerId: string) {
    return this.prisma.service.findMany({
      where: { providerId },
      select: safeServiceSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async findOne(id: number) {
    const service = await this.prisma.service.findFirst({
      where: {
        id,
        isActive: true,
        provider: { isActive: true },
      },
      select: safeServiceSelect,
    });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }
    return service;
  }

  async create(dto: CreateServiceDto, providerId: string) {
    try {
      return await this.prisma.service.create({
        data: {
          title: this.normalizeText(dto.title, 'El título', 2, 100),
          description: this.normalizeText(dto.description, 'La descripción', 1, 2000),
          durationMin: dto.durationMin,
          categoryId: dto.categoryId,
          providerId,
        },
        select: safeServiceSelect,
      });
    } catch (error) {
      this.throwMappedWriteError(error);
      throw error;
    }
  }

  async update(id: number, dto: UpdateServiceDto, user: JwtPayload) {
    await this.assertCanManage(id, user, false);
    const data = this.buildUpdateData(dto);

    try {
      return await this.prisma.service.update({
        where: { id },
        data,
        select: safeServiceSelect,
      });
    } catch (error) {
      this.throwMappedWriteError(error);
      throw error;
    }
  }

  async remove(id: number, user: JwtPayload): Promise<void> {
    await this.assertCanManage(id, user, true);

    try {
      await this.prisma.service.delete({ where: { id } });
    } catch (error) {
      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException('El servicio ya existe');
      }
      if (this.isPrismaError(error, 'P2003')) {
        throw new ConflictException(
          'No se puede eliminar el servicio porque tiene transacciones asociadas',
        );
      }
      if (this.isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Servicio no encontrado');
      }
      throw error;
    }
  }

  async deactivate(id: number, user: JwtPayload) {
    await this.assertCanManage(id, user, false);

    try {
      return await this.prisma.service.update({
        where: { id },
        data: { isActive: false },
        select: safeServiceSelect,
      });
    } catch (error) {
      this.throwMappedWriteError(error);
      throw error;
    }
  }

  private async assertCanManage(
    id: number,
    user: JwtPayload,
    adminOnlyOwnerOverride: boolean,
  ): Promise<void> {
    const service = await this.prisma.service.findUnique({
      where: { id },
      select: authorizationServiceSelect,
    });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    const isOwner = service.providerId === user.sub;
    const isCoordinatorOrAdmin =
      user.role === Role.COORDINATOR || user.role === Role.ADMIN;
    const isAllowed = adminOnlyOwnerOverride
      ? isOwner || user.role === Role.ADMIN
      : isOwner || isCoordinatorOrAdmin;

    if (!isAllowed) {
      throw new ForbiddenException('No tenés permiso para modificar este servicio');
    }
  }

  private buildUpdateData(dto: UpdateServiceDto) {
    return {
      ...(dto.title === undefined
        ? {}
        : { title: this.normalizeText(dto.title, 'El título', 2, 100) }),
      ...(dto.description === undefined
        ? {}
        : {
            description: this.normalizeText(
              dto.description,
              'La descripción',
              1,
              2000,
            ),
          }),
      ...(dto.durationMin === undefined ? {} : { durationMin: dto.durationMin }),
      ...(dto.categoryId === undefined ? {} : { categoryId: dto.categoryId }),
    };
  }

  private normalizeText(
    value: string,
    field: string,
    minLength: number,
    maxLength: number,
  ): string {
    const normalized = value.trim();
    if (normalized.length < minLength) {
      throw new BadRequestException(`${field} debe tener al menos ${minLength} caracteres`);
    }
    if (normalized.length > maxLength) {
      throw new BadRequestException(`${field} no puede superar los ${maxLength} caracteres`);
    }
    return normalized;
  }

  private throwMappedWriteError(error: unknown): void {
    if (this.isPrismaError(error, 'P2002')) {
      throw new ConflictException('El servicio ya existe');
    }
    if (this.isPrismaError(error, 'P2003')) {
      throw new NotFoundException('La categoría no existe');
    }
    if (this.isPrismaError(error, 'P2025')) {
      throw new NotFoundException('Servicio no encontrado');
    }
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
    );
  }
}
