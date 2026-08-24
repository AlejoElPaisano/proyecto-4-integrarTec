import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} as const;

const profileUserSelect = {
  ...safeUserSelect,
  balanceMinutes: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async create(email: string, name: string, passwordHash: string) {
    try {
      return await this.prisma.user.create({
        data: {
          email: this.normalizeEmail(email),
          name: name.trim(),
          passwordHash,
        },
        select: safeUserSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('El email ya está registrado');
      }
      throw error;
    }
  }

  async findByEmailForAuth(email: string) {
    return this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
      select: {
        ...safeUserSelect,
        passwordHash: true,
        isActive: true,
      },
    });
  }

  async findByIdForAccess(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        ...safeUserSelect,
        isActive: true,
      },
    });
  }

  async findByIdWithRefreshToken(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        ...safeUserSelect,
        isActive: true,
        hashedRefreshToken: true,
      },
    });
  }

  async updateRefreshToken(userId: string, hashedRefreshToken: string | null): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken },
    });
  }

  async findProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: profileUserSelect,
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  async findPublicProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  async updateProfile(id: string, dto: UpdateUserDto) {
    const data = dto.name === undefined ? {} : { name: dto.name.trim() };
    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: profileUserSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Usuario no encontrado');
      }
      throw error;
    }
  }
}
