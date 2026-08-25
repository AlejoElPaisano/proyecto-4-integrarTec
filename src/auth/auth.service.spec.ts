import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  const usersService = {
    findByEmailForAuth: jest.fn(),
    findByIdWithRefreshToken: jest.fn(),
    updateRefreshToken: jest.fn(),
  } as unknown as UsersService;
  const jwtService = {
    signAsync: jest.fn(),
  } as unknown as JwtService;
  const config = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string> = {
        JWT_REFRESH_SECRET: 'refresh-secret',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };
      return values[key];
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['unknown user', null],
    [
      'inactive user',
      {
        id: 'user-id',
        email: 'user@example.com',
        passwordHash: 'stored-hash',
        isActive: false,
      },
    ],
    [
      'wrong password',
      {
        id: 'user-id',
        email: 'user@example.com',
        passwordHash: 'stored-hash',
        isActive: true,
      },
    ],
  ])('returns the same generic failure for %s', async (_case, user) => {
    jest.mocked(usersService.findByEmailForAuth).mockResolvedValue(user as never);
    jest.mocked(bcrypt.compare).mockResolvedValue(false as never);
    const service = new AuthService(usersService, jwtService, config);

    const result = service.login({
      email: 'User@Example.com',
      password: 'wrong-password',
    });

    await expect(result).rejects.toEqual(
      new UnauthorizedException('Credenciales inválidas'),
    );
  });

  it('digests the full refresh token before bcrypt hashing', async () => {
    const user = {
      id: 'user-id',
      email: 'user@example.com',
      name: 'Test User',
      role: 'USER',
      createdAt: new Date(),
      passwordHash: 'stored-hash',
      isActive: true,
    };
    jest.mocked(usersService.findByEmailForAuth).mockResolvedValue(user as never);
    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
    jest.mocked(bcrypt.hash).mockResolvedValue('hashed-refresh-token' as never);
    jest
      .mocked(jwtService.signAsync)
      .mockResolvedValueOnce('access-token' as never)
      .mockResolvedValueOnce('refresh-token' as never);
    const service = new AuthService(usersService, jwtService, config);

    await service.login({
      email: user.email,
      password: 'correct-password',
    });

    const expectedDigest = createHash('sha256')
      .update('refresh-token', 'utf8')
      .digest('hex');
    expect(expectedDigest).toHaveLength(64);
    expect(bcrypt.hash).toHaveBeenCalledWith(expectedDigest, 10);
  });

  it('digests the full refresh token before bcrypt comparison', async () => {
    const refreshToken = 'refresh-token-that-is-longer-than-bcrypts-input-limit';
    jest.mocked(usersService.findByIdWithRefreshToken).mockResolvedValue({
      id: 'user-id',
      isActive: true,
      hashedRefreshToken: 'stored-refresh-hash',
    } as never);
    jest.mocked(bcrypt.compare).mockResolvedValue(false as never);
    const service = new AuthService(usersService, jwtService, config);

    await expect(service.refresh('user-id', refreshToken)).rejects.toEqual(
      new ForbiddenException('Refresh token inválido'),
    );

    const expectedDigest = createHash('sha256')
      .update(refreshToken, 'utf8')
      .digest('hex');
    expect(bcrypt.compare).toHaveBeenCalledWith(
      expectedDigest,
      'stored-refresh-hash',
    );
  });

  it('issues a unique refresh token for each issuance', async () => {
    const user = {
      id: 'user-id',
      email: 'user@example.com',
      name: 'Test User',
      role: 'USER',
      createdAt: new Date(),
      passwordHash: 'stored-hash',
      isActive: true,
    };
    jest.mocked(usersService.findByEmailForAuth).mockResolvedValue(user as never);
    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
    jest.mocked(bcrypt.hash).mockResolvedValue('hashed-refresh-token' as never);
    jest
      .mocked(jwtService.signAsync)
      .mockResolvedValueOnce('access-token-1' as never)
      .mockResolvedValueOnce('refresh-token-1' as never)
      .mockResolvedValueOnce('access-token-2' as never)
      .mockResolvedValueOnce('refresh-token-2' as never);
    const service = new AuthService(usersService, jwtService, config);

    const first = await service.login({
      email: user.email,
      password: 'correct-password',
    });
    const second = await service.login({
      email: user.email,
      password: 'correct-password',
    });

    const signCalls = jest.mocked(jwtService.signAsync).mock.calls;
    const firstRefreshPayload = signCalls[1][0] as { jti?: string };
    const secondRefreshPayload = signCalls[3][0] as { jti?: string };
    expect(signCalls[0][0]).toEqual({ sub: user.id, email: user.email });
    expect(signCalls[2][0]).toEqual({ sub: user.id, email: user.email });
    expect(firstRefreshPayload).toMatchObject({
      sub: user.id,
      email: user.email,
    });
    expect(secondRefreshPayload).toMatchObject({
      sub: user.id,
      email: user.email,
    });
    expect(firstRefreshPayload.jti).toEqual(expect.any(String));
    expect(secondRefreshPayload.jti).toEqual(expect.any(String));
    expect(firstRefreshPayload.jti).not.toBe(secondRefreshPayload.jti);
    expect(first.refresh_token).not.toBe(second.refresh_token);
  });
});
