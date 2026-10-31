import { ValidationPipe } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    prisma = app.get(PrismaService);
    await app.init();
  });

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

  const parseAuthResponse = (value: unknown) => {
    if (
      !isRecord(value) ||
      !isRecord(value.user) ||
      typeof value.user.id !== 'string' ||
      typeof value.user.email !== 'string' ||
      typeof value.user.role !== 'string' ||
      typeof value.token !== 'string'
    ) {
      throw new Error('Unexpected authentication response');
    }

    return {
      user: {
        id: value.user.id,
        email: value.user.email,
        role: value.user.role,
      },
      token: value.token,
    };
  };

  it('регистрация → вход с теми же данными', async () => {
    const email = `e2e-${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    const registration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password })
      .expect(201);
    const registrationBody = parseAuthResponse(registration.body);
    createdUserIds.push(registrationBody.user.id);

    expect(registrationBody.user.email).toBe(email);
    expect(registrationBody.user.role).toBe('user');
    expect(registrationBody.user.id).toBeDefined();
    expect(registrationBody.token).toEqual(expect.any(String));

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    const login = parseAuthResponse(loginResponse.body);

    expect(login.user.id).toBe(registrationBody.user.id);
    expect(login.user.email).toBe(email);
    expect(login.token).toEqual(expect.any(String));
  });

  it('POST /api/auth/register — отклоняет повторную регистрацию email', async () => {
    const email = `e2e-duplicate-${Date.now()}@example.com`;
    const credentials = { email, password: 'TestPassword123!' };

    const registration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(credentials)
      .expect(201);
    createdUserIds.push(parseAuthResponse(registration.body).user.id);

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(credentials)
      .expect(409);
  });

  it('POST /api/auth/login — отклоняет неверный пароль', async () => {
    const email = `e2e-wrong-password-${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    const registration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password })
      .expect(201);
    createdUserIds.push(parseAuthResponse(registration.body).user.id);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'WrongPassword123!' })
      .expect(401);
  });

  it('POST /api/auth/register и /login — отклоняют некорректный email', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'TestPassword123!' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'TestPassword123!' })
      .expect(400);
  });

  it('POST /api/auth/register — отклоняет отсутствующие и невалидные данные', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `e2e-short-password-${Date.now()}@example.com`,
        password: '123',
      })
      .expect(400);
  });

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await prisma.fantasyTeam.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
      createdUserIds.length = 0;
    }
    await app.close();
    await prisma.$disconnect();
  });
});
