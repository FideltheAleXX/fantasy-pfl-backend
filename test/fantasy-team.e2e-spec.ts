import { ValidationPipe } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('FantasyTeamController (e2e)', () => {
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

  const parseAuthResponse = (
    value: unknown,
  ): { user: { id: string }; token: string } => {
    if (
      !isRecord(value) ||
      !isRecord(value.user) ||
      typeof value.user.id !== 'string' ||
      typeof value.token !== 'string'
    ) {
      throw new Error('Unexpected authentication response');
    }
    return { user: { id: value.user.id }, token: value.token };
  };

  const parseFantasyTeamResponse = (
    value: unknown,
  ): { id: string; userId: string } => {
    if (
      !isRecord(value) ||
      typeof value.id !== 'string' ||
      typeof value.userId !== 'string'
    ) {
      throw new Error('Unexpected fantasy-team response');
    }
    return { id: value.id, userId: value.userId };
  };

  it('GET /api/fantasy-team/me — требует токен авторизации', async () => {
    await request(app.getHttpServer()).get('/api/fantasy-team/me').expect(401);
  });

  it('GET /api/fantasy-team/me — отклоняет недействительный токен', async () => {
    await request(app.getHttpServer())
      .get('/api/fantasy-team/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('GET /api/fantasy-team — запрещён обычному пользователю', async () => {
    const registration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `e2e-non-admin-${Date.now()}@example.com`,
        password: 'TestPassword123!',
      })
      .expect(201);
    const registrationBody = parseAuthResponse(registration.body);
    createdUserIds.push(registrationBody.user.id);

    await request(app.getHttpServer())
      .get('/api/fantasy-team')
      .set('Authorization', `Bearer ${registrationBody.token}`)
      .expect(403);
  });

  it('создание фэнтези-команды — доступна через GET /me, повторное создание отклоняется', async () => {
    const email = `e2e-team-${crypto.randomUUID()}@example.com`;
    const registration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'TestPassword123!' })
      .expect(201);
    const registrationBody = parseAuthResponse(registration.body);
    createdUserIds.push(registrationBody.user.id);

    const token = registrationBody.token;
    const created = await request(app.getHttpServer())
      .post('/api/fantasy-team')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `My Fantasy ${crypto.randomUUID().slice(0, 8)}` })
      .expect(201);
    const createdBody = parseFantasyTeamResponse(created.body);

    const fetched = await request(app.getHttpServer())
      .get('/api/fantasy-team/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const fetchedBody = parseFantasyTeamResponse(fetched.body);

    expect(fetchedBody.id).toBe(createdBody.id);
    expect(fetchedBody.userId).toBe(registrationBody.user.id);

    await request(app.getHttpServer())
      .post('/api/fantasy-team')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Second Fantasy ${crypto.randomUUID().slice(0, 8)}` })
      .expect(409);
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
