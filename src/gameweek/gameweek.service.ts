import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGameweekDto } from './dto/create-gameweek.dto';
import { UpdateGameweekDto } from './dto/update-gameweek.dto';
import { BulkCreateGameweekDto } from './dto/bulk-create-gameweek.dto';
import { CurrentGameweekResponseDto, GameweekDto } from './dto/gameweek.dto';

@Injectable()
export class GameweekService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentGameweek(): Promise<CurrentGameweekResponseDto | null> {
    const currentGw = await this.prisma.gameweek.findFirst({
      where: { isFinished: false },
      orderBy: { number: 'asc' },
    });

    if (!currentGw) {
      const lastGw = await this.prisma.gameweek.findFirst({
        orderBy: { number: 'desc' },
      });

      if (!lastGw) {
        return null;
      }

      return {
        ...lastGw,
        isDeadlinePassed: true,
        secondsUntilDeadline: 0,
        status: 'finished',
      };
    }

    const now = new Date();
    const deadline = new Date(currentGw.deadline);
    const isDeadlinePassed = now > deadline;
    const secondsUntilDeadline = Math.max(
      0,
      Math.floor((deadline.getTime() - now.getTime()) / 1000),
    );

    return {
      ...currentGw,
      isDeadlinePassed,
      secondsUntilDeadline,
      status: isDeadlinePassed ? 'in_progress' : 'upcoming',
    };
  }

  async getNextGameweek(): Promise<GameweekDto | null> {
    const currentGw = await this.prisma.gameweek.findFirst({
      where: { isFinished: false },
      orderBy: { number: 'asc' },
    });

    if (!currentGw) {
      return null;
    }

    return this.prisma.gameweek.findFirst({
      where: {
        number: { gt: currentGw.number },
      },
      orderBy: { number: 'asc' },
    });
  }

  async findAll(isFinished?: boolean): Promise<GameweekDto[]> {
    return this.prisma.gameweek.findMany({
      where: isFinished !== undefined ? { isFinished } : undefined,
      orderBy: { number: 'asc' },
    });
  }

  async findByNumber(number: number): Promise<GameweekDto> {
    const gameweek = await this.prisma.gameweek.findUnique({
      where: { number },
      include: {
        _count: {
          select: {
            playerStats: true,
            teamStats: true,
          },
        },
      },
    });

    if (!gameweek) {
      throw new NotFoundException(`Тур з номером ${number} не знайдено.`);
    }

    return gameweek;
  }

  async findOne(id: string): Promise<GameweekDto> {
    const gameweek = await this.prisma.gameweek.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            playerStats: true,
            teamStats: true,
          },
        },
      },
    });

    if (!gameweek) {
      throw new NotFoundException(`Тур з ID "${id}" не знайдено.`);
    }

    return gameweek;
  }

  //Admin endpoints
  async create(dto: CreateGameweekDto): Promise<GameweekDto> {
    const existing = await this.prisma.gameweek.findUnique({
      where: { number: dto.number },
    });

    if (existing) {
      throw new ConflictException(`Тур з номером ${dto.number} вже існує.`);
    }

    return this.prisma.gameweek.create({
      data: {
        number: dto.number,
        deadline: new Date(dto.deadline),
      },
    });
  }

  async createBatch(dto: BulkCreateGameweekDto): Promise<GameweekDto[]> {
    const numbers = dto.gameweeks.map((g) => g.number);
    if (new Set(numbers).size !== numbers.length) {
      throw new BadRequestException(
        'Список містить тури з однаковими номерами.',
      );
    }

    const existing = await this.prisma.gameweek.findMany({
      where: { number: { in: numbers } },
    });

    if (existing.length > 0) {
      const existingNums = existing.map((e) => e.number).join(', ');
      throw new ConflictException(
        `Тури з наступними номерами вже існують: [${existingNums}].`,
      );
    }

    return this.prisma.$transaction(
      dto.gameweeks.map((g) =>
        this.prisma.gameweek.create({
          data: {
            number: g.number,
            deadline: new Date(g.deadline),
          },
        }),
      ),
    );
  }

  async update(id: string, dto: UpdateGameweekDto): Promise<GameweekDto> {
    const current = await this.findOne(id);

    if (dto.number !== undefined && dto.number !== current.number) {
      const existing = await this.prisma.gameweek.findUnique({
        where: { number: dto.number },
      });
      if (existing) {
        throw new ConflictException(`Тур з номером ${dto.number} вже існує.`);
      }
    }

    return this.prisma.gameweek.update({
      where: { id },
      data: {
        ...(dto.number !== undefined && { number: dto.number }),
        ...(dto.deadline !== undefined && { deadline: new Date(dto.deadline) }),
        ...(dto.isFinished !== undefined && { isFinished: dto.isFinished }),
      },
    });
  }

  async finishGameweek(id: string) {
    const gameweek = await this.prisma.gameweek.findUnique({
      where: { id },
    });

    if (!gameweek) {
      throw new NotFoundException(`Тур з ID "${id}" не знайдено.`);
    }

    if (gameweek.isFinished) {
      throw new BadRequestException(`Тур ${gameweek.number} вже завершено.`);
    }

    const fantasyTeams = await this.prisma.fantasyTeam.findMany({
      include: {
        picks: {
          include: {
            player: {
              include: {
                gameweekStats: {
                  where: { gameweekId: id },
                },
              },
            },
          },
        },
        gameweeks: {
          where: { gameweekId: id },
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
              gameweekId: id,
            },
          },
          create: {
            fantasyTeamId: teamData.fantasyTeamId,
            gameweekId: id,
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
      }

      for (const team of fantasyTeams) {
        const teamGwData = rankedTeams.find((t) => t.fantasyTeamId === team.id);
        const addedPoints = teamGwData?.netPoints ?? 0;
        const currentFreeTransfers = team.freeTransfers ?? 1;
        const newFreeTransfers = Math.min(currentFreeTransfers + 1, 2);

        await tx.fantasyTeam.update({
          where: { id: team.id },
          data: {
            totalPoints: { increment: addedPoints },
            freeTransfers: newFreeTransfers,
          },
        });
      }

      const allTeams = await tx.fantasyTeam.findMany({
        orderBy: { totalPoints: 'desc' },
        select: { id: true },
      });

      for (let i = 0; i < allTeams.length; i++) {
        await tx.fantasyTeam.update({
          where: { id: allTeams[i].id },
          data: { overallRank: i + 1 },
        });
      }

      await tx.gameweek.update({
        where: { id },
        data: { isFinished: true },
      });
    });

    return {
      success: true,
      gameweekId: id,
      gameweekNumber: gameweek.number,
      message: `Тур ${gameweek.number} успішно завершено. Очки та рейтинги оновлено.`,
      teamsProcessed: fantasyTeams.length,
    };
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    const counts = await this.prisma.gameweek.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            playerStats: true,
            teamStats: true,
          },
        },
      },
    });

    if (
      (counts?._count.playerStats ?? 0) > 0 ||
      (counts?._count.teamStats ?? 0) > 0
    ) {
      throw new BadRequestException(
        'Неможливо видалити тур, оскільки він містить повʼязану статистику гравців або команд.',
      );
    }

    await this.prisma.gameweek.delete({ where: { id } });
  }
}
