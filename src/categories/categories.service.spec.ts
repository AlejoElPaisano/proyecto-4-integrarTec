import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';

const category = { id: 1, name: 'Consultoría' };

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('Database error', {
    code,
    clientVersion: '7.0.0',
  });

describe('CategoriesService', () => {
  const prisma = {
    category: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists categories ordered by name with an explicit safe select', async () => {
    jest.mocked(prisma.category.findMany).mockResolvedValue([category] as never);
    const service = new CategoriesService(prisma);

    await expect(service.findAll()).resolves.toEqual([category]);
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  });

  it('trims the name and returns a safe select when creating', async () => {
    jest.mocked(prisma.category.create).mockResolvedValue(category as never);
    const service = new CategoriesService(prisma);

    await expect(service.create({ name: '  Consultoría  ' })).resolves.toEqual(
      category,
    );
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: 'Consultoría' },
      select: { id: true, name: true },
    });
  });

  it('maps duplicate names to conflict when creating', async () => {
    jest.mocked(prisma.category.create).mockRejectedValue(knownError('P2002'));
    const service = new CategoriesService(prisma);

    await expect(service.create({ name: 'Consultoría' })).rejects.toEqual(
      new ConflictException('La categoría ya existe'),
    );
  });

  it('updates only provided fields and maps duplicate names to conflict', async () => {
    jest.mocked(prisma.category.update).mockRejectedValue(knownError('P2002'));
    const service = new CategoriesService(prisma);

    await expect(
      service.update(1, { name: '  Cursos  ' }),
    ).rejects.toEqual(new ConflictException('La categoría ya existe'));
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'Cursos' },
      select: { id: true, name: true },
    });
  });

  it('does not overwrite data when a patch has no fields', async () => {
    jest.mocked(prisma.category.update).mockResolvedValue(category as never);
    const service = new CategoriesService(prisma);

    await service.update(1, {});

    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {},
      select: { id: true, name: true },
    });
  });

  it('maps update and delete not-found errors to 404', async () => {
    jest.mocked(prisma.category.update).mockRejectedValue(knownError('P2025'));
    jest.mocked(prisma.category.delete).mockRejectedValue(knownError('P2025'));
    const service = new CategoriesService(prisma);

    await expect(service.update(99, {})).rejects.toEqual(
      new NotFoundException('Categoría no encontrada'),
    );
    await expect(service.remove(99)).rejects.toEqual(
      new NotFoundException('Categoría no encontrada'),
    );
  });

  it('maps referenced-category deletes to conflict', async () => {
    jest.mocked(prisma.category.delete).mockRejectedValue(knownError('P2003'));
    const service = new CategoriesService(prisma);

    await expect(service.remove(1)).rejects.toEqual(
      new ConflictException(
        'No se puede eliminar la categoría porque tiene servicios asociados',
      ),
    );
  });
});
