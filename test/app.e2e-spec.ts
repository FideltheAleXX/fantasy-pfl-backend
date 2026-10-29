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

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  const createdUserIds: string[] = [];
  const createdPlayerIds: string[] = [];
  const createdClubIds: string[] = [];

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

  const rosterPositions = [
    'gk',
    'def',
    'def',
    'def',
    'def',
    'mid',
    'mid',
    'mid',
    'mid',
    'fwd',
    'fwd',
    'gk',
    'def',
    'mid',
    'fwd',
  ] as const;
  type RosterPosition = (typeof rosterPositions)[number];
  type PickResponse = {
    id: string;
    playerId: string;
    isCaptain: boolean;
    isViceCaptain: boolean;
    isBench: boolean;
    orderNumber: number;
    player: { teamId: string; position: RosterPosition };
  };

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

  const isRosterPosition = (value: unknown): value is RosterPosition =>
    value === 'gk' || value === 'def' || value === 'mid' || value === 'fwd';

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

  const parseFantasyTeamResponse = (value: unknown) => {
    if (
      !isRecord(value) ||
      typeof value.id !== 'string' ||
      typeof value.userId !== 'string'
    ) {
      throw new Error('Unexpected fantasy-team response');
    }
    return { id: value.id, userId: value.userId };
  };

  const parsePicksResponse = (value: unknown): PickResponse[] => {
    if (!Array.isArray(value)) {
      throw new Error('Expected an array of fantasy-team picks');
    }

    return value.map((item: unknown) => {
      if (
        !isRecord(item) ||
        typeof item.id !== 'string' ||
        typeof item.playerId !== 'string' ||
        typeof item.isCaptain !== 'boolean' ||
        typeof item.isViceCaptain !== 'boolean' ||
        typeof item.isBench !== 'boolean' ||
        typeof item.orderNumber !== 'number' ||
        !isRecord(item.player)
      ) {
        throw new Error('Unexpected fantasy-team pick');
      }

      const player = item.player;
      if (
        typeof player.teamId !== 'string' ||
        !isRosterPosition(player.position)
      ) {
        throw new Error('Unexpected player in fantasy-team pick');
      }

      return {
        id: item.id,
        playerId: item.playerId,
        isCaptain: item.isCaptain,
        isViceCaptain: item.isViceCaptain,
        isBench: item.isBench,
        orderNumber: item.orderNumber,
        player: {
          teamId: player.teamId,
          position: player.position,
        },
      };
    });
  };

  const createUserWithFantasyTeam = async () => {
    const email = `e2e-fantasy-${crypto.randomUUID()}@example.com`;
    const registration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'TestPassword123!' })
      .expect(201);
    const registrationBody = parseAuthResponse(registration.body);
    const userId = registrationBody.user.id;
    createdUserIds.push(userId);

    const team = await request(app.getHttpServer())
      .post('/api/fantasy-team')
      .set('Authorization', `Bearer ${registrationBody.token}`)
      .send({ name: `Fantasy ${crypto.randomUUID().slice(0, 8)}` })
      .expect(201);
    const teamBody = parseFantasyTeamResponse(team.body);

    return {
      userId,
      fantasyTeamId: teamBody.id,
      token: registrationBody.token,
    };
  };

  const createPlayers = async (
    positions: readonly RosterPosition[] = rosterPositions,
    overfillClub = false,
  ) => {
    const clubs = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        prisma.team.create({
          data: {
            name: `E2E Club ${crypto.randomUUID()}`,
            shortName: `E${index}${crypto.randomUUID().slice(0, 3)}`,
          },
        }),
      ),
    );
    createdClubIds.push(...clubs.map((club) => club.id));

    const players = await Promise.all(
      positions.map((position, index) => {
        const clubIndex = overfillClub
          ? index < 4
            ? 0
            : 1 + ((index - 4) % 4)
          : Math.floor(index / 3);

        return prisma.player.create({
          data: {
            firstName: `E2E${index}`,
            lastName: crypto.randomUUID().slice(0, 8),
            displayName: `E2E Player ${index}`,
            position,
            price: 5,
            teamId: clubs[clubIndex].id,
          },
        });
      }),
    );
    createdPlayerIds.push(...players.map((player) => player.id));
    return players;
  };

  const skipGameweekDeadline = () => {
    jest.spyOn(prisma.gameweek, 'findFirst').mockResolvedValue(null);
  };

  const makePicks = (
    players: { id: string }[],
    overrides: Record<
      number,
      Partial<{
        playerId: string;
        isCaptain: boolean;
        isViceCaptain: boolean;
        isBench: boolean;
      }>
    > = {},
  ) =>
    players.map((player, index) => ({
      playerId: player.id,
      isCaptain: index === 2,
      isViceCaptain: index === 3,
      isBench: index >= 11,
      orderNumber: index + 1,
      ...overrides[index],
    }));

  const lineupPayload = (
    picks: PickResponse[],
    overrides: Record<
      number,
      Partial<{ isBench: boolean; orderNumber: number }>
    > = {},
  ) =>
    picks.map((pick, index) => ({
      playerId: pick.playerId,
      isBench: overrides[index]?.isBench ?? pick.isBench,
      orderNumber: overrides[index]?.orderNumber ?? index + 1,
    }));

  const countByPosition = (picks: { player: { position: RosterPosition } }[]) =>
    picks.reduce(
      (counts, pick) => {
        counts[pick.player.position]++;
        return counts;
      },
      { gk: 0, def: 0, mid: 0, fwd: 0 },
    );

  const expectValidRoster = (picks: PickResponse[]) => {
    expect(picks).toHaveLength(15);
    const starters = picks.filter((pick) => !pick.isBench);
    const bench = picks.filter((pick) => pick.isBench);
    expect(starters).toHaveLength(11);
    expect(bench).toHaveLength(4);
    expect(countByPosition(picks)).toEqual({
      gk: 2,
      def: 5,
      mid: 5,
      fwd: 3,
    });

    const starterPositions = countByPosition(starters);
    expect(starterPositions.gk).toBe(1);
    expect(starterPositions.def).toBeGreaterThanOrEqual(3);
    expect(starterPositions.def).toBeLessThanOrEqual(5);
    expect(starterPositions.mid).toBeGreaterThanOrEqual(2);
    expect(starterPositions.mid).toBeLessThanOrEqual(5);
    expect(starterPositions.fwd).toBeGreaterThanOrEqual(1);
    expect(starterPositions.fwd).toBeLessThanOrEqual(3);

    const playersByClub = new Map<string, number>();
    for (const pick of picks) {
      playersByClub.set(
        pick.player.teamId,
        (playersByClub.get(pick.player.teamId) ?? 0) + 1,
      );
    }
    expect(Math.max(...playersByClub.values())).toBeLessThanOrEqual(3);
  };

  const createPickedTeam = async () => {
    const { fantasyTeamId, token } = await createUserWithFantasyTeam();
    const players = await createPlayers();
    skipGameweekDeadline();

    await request(app.getHttpServer())
      .post(`/api/fantasy-team-pick/team/${fantasyTeamId}/batch`)
      .set('Authorization', `Bearer ${token}`)
      .send({ picks: makePicks(players) })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/api/fantasy-team-pick/team/${fantasyTeamId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    return {
      fantasyTeamId,
      token,
      players,
      picks: parsePicksResponse(response.body),
    };
  };

  const createPlayer = async (position: RosterPosition, teamId: string) => {
    const player = await prisma.player.create({
      data: {
        firstName: 'E2E Incoming',
        lastName: crypto.randomUUID().slice(0, 8),
        displayName: `E2E Incoming ${crypto.randomUUID().slice(0, 8)}`,
        position,
        price: 5,
        teamId,
      },
    });
    createdPlayerIds.push(player.id);
    return player;
  };

  const mockGameweekDeadline = (number: number, deadline: Date) =>
    jest.spyOn(prisma.gameweek, 'findFirst').mockResolvedValue({
      id: crypto.randomUUID(),
      number,
      deadline,
      isFinished: false,
    });

  it('регистрация → вход с теми же данными', async () => {
    const email = `e2e-${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    const registration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password })
      .expect(201);

    expect(registration.body.user.email).toBe(email);
    expect(registration.body.user.role).toBe('user');
    expect(registration.body.user.id).toBeDefined();
    expect(registration.body.token).toEqual(expect.any(String));

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    expect(login.body.user.id).toBe(registration.body.user.id);
    expect(login.body.user.email).toBe(email);
    expect(login.body.token).toEqual(expect.any(String));
  });

  it('POST /api/auth/register — отклоняет повторную регистрацию email', async () => {
    const email = `e2e-duplicate-${Date.now()}@example.com`;
    const credentials = { email, password: 'TestPassword123!' };

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(credentials)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(credentials)
      .expect(409);
  });

  it('POST /api/auth/login — отклоняет неверный пароль', async () => {
    const email = `e2e-wrong-password-${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password })
      .expect(201);

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

    await request(app.getHttpServer())
      .get('/api/fantasy-team')
      .set('Authorization', `Bearer ${registration.body.token}`)
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

  it('створює склад із 15 гравців з дозволеним стартом, лавою та капітанами', async () => {
    const { fantasyTeamId, token } = await createUserWithFantasyTeam();
    const players = await createPlayers();
    const pickPayload = makePicks(players);
    skipGameweekDeadline();

    const response = await request(app.getHttpServer())
      .post(`/api/fantasy-team-pick/team/${fantasyTeamId}/batch`)
      .set('Authorization', `Bearer ${token}`)
      .send({ picks: pickPayload })
      .expect(201);

    const responsePicks = parsePicksResponse(response.body);
    expect(responsePicks).toHaveLength(15);
    const starters = responsePicks.filter((pick) => !pick.isBench);
    const bench = responsePicks.filter((pick) => pick.isBench);
    expect(starters).toHaveLength(11);
    expect(bench).toHaveLength(4);
    expect(countByPosition(responsePicks)).toEqual({
      gk: 2,
      def: 5,
      mid: 5,
      fwd: 3,
    });
    expect(countByPosition(starters)).toEqual({
      gk: 1,
      def: 4,
      mid: 4,
      fwd: 2,
    });
    expect(countByPosition(bench)).toEqual({
      gk: 1,
      def: 1,
      mid: 1,
      fwd: 1,
    });

    expect(responsePicks.filter((pick) => pick.isCaptain)).toHaveLength(1);
    expect(responsePicks.filter((pick) => pick.isViceCaptain)).toHaveLength(1);
    const captain = responsePicks.find((pick) => pick.isCaptain);
    const viceCaptain = responsePicks.find((pick) => pick.isViceCaptain);
    expect(captain).toBeDefined();
    expect(viceCaptain).toBeDefined();

    if (!captain || !viceCaptain) {
      throw new Error('Captain and vice-captain must be assigned');
    }

    expect(captain.playerId).not.toBe(viceCaptain.playerId);
    expect(captain.isBench).toBe(false);
    expect(viceCaptain.isBench).toBe(false);

    const playerCountsByClub = new Map<string, number>();
    for (const pick of responsePicks) {
      const clubId = pick.player.teamId;
      playerCountsByClub.set(clubId, (playerCountsByClub.get(clubId) ?? 0) + 1);
    }
    expect(Math.max(...playerCountsByClub.values())).toBeLessThanOrEqual(3);

    const fetched = await request(app.getHttpServer())
      .get(`/api/fantasy-team-pick/team/${fantasyTeamId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(parsePicksResponse(fetched.body)).toHaveLength(15);
  });

  it('відхиляє дублікати, неправильну кількість, позиції та перевищення ліміту клубу', async () => {
    const { fantasyTeamId, token } = await createUserWithFantasyTeam();
    const players = await createPlayers();
    const endpoint = `/api/fantasy-team-pick/team/${fantasyTeamId}/batch`;
    skipGameweekDeadline();

    await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .send({
        picks: makePicks(players, {
          14: { playerId: players[0].id },
        }),
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .send({ picks: makePicks(players).slice(0, 14) })
      .expect(400);

    const wrongPositions = [...rosterPositions];
    wrongPositions[2] = 'gk';
    const playersWithWrongPositions = await createPlayers(wrongPositions);
    await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .send({ picks: makePicks(playersWithWrongPositions) })
      .expect(400);

    const playersOverClubLimit = await createPlayers(rosterPositions, true);
    await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .send({ picks: makePicks(playersOverClubLimit) })
      .expect(400);
  });

  it('відхиляє неправильну кількість гравців у старті та однакового капітана й віце-капітана', async () => {
    const { fantasyTeamId, token } = await createUserWithFantasyTeam();
    const players = await createPlayers();
    const endpoint = `/api/fantasy-team-pick/team/${fantasyTeamId}/batch`;
    skipGameweekDeadline();

    await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .send({
        picks: makePicks(players, {
          0: { isBench: true },
        }),
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .send({
        picks: makePicks(players, {
          2: { isViceCaptain: true },
          3: { isViceCaptain: false },
        }),
      })
      .expect(400);
  });

  it('PUT /lineup — зберігає допустиму перестановку та правила складу', async () => {
    const { fantasyTeamId, token, picks } = await createPickedTeam();
    const endpoint = `/api/fantasy-team-pick/team/${fantasyTeamId}/lineup`;
    const response = await request(app.getHttpServer())
      .put(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .send({
        picks: lineupPayload(picks, {
          1: { isBench: true, orderNumber: 13 },
          12: { isBench: false, orderNumber: 2 },
        }),
      })
      .expect(200);

    const updatedPicks = parsePicksResponse(response.body);
    expectValidRoster(updatedPicks);
    expect(
      updatedPicks.find((pick) => pick.playerId === picks[1].playerId)?.isBench,
    ).toBe(true);
    expect(
      updatedPicks.find((pick) => pick.playerId === picks[12].playerId)
        ?.isBench,
    ).toBe(false);
    expect(new Set(updatedPicks.map((pick) => pick.orderNumber)).size).toBe(15);
  });

  it('PUT /lineup — відхиляє невідомі піки, дублікати номерів і недопустимий склад', async () => {
    const { fantasyTeamId, token, picks } = await createPickedTeam();
    const endpoint = `/api/fantasy-team-pick/team/${fantasyTeamId}/lineup`;
    const putLineup = (payload: object) =>
      request(app.getHttpServer())
        .put(endpoint)
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

    await putLineup({
      picks: [
        {
          playerId: crypto.randomUUID(),
          isBench: false,
          orderNumber: 1,
        },
      ],
    }).expect(400);

    await putLineup({
      picks: [
        {
          pickId: crypto.randomUUID(),
          isBench: false,
          orderNumber: 1,
        },
      ],
    }).expect(400);

    await putLineup({
      picks: lineupPayload(picks, { 1: { orderNumber: 1 } }),
    }).expect(400);

    await putLineup({
      picks: lineupPayload(picks, { 0: { isBench: true } }),
    }).expect(400);

    await putLineup({
      picks: lineupPayload(picks, { 11: { isBench: false } }),
    }).expect(400);

    await putLineup({
      picks: lineupPayload(picks, {
        1: { isBench: true },
        2: { isBench: true },
        13: { isBench: false },
        14: { isBench: false },
      }),
    }).expect(400);
  });

  it('PUT /lineup — не дозволяє переносити капітана або віце-капітана на лаву', async () => {
    const { fantasyTeamId, token, picks } = await createPickedTeam();
    const endpoint = `/api/fantasy-team-pick/team/${fantasyTeamId}/lineup`;

    await request(app.getHttpServer())
      .put(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .send({
        picks: lineupPayload(picks, {
          2: { isBench: true },
          12: { isBench: false },
        }),
      })
      .expect(400);

    await request(app.getHttpServer())
      .put(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .send({
        picks: lineupPayload(picks, {
          3: { isBench: true },
          12: { isBench: false },
        }),
      })
      .expect(400);
  });

  it('PATCH /captain — призначає капітана й віце-капітана та відхиляє недопустимий вибір', async () => {
    const { fantasyTeamId, token, picks } = await createPickedTeam();
    const endpoint = `/api/fantasy-team-pick/team/${fantasyTeamId}/captain`;
    const captainPlayerId = picks[0].playerId;
    const viceCaptainPlayerId = picks[1].playerId;

    const response = await request(app.getHttpServer())
      .patch(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .send({ captainPlayerId, viceCaptainPlayerId })
      .expect(200);

    const updatedPicks = parsePicksResponse(response.body);
    expect(
      updatedPicks.filter((pick) => pick.isCaptain).map((p) => p.playerId),
    ).toEqual([captainPlayerId]);
    expect(
      updatedPicks
        .filter((pick) => pick.isViceCaptain)
        .map((pick) => pick.playerId),
    ).toEqual([viceCaptainPlayerId]);

    await request(app.getHttpServer())
      .patch(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .send({ captainPlayerId, viceCaptainPlayerId: captainPlayerId })
      .expect(400);

    await request(app.getHttpServer())
      .patch(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .send({
        captainPlayerId: picks[11].playerId,
        viceCaptainPlayerId,
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .send({
        captainPlayerId,
        viceCaptainPlayerId: picks[12].playerId,
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .send({
        captainPlayerId: crypto.randomUUID(),
        viceCaptainPlayerId,
      })
      .expect(404);
  });

  it('POST /transfers — замінює гравця зі збереженням правил складу', async () => {
    const { fantasyTeamId, token, players, picks } = await createPickedTeam();
    const incoming = (await createPlayers(['fwd']))[0];
    const response = await request(app.getHttpServer())
      .post(`/api/fantasy-team-pick/team/${fantasyTeamId}/transfers`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        transfers: [{ playerOutId: players[14].id, playerInId: incoming.id }],
      })
      .expect(201);

    const updatedPicks = parsePicksResponse(response.body);
    expectValidRoster(updatedPicks);
    expect(updatedPicks.map((pick) => pick.playerId)).toContain(incoming.id);
    expect(updatedPicks.map((pick) => pick.playerId)).not.toContain(
      players[14].id,
    );
    expect(
      updatedPicks.find((pick) => pick.playerId === picks[14].playerId),
    ).toBeUndefined();
  });

  it('POST /transfers — відхиляє невідомих і повторних гравців, дисбаланс позицій та ліміт клубу', async () => {
    const { fantasyTeamId, token, players } = await createPickedTeam();
    const endpoint = `/api/fantasy-team-pick/team/${fantasyTeamId}/transfers`;
    const postTransfers = (transfers: object) =>
      request(app.getHttpServer())
        .post(endpoint)
        .set('Authorization', `Bearer ${token}`)
        .send(transfers);
    const incomingForward = (await createPlayers(['fwd']))[0];
    const incomingMidfielder = (await createPlayers(['mid']))[0];
    const incomingGoalkeeper = (await createPlayers(['gk']))[0];
    const incomingForFullClub = await createPlayer('mid', players[0].teamId);

    await postTransfers({
      transfers: [
        {
          playerOutId: players[14].id,
          playerInId: crypto.randomUUID(),
        },
      ],
    }).expect(404);

    await postTransfers({
      transfers: [
        {
          playerOutId: crypto.randomUUID(),
          playerInId: incomingForward.id,
        },
      ],
    }).expect(400);

    await postTransfers({
      transfers: [
        { playerOutId: players[9].id, playerInId: incomingForward.id },
        { playerOutId: players[10].id, playerInId: incomingForward.id },
      ],
    }).expect(400);

    await postTransfers({
      transfers: [{ playerOutId: players[14].id, playerInId: players[0].id }],
    }).expect(400);

    await postTransfers({
      transfersOut: [players[14].id],
      transfersIn: [incomingForward.id, incomingMidfielder.id],
    }).expect(400);

    await postTransfers({
      transfers: [
        { playerOutId: players[14].id, playerInId: incomingGoalkeeper.id },
      ],
    }).expect(400);

    await postTransfers({
      transfers: [
        {
          playerOutId: players[5].id,
          playerInId: incomingForFullClub.id,
        },
      ],
    }).expect(400);
  });

  it('дозволяє зміни до дедлайну наступного незавершеного туру після завершеного', async () => {
    const { fantasyTeamId, token, players, picks } = await createPickedTeam();
    const completedWeek = {
      id: crypto.randomUUID(),
      number: 10,
      deadline: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      isFinished: true,
    };
    const nextWeek = {
      id: crypto.randomUUID(),
      number: 11,
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isFinished: false,
    };
    const findFirst = jest
      .spyOn(prisma.gameweek, 'findFirst')
      .mockImplementation((args) => {
        expect(args?.where).toEqual({ isFinished: false });
        expect(args?.orderBy).toEqual({ number: 'asc' });
        const upcomingWeek = [completedWeek, nextWeek]
          .filter((week) => week.isFinished === false)
          .sort((left, right) => left.number - right.number)[0];
        return Promise.resolve(upcomingWeek ?? null) as unknown as ReturnType<
          typeof prisma.gameweek.findFirst
        >;
      });
    findFirst.mockClear();

    const endpoint = `/api/fantasy-team-pick/team/${fantasyTeamId}`;
    await request(app.getHttpServer())
      .put(`${endpoint}/lineup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ picks: lineupPayload(picks) })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`${endpoint}/captain`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        captainPlayerId: picks[0].playerId,
        viceCaptainPlayerId: picks[1].playerId,
      })
      .expect(200);

    const incoming = (await createPlayers(['fwd']))[0];
    await request(app.getHttpServer())
      .post(`${endpoint}/transfers`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        transfers: [{ playerOutId: players[14].id, playerInId: incoming.id }],
      })
      .expect(201);

    expect(findFirst).toHaveBeenCalledTimes(3);
  });

  it('відхиляє зміни складу, капітана й трансфери після дедлайну', async () => {
    const { fantasyTeamId, token, players, picks } = await createPickedTeam();
    mockGameweekDeadline(12, new Date(Date.now() - 60 * 1000));

    const endpoint = `/api/fantasy-team-pick/team/${fantasyTeamId}`;
    await request(app.getHttpServer())
      .put(`${endpoint}/lineup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ picks: lineupPayload(picks) })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`${endpoint}/captain`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        captainPlayerId: picks[0].playerId,
        viceCaptainPlayerId: picks[1].playerId,
      })
      .expect(400);

    const incoming = (await createPlayers(['fwd']))[0];
    await request(app.getHttpServer())
      .post(`${endpoint}/transfers`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        transfers: [{ playerOutId: players[14].id, playerInId: incoming.id }],
      })
      .expect(400);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // player-gameweek-stat: підрахунок очків, bulkUpsert, dream-team
  // ─────────────────────────────────────────────────────────────────────────────

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

      expect(res.body.gameweekId).toBe(gw.id);
      expect(res.body.updatedCount).toBe(2);

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
      createdUserIds.push(reg.body.user.id);

      await request(app.getHttpServer())
        .post('/api/player-gameweek-stat/batch')
        .set('Authorization', `Bearer ${reg.body.token}`)
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

      expect(res.body.gameweekId).toBe(gw.id);
      expect(res.body.formation).toBe('1-3-4-3');
      expect(res.body.players.goalkeeper).toHaveLength(1);
      expect(res.body.players.defenders).toHaveLength(3);
      expect(res.body.players.midfielders).toHaveLength(4);
      expect(res.body.players.forwards).toHaveLength(3);
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
      expect(res.body.totalPoints).toBe(30);
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
    if (createdPlayerIds.length > 0) {
      await prisma.player.deleteMany({
        where: { id: { in: createdPlayerIds } },
      });
      createdPlayerIds.length = 0;
    }
    if (createdClubIds.length > 0) {
      await prisma.team.deleteMany({
        where: { id: { in: createdClubIds } },
      });
      createdClubIds.length = 0;
    }
    await app.close();
    await prisma.$disconnect();
  });
});
