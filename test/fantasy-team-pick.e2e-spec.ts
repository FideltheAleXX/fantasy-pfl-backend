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

describe('FantasyTeamPickController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
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
    prisma = app.get(PrismaService);
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
