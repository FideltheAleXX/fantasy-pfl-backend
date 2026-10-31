import { ValidationPipe } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseAuthResponse = (value: unknown) => {
  if (
    !isRecord(value) ||
    !isRecord(value.user) ||
    typeof value.user.id !== 'string' ||
    typeof value.token !== 'string'
  ) {
    throw new Error('Unexpected authentication response');
  }

  return { userId: value.user.id, token: value.token };
};

const parseDreamTeamResponse = (value: unknown) => {
  if (
    !isRecord(value) ||
    typeof value.gameweekId !== 'string' ||
    typeof value.formation !== 'string' ||
    typeof value.totalPoints !== 'number' ||
    !isRecord(value.players)
  ) {
    throw new Error('Unexpected dream-team response');
  }

  const { goalkeeper, defenders, midfielders, forwards } = value.players;
  if (
    !Array.isArray(goalkeeper) ||
    !Array.isArray(defenders) ||
    !Array.isArray(midfielders) ||
    !Array.isArray(forwards)
  ) {
    throw new Error('Unexpected dream-team players');
  }

  return {
    gameweekId: value.gameweekId,
    formation: value.formation,
    totalPoints: value.totalPoints,
    players: { goalkeeper, defenders, midfielders, forwards },
  };
};

describe('PlayerGameweekStatController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
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
    jwtService = app.get(JwtService);
    await app.init();
  });

  describe('player-gameweek-stat', () => {
    // Тестові дані для цього блоку — ідентифікатори для очищення
    const statGameweekIds: string[] = [];
    const statStatIds: string[] = [];
    const statPlayerIds: string[] = [];
    const statTeamIds: string[] = [];
    const statUserIds: string[] = [];

    // Хелпер: JWT-токен адміна (створюємо прямо в БД)
    const makeAdminToken = async () => {
      const admin = await prisma.user.create({
        data: {
          email: `stat-admin-${crypto.randomUUID()}@test.com`,
          passwordHash: 'irrelevant',
          role: 'admin',
        },
      });
      statUserIds.push(admin.id);
      const token = await jwtService.signAsync({
        sub: admin.id,
        email: admin.email,
        role: admin.role,
      });
      return token;
    };

    // Хелпер: створити гравця із зазначеною позицією
    const makePlayer = async (position: 'gk' | 'def' | 'mid' | 'fwd') => {
      let teamId: string;
      if (statTeamIds.length === 0) {
        const team = await prisma.team.create({
          data: {
            name: `StatTeam-${crypto.randomUUID()}`,
            shortName: `ST${crypto.randomUUID().slice(0, 3)}`,
          },
        });
        statTeamIds.push(team.id);
        teamId = team.id;
      } else {
        teamId = statTeamIds[0];
      }

      const player = await prisma.player.create({
        data: {
          firstName: 'Stat',
          lastName: crypto.randomUUID().slice(0, 8),
          displayName: `Stat ${position} ${crypto.randomUUID().slice(0, 6)}`,
          position,
          price: 5,
          teamId,
        },
      });
      statPlayerIds.push(player.id);
      return player;
    };

    // Хелпер: створити тур із дедлайном у майбутньому (щоб дедлайн не блокував)
    const makeGameweek = async (
      number: number = Math.floor(Math.random() * 900) + 100,
    ) => {
      const gw = await prisma.gameweek.create({
        data: {
          number,
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 днів
          isFinished: false,
        },
      });
      statGameweekIds.push(gw.id);
      return gw;
    };

    // Хелпер: створити запис статистики
    const makeStat = async (
      playerId: string,
      gameweekId: string,
      data: {
        minutesPlayed?: number;
        goals?: number;
        assists?: number;
        cleanSheet?: boolean;
        goalsConceded?: number;
        yellowCards?: number;
        redCards?: number;
        saves?: number;
        points?: number;
      } = {},
    ) => {
      const stat = await prisma.playerGameweekStat.create({
        data: {
          playerId,
          gameweekId,
          minutesPlayed: data.minutesPlayed ?? 0,
          goals: data.goals ?? 0,
          assists: data.assists ?? 0,
          cleanSheet: data.cleanSheet ?? false,
          goalsConceded: data.goalsConceded ?? 0,
          yellowCards: data.yellowCards ?? 0,
          redCards: data.redCards ?? 0,
          saves: data.saves ?? 0,
          points: data.points ?? 0,
        },
      });
      statStatIds.push(stat.id);
      return stat;
    };

    afterEach(async () => {
      if (statStatIds.length > 0) {
        await prisma.playerGameweekStat.deleteMany({
          where: { id: { in: statStatIds } },
        });
        statStatIds.length = 0;
      }
      if (statPlayerIds.length > 0) {
        await prisma.player.deleteMany({
          where: { id: { in: statPlayerIds } },
        });
        statPlayerIds.length = 0;
      }
      if (statTeamIds.length > 0) {
        await prisma.team.deleteMany({
          where: { id: { in: statTeamIds } },
        });
        statTeamIds.length = 0;
      }
      if (statGameweekIds.length > 0) {
        await prisma.gameweek.deleteMany({
          where: { id: { in: statGameweekIds } },
        });
        statGameweekIds.length = 0;
      }
      if (statUserIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: statUserIds } },
        });
        statUserIds.length = 0;
      }
    });

    // ── Підрахунок очків: хвилини ────────────────────────────────────────────

    it('нараховує 0 очок за 0 хвилин', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('mid');
      const gw = await makeGameweek();
      await makeStat(player.id, gw.id, { minutesPlayed: 0 });

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updated = await prisma.playerGameweekStat.findUnique({
        where: {
          playerId_gameweekId: { playerId: player.id, gameweekId: gw.id },
        },
      });
      expect(updated!.points).toBe(0);
    });

    it('нараховує 1 очко за 1–59 хвилин (гравець зіграв менше 60 хв)', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('fwd');
      const gw = await makeGameweek();
      await makeStat(player.id, gw.id, { minutesPlayed: 59 });

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updated = await prisma.playerGameweekStat.findUnique({
        where: {
          playerId_gameweekId: { playerId: player.id, gameweekId: gw.id },
        },
      });
      expect(updated!.points).toBe(1);
    });

    it('нараховує 2 очки за рівно 60 хвилин', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('def');
      const gw = await makeGameweek();
      await makeStat(player.id, gw.id, { minutesPlayed: 60 });

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updated = await prisma.playerGameweekStat.findUnique({
        where: {
          playerId_gameweekId: { playerId: player.id, gameweekId: gw.id },
        },
      });
      expect(updated!.points).toBe(2);
    });

    // ── Підрахунок очків: голи за позицією ──────────────────────────────────

    it('GK: 6 очок за гол + 2 за 90 хв', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('gk');
      const gw = await makeGameweek();
      await makeStat(player.id, gw.id, { minutesPlayed: 90, goals: 1 });

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updated = await prisma.playerGameweekStat.findUnique({
        where: {
          playerId_gameweekId: { playerId: player.id, gameweekId: gw.id },
        },
      });
      // 2 (хвилини) + 6 (гол GK)
      expect(updated!.points).toBe(8);
    });

    it('DEF: 6 очок за гол + 2 за 90 хв', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('def');
      const gw = await makeGameweek();
      await makeStat(player.id, gw.id, { minutesPlayed: 90, goals: 2 });

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updated = await prisma.playerGameweekStat.findUnique({
        where: {
          playerId_gameweekId: { playerId: player.id, gameweekId: gw.id },
        },
      });
      // 2 + 6*2
      expect(updated!.points).toBe(14);
    });

    it('MID: 5 очок за гол', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('mid');
      const gw = await makeGameweek();
      await makeStat(player.id, gw.id, { minutesPlayed: 90, goals: 1 });

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updated = await prisma.playerGameweekStat.findUnique({
        where: {
          playerId_gameweekId: { playerId: player.id, gameweekId: gw.id },
        },
      });
      // 2 + 5
      expect(updated!.points).toBe(7);
    });

    it('FWD: 4 очки за гол', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('fwd');
      const gw = await makeGameweek();
      await makeStat(player.id, gw.id, { minutesPlayed: 90, goals: 1 });

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updated = await prisma.playerGameweekStat.findUnique({
        where: {
          playerId_gameweekId: { playerId: player.id, gameweekId: gw.id },
        },
      });
      // 2 + 4
      expect(updated!.points).toBe(6);
    });

    // ── Асисти ───────────────────────────────────────────────────────────────

    it('нараховує 3 очки за кожен асист', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('mid');
      const gw = await makeGameweek();
      await makeStat(player.id, gw.id, { minutesPlayed: 90, assists: 2 });

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updated = await prisma.playerGameweekStat.findUnique({
        where: {
          playerId_gameweekId: { playerId: player.id, gameweekId: gw.id },
        },
      });
      // 2 + 3*2
      expect(updated!.points).toBe(8);
    });

    // ── Сухарі ───────────────────────────────────────────────────────────────

    it('GK: сухар при 60+ хвилинах дає +4 очки', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('gk');
      const gw = await makeGameweek();
      await makeStat(player.id, gw.id, { minutesPlayed: 90, cleanSheet: true });

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updated = await prisma.playerGameweekStat.findUnique({
        where: {
          playerId_gameweekId: { playerId: player.id, gameweekId: gw.id },
        },
      });
      // 2 + 4 (cleanSheet GK)
      expect(updated!.points).toBe(6);
    });

    it('DEF: сухар при 60+ хвилинах дає +4 очки', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('def');
      const gw = await makeGameweek();
      await makeStat(player.id, gw.id, { minutesPlayed: 60, cleanSheet: true });

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updated = await prisma.playerGameweekStat.findUnique({
        where: {
          playerId_gameweekId: { playerId: player.id, gameweekId: gw.id },
        },
      });
      // 2 + 4
      expect(updated!.points).toBe(6);
    });

    it('MID: сухар при 60+ хвилинах дає +1 очко', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('mid');
      const gw = await makeGameweek();
      await makeStat(player.id, gw.id, { minutesPlayed: 90, cleanSheet: true });

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updated = await prisma.playerGameweekStat.findUnique({
        where: {
          playerId_gameweekId: { playerId: player.id, gameweekId: gw.id },
        },
      });
      // 2 + 1
      expect(updated!.points).toBe(3);
    });

    it('FWD: сухар не дає очок (не нараховується)', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('fwd');
      const gw = await makeGameweek();
      await makeStat(player.id, gw.id, { minutesPlayed: 90, cleanSheet: true });

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updated = await prisma.playerGameweekStat.findUnique({
        where: {
          playerId_gameweekId: { playerId: player.id, gameweekId: gw.id },
        },
      });
      // 2 (тільки хвилини)
      expect(updated!.points).toBe(2);
    });

    it('сухар із менше ніж 60 хвилинами не дає бонус (DEF)', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('def');
      const gw = await makeGameweek();
      await makeStat(player.id, gw.id, { minutesPlayed: 59, cleanSheet: true });

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updated = await prisma.playerGameweekStat.findUnique({
        where: {
          playerId_gameweekId: { playerId: player.id, gameweekId: gw.id },
        },
      });
      // 1 (59 хвилин) — сухар не зараховується
      expect(updated!.points).toBe(1);
    });

    // ── Пропущені голи ───────────────────────────────────────────────────────

    it('GK/DEF: -1 очко за кожні 2 пропущені голи', async () => {
      const adminToken = await makeAdminToken();
      const gk = await makePlayer('gk');
      const def = await makePlayer('def');
      const gw = await makeGameweek();
      await makeStat(gk.id, gw.id, { minutesPlayed: 90, goalsConceded: 4 });
      await makeStat(def.id, gw.id, { minutesPlayed: 90, goalsConceded: 3 });

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const gkStat = await prisma.playerGameweekStat.findUnique({
        where: { playerId_gameweekId: { playerId: gk.id, gameweekId: gw.id } },
      });
      const defStat = await prisma.playerGameweekStat.findUnique({
        where: { playerId_gameweekId: { playerId: def.id, gameweekId: gw.id } },
      });
      // GK: 2 - floor(4/2) = 2 - 2 = 0
      expect(gkStat!.points).toBe(0);
      // DEF: 2 - floor(3/2) = 2 - 1 = 1
      expect(defStat!.points).toBe(1);
    });

    it('MID/FWD: пропущені голи не знімають очки', async () => {
      const adminToken = await makeAdminToken();
      const mid = await makePlayer('mid');
      const fwd = await makePlayer('fwd');
      const gw = await makeGameweek();
      await makeStat(mid.id, gw.id, { minutesPlayed: 90, goalsConceded: 6 });
      await makeStat(fwd.id, gw.id, { minutesPlayed: 90, goalsConceded: 6 });

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const midStat = await prisma.playerGameweekStat.findUnique({
        where: { playerId_gameweekId: { playerId: mid.id, gameweekId: gw.id } },
      });
      const fwdStat = await prisma.playerGameweekStat.findUnique({
        where: { playerId_gameweekId: { playerId: fwd.id, gameweekId: gw.id } },
      });
      expect(midStat!.points).toBe(2);
      expect(fwdStat!.points).toBe(2);
    });

    // ── Картки ───────────────────────────────────────────────────────────────

    it('знімає 1 очко за жовту картку і 3 за червону', async () => {
      const adminToken = await makeAdminToken();
      const player1 = await makePlayer('mid');
      const player2 = await makePlayer('fwd');
      const gw = await makeGameweek();
      await makeStat(player1.id, gw.id, { minutesPlayed: 90, yellowCards: 1 });
      await makeStat(player2.id, gw.id, { minutesPlayed: 90, redCards: 1 });

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const stat1 = await prisma.playerGameweekStat.findUnique({
        where: {
          playerId_gameweekId: { playerId: player1.id, gameweekId: gw.id },
        },
      });
      const stat2 = await prisma.playerGameweekStat.findUnique({
        where: {
          playerId_gameweekId: { playerId: player2.id, gameweekId: gw.id },
        },
      });
      // 2 - 1 = 1
      expect(stat1!.points).toBe(1);
      // 2 - 3 = -1
      expect(stat2!.points).toBe(-1);
    });

    // ── Сейви ────────────────────────────────────────────────────────────────

    it('GK: нараховує 1 очко за кожні 3 сейви', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('gk');
      const gw = await makeGameweek();
      await makeStat(player.id, gw.id, { minutesPlayed: 90, saves: 7 });

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updated = await prisma.playerGameweekStat.findUnique({
        where: {
          playerId_gameweekId: { playerId: player.id, gameweekId: gw.id },
        },
      });
      // 2 + floor(7/3) = 2 + 2 = 4
      expect(updated!.points).toBe(4);
    });

    it('MID/FWD: сейви не дають очок', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('fwd');
      const gw = await makeGameweek();
      await makeStat(player.id, gw.id, { minutesPlayed: 90, saves: 9 });

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updated = await prisma.playerGameweekStat.findUnique({
        where: {
          playerId_gameweekId: { playerId: player.id, gameweekId: gw.id },
        },
      });
      expect(updated!.points).toBe(2);
    });

    // ── Комбінований сценарій ────────────────────────────────────────────────

    it('коректно рахує всі складові разом (GK: 90хв, 1 гол, 1 асист, сухар, 6 сейвів, 1 жовта)', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('gk');
      const gw = await makeGameweek();
      await makeStat(player.id, gw.id, {
        minutesPlayed: 90,
        goals: 1,
        assists: 1,
        cleanSheet: true,
        goalsConceded: 0,
        yellowCards: 1,
        redCards: 0,
        saves: 6,
      });

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updated = await prisma.playerGameweekStat.findUnique({
        where: {
          playerId_gameweekId: { playerId: player.id, gameweekId: gw.id },
        },
      });
      // 2 (90хв) + 6 (гол GK) + 3 (асист) + 4 (сухар GK) + 0 (пропущені=0) - 1 (жовта) + floor(6/3)=2 (сейви) = 16
      expect(updated!.points).toBe(16);
    });

    // ── Повторний розрахунок: не дублює, оновлює ────────────────────────────

    it('повторний calculate-points оновлює очки, не створює дублікатів', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('mid');
      const gw = await makeGameweek();
      await makeStat(player.id, gw.id, { minutesPlayed: 90, goals: 1 });

      // Перший розрахунок
      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const afterFirst = await prisma.playerGameweekStat.findMany({
        where: { playerId: player.id, gameweekId: gw.id },
      });
      expect(afterFirst).toHaveLength(1);
      // 2 + 5 = 7
      expect(afterFirst[0].points).toBe(7);

      // Оновлюємо статистику (прямо в БД для тесту)
      await prisma.playerGameweekStat.update({
        where: {
          playerId_gameweekId: { playerId: player.id, gameweekId: gw.id },
        },
        data: { goals: 2 },
      });

      // Другий розрахунок
      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const afterSecond = await prisma.playerGameweekStat.findMany({
        where: { playerId: player.id, gameweekId: gw.id },
      });
      // Все одно 1 запис (без дублів)
      expect(afterSecond).toHaveLength(1);
      // 2 + 5*2 = 12
      expect(afterSecond[0].points).toBe(12);
    });

    it('calculate-points оновлює totalPoints та form гравця', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('fwd');
      const gw1 = await makeGameweek();
      const gw2 = await makeGameweek();
      await makeStat(player.id, gw1.id, { minutesPlayed: 90, goals: 2 }); // 2 + 4*2 = 10
      await makeStat(player.id, gw2.id, { minutesPlayed: 60, goals: 1 }); // 2 + 4 = 6

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw1.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/player-gameweek-stat/gameweek/${gw2.id}/calculate-points`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updatedPlayer = await prisma.player.findUnique({
        where: { id: player.id },
      });
      expect(updatedPlayer!.totalPoints).toBe(16); // 10 + 6
      expect(updatedPlayer!.form).toBe(8.0); // (10 + 6) / 2 = 8.0
    });

    // ── bulkUpsert ───────────────────────────────────────────────────────────

    it('bulkUpsert: створює статистику для кількох гравців у турі', async () => {
      const adminToken = await makeAdminToken();
      const p1 = await makePlayer('gk');
      const p2 = await makePlayer('def');
      const gw = await makeGameweek();

      const res = await request(app.getHttpServer())
        .post('/api/player-gameweek-stat/batch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gameweekId: gw.id,
          stats: [
            { playerId: p1.id, minutesPlayed: 90, goals: 0, saves: 3 },
            { playerId: p2.id, minutesPlayed: 90, goals: 1 },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty('gameweekId', gw.id);
      expect(res.body).toHaveProperty('updatedCount', 2);

      // Перевіряємо що записи справді існують у БД
      const stats = await prisma.playerGameweekStat.findMany({
        where: { gameweekId: gw.id, playerId: { in: [p1.id, p2.id] } },
      });
      statStatIds.push(...stats.map((s) => s.id));
      expect(stats).toHaveLength(2);
    });

    it('bulkUpsert: оновлює наявний запис, не створює дублікат', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('mid');
      const gw = await makeGameweek();

      // Перший запит — створення
      await request(app.getHttpServer())
        .post('/api/player-gameweek-stat/batch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gameweekId: gw.id,
          stats: [{ playerId: player.id, minutesPlayed: 45, goals: 0 }],
        })
        .expect(201);

      // Другий запит — оновлення (upsert)
      await request(app.getHttpServer())
        .post('/api/player-gameweek-stat/batch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gameweekId: gw.id,
          stats: [{ playerId: player.id, minutesPlayed: 90, goals: 2 }],
        })
        .expect(201);

      const all = await prisma.playerGameweekStat.findMany({
        where: { gameweekId: gw.id, playerId: player.id },
      });
      statStatIds.push(...all.map((s) => s.id));
      // Має бути рівно 1 запис
      expect(all).toHaveLength(1);
      expect(all[0].minutesPlayed).toBe(90);
      expect(all[0].goals).toBe(2);
    });

    it('bulkUpsert: повертає 404 для неіснуючого gameweekId', async () => {
      const adminToken = await makeAdminToken();
      const player = await makePlayer('mid');

      await request(app.getHttpServer())
        .post('/api/player-gameweek-stat/batch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gameweekId: crypto.randomUUID(), // неіснуючий ID
          stats: [{ playerId: player.id, minutesPlayed: 90 }],
        })
        .expect(404);
    });

    it('bulkUpsert: потребує авторизації адміністратора', async () => {
      const gw = await makeGameweek();
      const player = await makePlayer('mid');

      // Без токена
      await request(app.getHttpServer())
        .post('/api/player-gameweek-stat/batch')
        .send({
          gameweekId: gw.id,
          stats: [{ playerId: player.id, minutesPlayed: 90 }],
        })
        .expect(401);

      // Звичайний користувач
      const email = `stat-user-${crypto.randomUUID()}@test.com`;
      const reg = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'TestPassword123!' })
        .expect(201);
      const auth = parseAuthResponse(reg.body);
      createdUserIds.push(auth.userId);

      await request(app.getHttpServer())
        .post('/api/player-gameweek-stat/batch')
        .set('Authorization', `Bearer ${auth.token}`)
        .send({
          gameweekId: gw.id,
          stats: [{ playerId: player.id, minutesPlayed: 90 }],
        })
        .expect(403);
    });

    // ── Dream Team ───────────────────────────────────────────────────────────

    it('getDreamTeam: вибирає 1 GK, 3 DEF, 4 MID, 3 FWD з найбільшою кількістю очок', async () => {
      const gw = await makeGameweek();

      // Створюємо гравців та статистику по позиціям
      const positions = [
        { pos: 'gk' as const, count: 3 },
        { pos: 'def' as const, count: 5 },
        { pos: 'mid' as const, count: 6 },
        { pos: 'fwd' as const, count: 4 },
      ];

      // Для кожної позиції — різні очки, щоб перевірити сортування
      let orderPoints = 30;
      for (const { pos, count } of positions) {
        for (let i = 0; i < count; i++) {
          const player = await makePlayer(pos);
          const stat = await prisma.playerGameweekStat.create({
            data: {
              playerId: player.id,
              gameweekId: gw.id,
              minutesPlayed: 90,
              goals: 0,
              assists: 0,
              cleanSheet: false,
              goalsConceded: 0,
              yellowCards: 0,
              redCards: 0,
              saves: 0,
              points: orderPoints--,
            },
          });
          statStatIds.push(stat.id);
        }
      }

      const res = await request(app.getHttpServer())
        .get(`/api/player-gameweek-stat/gameweek/${gw.id}/dream-team`)
        .expect(200);
      const dreamTeam = parseDreamTeamResponse(res.body);

      expect(dreamTeam.gameweekId).toBe(gw.id);
      expect(dreamTeam.formation).toBe('1-3-4-3');
      expect(dreamTeam.players.goalkeeper).toHaveLength(1);
      expect(dreamTeam.players.defenders).toHaveLength(3);
      expect(dreamTeam.players.midfielders).toHaveLength(4);
      expect(dreamTeam.players.forwards).toHaveLength(3);
    });

    it('getDreamTeam: totalPoints коректно сумується', async () => {
      const gw = await makeGameweek();
      // Один гравець кожної позиції
      const gkPlayer = await makePlayer('gk');
      const defPlayer = await makePlayer('def');
      const midPlayer = await makePlayer('mid');
      const fwdPlayer = await makePlayer('fwd');

      for (const [pl, pts] of [
        [gkPlayer, 10],
        [defPlayer, 8],
        [midPlayer, 7],
        [fwdPlayer, 5],
      ] as [{ id: string }, number][]) {
        const stat = await prisma.playerGameweekStat.create({
          data: {
            playerId: pl.id,
            gameweekId: gw.id,
            minutesPlayed: 90,
            goals: 0,
            assists: 0,
            cleanSheet: false,
            goalsConceded: 0,
            yellowCards: 0,
            redCards: 0,
            saves: 0,
            points: pts,
          },
        });
        statStatIds.push(stat.id);
      }

      const res = await request(app.getHttpServer())
        .get(`/api/player-gameweek-stat/gameweek/${gw.id}/dream-team`)
        .expect(200);

      // 1 GK(10) + 1 DEF(8) + 1 MID(7) + 1 FWD(5) = 30
      // Але формація 1-3-4-3 — якщо гравців менше, беруться всі доступні
      expect(parseDreamTeamResponse(res.body).totalPoints).toBe(30);
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
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
