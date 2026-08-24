import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/client';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

function createContext(handler: () => void, user?: { role?: string }) {
  return {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('allows routes without role metadata', () => {
    const handler = () => undefined;

    expect(guard.canActivate(createContext(handler))).toBe(true);
  });

  it('allows a user with one of the required roles', () => {
    const handler = () => undefined;
    Roles(Role.COORDINATOR, Role.ADMIN)(handler);

    expect(
      guard.canActivate(createContext(handler, { role: Role.ADMIN })),
    ).toBe(true);
  });

  it('rejects a user with an insufficient role', () => {
    const handler = () => undefined;
    Roles(Role.ADMIN)(handler);

    expect(() =>
      guard.canActivate(createContext(handler, { role: Role.MEMBER })),
    ).toThrow(new ForbiddenException('No tenés permiso para esta acción'));
  });

  it('rejects a protected route when authentication did not provide a user', () => {
    const handler = () => undefined;
    Roles(Role.ADMIN)(handler);

    expect(() => guard.canActivate(createContext(handler))).toThrow(
      new ForbiddenException('No se pudo determinar el usuario'),
    );
  });
});
