import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

function decodeJwtPayload(token: string): { jti?: unknown } {
  const encodedPayload = token.split('.')[1];
  if (!encodedPayload) {
    throw new Error('Refresh token payload is missing');
  }

  return JSON.parse(
    Buffer.from(encodedPayload, 'base64url').toString('utf8'),
  ) as { jti?: unknown };
}

describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `auth-e2e-${Date.now()}@example.com`;
  const password = 'StrongPass1';
  let accessToken: string;
  let refreshToken: string;
  let rotatedRefreshToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({ where: { email } });
    } finally {
      await app.close();
    }
  });

  it('registers, authenticates, rotates, and revokes refresh tokens', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, name: 'Auth E2E User' })
      .expect(201);

    expect(registerResponse.body.user).not.toHaveProperty('passwordHash');
    expect(registerResponse.body.user).not.toHaveProperty('hashedRefreshToken');
    accessToken = registerResponse.body.access_token;
    refreshToken = registerResponse.body.refresh_token;

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: email.toUpperCase(), password })
      .expect(200);
    accessToken = loginResponse.body.access_token;
    refreshToken = loginResponse.body.refresh_token;

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.email).toBe(email);
      });

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Authorization', `Bearer ${refreshToken}`)
      .expect(200);
    rotatedRefreshToken = refreshResponse.body.refresh_token;
    expect(rotatedRefreshToken).not.toBe(refreshToken);
    expect(typeof decodeJwtPayload(rotatedRefreshToken).jti).toBe('string');

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Authorization', `Bearer ${refreshToken}`)
      .expect(403);

    accessToken = refreshResponse.body.access_token;
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Authorization', `Bearer ${rotatedRefreshToken}`)
      .expect(403);
  });
});
