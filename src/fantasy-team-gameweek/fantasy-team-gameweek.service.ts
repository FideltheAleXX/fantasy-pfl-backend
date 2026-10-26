import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTeamGameweekDto } from './dto/update-team-gameweek.dto';

@Injectable()
export class FantasyTeamGameweekService {
  constructor(private readonly prisma: PrismaService) {}

  async getGameweekLeaderboard(
    gameweekId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const gameweek = await this.prisma.gameweek.findUnique({
      where: { id: gameweekId },
    });

    if (!gameweek) {
      throw new NotFoundException(`Тур з ID "${gameweekId}" не знайдено.`);
    }

    const currentPage = Math.max(1, page || 1);
    const currentLimit = Math.max(1, Math.min(100, limit || 50));
    const skip = (currentPage - 1) * currentLimit;

    const [total, items] = await Promise.all([
      this.prisma.fantasyTeamGameweek.count({ where: { gameweekId } }),
      this.prisma.fantasyTeamGameweek.findMany({
        where: { gameweekId },
        skip,
        take: currentLimit,
        orderBy: [
          { netPoints: 'desc' },
          { pointsOnBench: 'desc' },
          { createdAt: 'asc' },
        ],
        include: {
          fantasyTeam: {
            select: {
              id: true,
              name: true,
              userId: true,
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
          gameweek: {
            select: {
              id: true,
              number: true,
              deadline: true,
              isFinished: true,
            },
          },
        },
      }),
    ]);

    return {
      gameweekId,
      gameweekNumber: gameweek.number,
      items: items.map((item, index) => ({
        ...item,
        gameweekRank: item.gameweekRank ?? skip + index + 1,
      })),
      meta: {
        total,
        page: currentPage,
        limit: currentLimit,
        totalPages: Math.ceil(total / currentLimit),
      },
    };
  }

  async getGameweekStats(gameweekId: string) {
    const gameweek = await this.prisma.gameweek.findUnique({
      where: { id: gameweekId },
    });

    if (!gameweek) {
      throw new NotFoundException(`Тур з ID "${gameweekId}" не знайдено.`);
    }

    const teamStats = await this.prisma.fantasyTeamGameweek.findMany({
      where: { gameweekId },
      include: {
        fantasyTeam: {
          select: { id: true, name: true },
        },
      },
      orderBy: { netPoints: 'desc' },
    });

    if (teamStats.length === 0) {
      return {
        gameweekId,
        gameweekNumber: gameweek.number,
        averagePoints: 0,
        highestPoints: 0,
        lowestPoints: 0,
        totalTeams: 0,
        totalTransfers: 0,
        highestScoringTeam: null,
      };
    }

    const totalPoints = teamStats.reduce((sum, t) => sum + t.netPoints, 0);
    const totalTransfers = teamStats.reduce(
      (sum, t) => sum + t.transfersMade,
      0,
    );
    const averagePoints =
      Math.round((totalPoints / teamStats.length) * 10) / 10;
    const highestScoringTeam = teamStats[0];
    const lowestPoints = teamStats[teamStats.length - 1].netPoints;

    return {
      gameweekId,
      gameweekNumber: gameweek.number,
      averagePoints,
      highestPoints: highestScoringTeam.netPoints,
      lowestPoints,
      totalTeams: teamStats.length,
      totalTransfers,
      highestScoringTeam: {
        id: highestScoringTeam.fantasyTeam.id,
        name: highestScoringTeam.fantasyTeam.name,
        points: highestScoringTeam.netPoints,
      },
    };
  }

  async getMyCurrentGameweek(userId: string) {
    const team = await this.prisma.fantasyTeam.findUnique({
      where: { userId },
    });

    if (!team) {
      throw new NotFoundException(
        'Фентезі команду для цього користувача не знайдено.',
      );
    }

    let currentGw = await this.prisma.gameweek.findFirst({
      where: { isFinished: false },
      orderBy: { number: 'asc' },
    });

    if (!currentGw) {
      currentGw = await this.prisma.gameweek.findFirst({
        orderBy: { number: 'desc' },
      });
    }

    if (!currentGw) {
      throw new NotFoundException('Тури ще не створені.');
    }

    const teamGw = await this.prisma.fantasyTeamGameweek.findUnique({
      where: {
        fantasyTeamId_gameweekId: {
          fantasyTeamId: team.id,
          gameweekId: currentGw.id,
        },
      },
      include: {
        gameweek: true,
        fantasyTeam: true,
      },
    });

    return (
      teamGw || {
        fantasyTeamId: team.id,
        gameweekId: currentGw.id,
        gameweek: currentGw,
        points: 0,
        pointsOnBench: 0,
        transfersMade: 0,
        transfersCost: 0,
        netPoints: 0,
        gameweekRank: null,
      }
    );
  }

  async getTeamGameweeks(fantasyTeamId: string) {
    const team = await this.prisma.fantasyTeam.findUnique({
      where: { id: fantasyTeamId },
    });

    if (!team) {
      throw new NotFoundException(
        `Фентезі команду з ID "${fantasyTeamId}" не знайдено.`,
      );
    }

    return this.prisma.fantasyTeamGameweek.findMany({
      where: { fantasyTeamId },
      include: {
        gameweek: true,
      },
      orderBy: {
        gameweek: {
          number: 'asc',
        },
      },
    });
  }

  async getTeamGameweek(fantasyTeamId: string, gameweekId: string) {
    const item = await this.prisma.fantasyTeamGameweek.findUnique({
      where: {
        fantasyTeamId_gameweekId: {
          fantasyTeamId,
          gameweekId,
        },
      },
      include: {
        gameweek: true,
        fantasyTeam: true,
      },
    });

    if (!item) {
      throw new NotFoundException(
        'Дані для цієї команди в обраному турі не знайдено.',
      );
    }

    return item;
  }

  async update(id: string, dto: UpdateTeamGameweekDto) {
    const existing = await this.prisma.fantasyTeamGameweek.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Запис з ID "${id}" не знайдено.`);
    }

    const points = dto.points ?? existing.points;
    const transfersCost = dto.transfersCost ?? existing.transfersCost;
    const netPoints =
      dto.netPoints !== undefined ? dto.netPoints : points - transfersCost;

    return this.prisma.fantasyTeamGameweek.update({
      where: { id },
      data: {
        ...dto,
        netPoints,
      },
      include: {
        gameweek: true,
        fantasyTeam: true,
      },
    });
  }

  async recalculate(gameweekId: string) {
    const gameweek = await this.prisma.gameweek.findUnique({
      where: { id: gameweekId },
    });

    if (!gameweek) {
      throw new NotFoundException(`Тур з ID "${gameweekId}" не знайдено.`);
    }

    const fantasyTeams = await this.prisma.fantasyTeam.findMany({
      include: {
        picks: {
          include: {
            player: {
              include: {
                gameweekStats: {
                  where: { gameweekId },
                },
              },
            },
          },
        },
        gameweeks: {
          where: { gameweekId },
        },
      },
    });

    const calculatedTeams = fantasyTeams.map((team) => {
      let starterPoints = 0;
      let benchPoints = 0;

      const captainPick = team.picks.find((p) => p.isCaptain);
      const viceCaptainPick = team.picks.find((p) => p.isViceCaptain);

      const captainStats = captainPick?.player.gameweekStats[0];
      const captainPlayed = (captainStats?.minutesPlayed ?? 0) > 0;

      const activeCaptainId = captainPlayed
        ? captainPick?.playerId
        : viceCaptainPick?.playerId;

      for (const pick of team.picks) {
        const stats = pick.player.gameweekStats[0];
        const rawPoints = stats?.points ?? 0;
        const isDouble = pick.playerId === activeCaptainId;
        const playerFinalPoints = isDouble ? rawPoints * 2 : rawPoints;

        if (pick.isBench) {
          benchPoints += playerFinalPoints;
        } else {
          starterPoints += playerFinalPoints;
        }
      }

      const existingGwStat = team.gameweeks[0];
      const transfersCost = existingGwStat?.transfersCost ?? 0;
      const transfersMade = existingGwStat?.transfersMade ?? 0;
      const netPoints = starterPoints - transfersCost;

      return {
        fantasyTeamId: team.id,
        points: starterPoints,
        pointsOnBench: benchPoints,
        transfersMade,
        transfersCost,
        netPoints,
        previousNetPoints: existingGwStat?.netPoints ?? 0,
      };
    });

    calculatedTeams.sort((a, b) => b.netPoints - a.netPoints);
    const rankedTeams = calculatedTeams.map((team, index) => ({
      ...team,
      gameweekRank: index + 1,
    }));

    await this.prisma.$transaction(async (tx) => {
      for (const teamData of rankedTeams) {
        await tx.fantasyTeamGameweek.upsert({
          where: {
            fantasyTeamId_gameweekId: {
              fantasyTeamId: teamData.fantasyTeamId,
              gameweekId,
            },
          },
          create: {
            fantasyTeamId: teamData.fantasyTeamId,
            gameweekId,
            points: teamData.points,
            pointsOnBench: teamData.pointsOnBench,
            transfersMade: teamData.transfersMade,
            transfersCost: teamData.transfersCost,
            netPoints: teamData.netPoints,
            gameweekRank: teamData.gameweekRank,
          },
          update: {
            points: teamData.points,
            pointsOnBench: teamData.pointsOnBench,
            transfersMade: teamData.transfersMade,
            transfersCost: teamData.transfersCost,
            netPoints: teamData.netPoints,
            gameweekRank: teamData.gameweekRank,
          },
        });

        const pointsDiff = teamData.netPoints - teamData.previousNetPoints;
        if (pointsDiff !== 0) {
          await tx.fantasyTeam.update({
            where: { id: teamData.fantasyTeamId },
            data: {
              totalPoints: { increment: pointsDiff },
            },
          });
        }
      }

      const allTeams = await tx.fantasyTeam.findMany({
        orderBy: [{ totalPoints: 'desc' }, { createdAt: 'asc' }],
        select: { id: true },
      });

      for (let i = 0; i < allTeams.length; i++) {
        await tx.fantasyTeam.update({
          where: { id: allTeams[i].id },
          data: { overallRank: i + 1 },
        });
      }
    });

    return {
      success: true,
      gameweekId,
      gameweekNumber: gameweek.number,
      message: `Тур ${gameweek.number} успішно перераховано.`,
      teamsProcessed: fantasyTeams.length,
    };
  }
}
