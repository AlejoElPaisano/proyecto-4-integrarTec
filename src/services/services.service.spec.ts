import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '../generated/prisma/client';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { ServicesService } from './services.service';

const category = { id: 1, name: 'Consultoría' };
const provider = { id: 'provider-id', name: 'Provider' };
const serviceRow = {
  id: 3,
  title: 'Consultoría',
  description: 'Ayuda profesional',
  durationMin: 60,
  isActive: true,
  providerId: provider.id,
  categoryId: category.id,
  createdAt: new Date(),
  updatedAt: new Date(),
  provider,
  category,
};

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('Database error', {
    code,
    clientVersion: '7.0.0',
  });

const owner: JwtPayload = {
  sub: provider.id,
  email: 'provider@example.com',
  role: Role.MEMBER,
};

const coordinator: JwtPayload = {
  sub: 'coordinator-id',
  email: 'coordinator@example.com',
  role: Role.COORDINATOR,
};

describe('ServicesService', () => {
  const prisma = {
    service: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists only active services from active providers and applies public filters', async () => {
    jest.mocked(prisma.service.findMany).mockResolvedValue([serviceRow] as never);
    const sut = new ServicesService(prisma);

    await expect(
      sut.findAll({
        categoryId: 1,
        providerId: provider.id,
        search: '  ayuda  ',
      }),
    ).resolves.toEqual([serviceRow]);

    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          provider: { isActive: true },
          categoryId: 1,
          providerId: provider.id,
          OR: [
            { title: { contains: 'ayuda', mode: 'insensitive' } },
            { description: { contains: 'ayuda', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });

  it('scopes mine to the JWT provider while including inactive rows', async () => {
    jest.mocked(prisma.service.findMany).mockResolvedValue([serviceRow] as never);
    const sut = new ServicesService(prisma);

    await sut.findMine(provider.id);

    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { providerId: provider.id },
      }),
    );
  });

  it('uses an explicit safe nested select for a public service', async () => {
    jest.mocked(prisma.service.findFirst).mockResolvedValue(serviceRow as never);
    const sut = new ServicesService(prisma);

    await sut.findOne(serviceRow.id);

    const [args] = jest.mocked(prisma.service.findFirst).mock.calls[0] ?? [];
    expect(args?.where).toEqual({
      id: serviceRow.id,
      isActive: true,
      provider: { isActive: true },
    });
    expect(args?.select).toMatchObject({
      id: true,
      title: true,
      provider: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    });
    expect(args?.select).not.toHaveProperty('provider.email');
  });

  it('derives the provider from the method argument and trims text on create', async () => {
    jest.mocked(prisma.service.create).mockResolvedValue(serviceRow as never);
    const sut = new ServicesService(prisma);
    const dto: CreateServiceDto = {
      title: '  Consultoría  ',
      description: '  Ayuda profesional  ',
      durationMin: 60,
      categoryId: 1,
    };

    await sut.create(dto, provider.id);

    expect(prisma.service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          title: 'Consultoría',
          description: 'Ayuda profesional',
          durationMin: 60,
          categoryId: 1,
          providerId: provider.id,
        },
      }),
    );
  });

  it('allows the owner to update and blocks a different member', async () => {
    jest.mocked(prisma.service.findUnique).mockResolvedValue({ providerId: provider.id } as never);
    jest.mocked(prisma.service.update).mockResolvedValue(serviceRow as never);
    const sut = new ServicesService(prisma);

    await sut.update(serviceRow.id, { title: '  Nuevo título  ' }, owner);
    expect(prisma.service.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { title: 'Nuevo título' } }),
    );

    await expect(
      sut.update(serviceRow.id, {}, { ...owner, sub: 'other-provider' }),
    ).rejects.toEqual(
      new ForbiddenException('No tenés permiso para modificar este servicio'),
    );
  });

  it('allows coordinator update and preserves the service on deactivation', async () => {
    jest.mocked(prisma.service.findUnique).mockResolvedValue({ providerId: provider.id } as never);
    jest.mocked(prisma.service.update).mockResolvedValue({ ...serviceRow, isActive: false } as never);
    const sut = new ServicesService(prisma);

    await sut.update(serviceRow.id, { categoryId: 2 }, coordinator);
    await sut.deactivate(serviceRow.id, coordinator);

    expect(prisma.service.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: serviceRow.id },
        data: { isActive: false },
      }),
    );
    expect(prisma.service.delete).not.toHaveBeenCalled();
  });

  it('maps missing service, category FK, and transaction FK errors', async () => {
    jest.mocked(prisma.service.findUnique).mockResolvedValue(null);
    const sut = new ServicesService(prisma);

    await expect(sut.update(99, {}, owner)).rejects.toEqual(
      new NotFoundException('Servicio no encontrado'),
    );

    jest.mocked(prisma.service.create).mockRejectedValue(knownError('P2003'));
    await expect(
      sut.create(
        {
          title: 'Servicio',
          description: 'Descripción',
          durationMin: 30,
          categoryId: 99,
        },
        provider.id,
      ),
    ).rejects.toEqual(new NotFoundException('La categoría no existe'));

    jest.mocked(prisma.service.findUnique).mockResolvedValue({ providerId: provider.id } as never);
    jest.mocked(prisma.service.delete).mockRejectedValue(knownError('P2003'));
    await expect(sut.remove(serviceRow.id, owner)).rejects.toEqual(
      new ConflictException(
        'No se puede eliminar el servicio porque tiene transacciones asociadas',
      ),
    );
  });
});
