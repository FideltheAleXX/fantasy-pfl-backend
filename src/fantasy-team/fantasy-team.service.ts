import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFantasyTeamDto } from './dto/create-fantasy-team.dto';
import { UpdateFantasyTeamDto } from './dto/update-fantasy-team.dto';

@Injectable()
export class FantasyTeamService {
  constructor(private readonly prisma: PrismaService) {}

  private formatTeam(team: any) {
    if (!team) return null;
    return {
      ...team,
      bank:
        team.bank !== undefined && team.bank !== null
          ? team.bank.toString()
          : '100.0',
      teamValue:
        team.teamValue !== undefined && team.teamValue !== null
          ? team.teamValue.toString()
          : '100.0',
      picks: team.picks
        ? team.picks.map((pick: any) => ({
            ...pick,
            player: pick.player
              ? {
                  ...pick.player,
                  price:
                    pick.player.price !== undefined &&
                    pick.player.price !== null
                      ? pick.player.price.toString()
                      : undefined,
                }
              : undefined,
          }))
        : undefined,
    };
  }

  async create(userId: string, dto: CreateFantasyTeamDto) {
    const existingTeam = await this.prisma.fantasyTeam.findUnique({
      where: { userId },
    });

    if (existingTeam) {
      throw new ConflictException('У вас вже є створена фентезі команда.');
    }

    const trimmedName = dto.name.trim();

    const nameExists = await this.prisma.fantasyTeam.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
      },
    });

    if (nameExists) {
      throw new ConflictException(
        `Команда з назвою "${trimmedName}" вже існує.`,
      );
    }

    const team = await this.prisma.fantasyTeam.create({
      data: {
        userId,
        name: trimmedName,
        bank: 100.0,
        teamValue: 100.0,
        freeTransfers: 1,
        totalPoints: 0,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return this.formatTeam(team);
  }

  async findByUserId(userId: string) {
    const team = await this.prisma.fantasyTeam.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        picks: {
          include: {
            player: {
              include: {
                team: true,
              },
            },
          },
          orderBy: [{ isBench: 'asc' }, { orderNumber: 'asc' }],
        },
        gameweeks: {
          include: {
            gameweek: true,
          },
          orderBy: {
            gameweek: {
              number: 'desc',
            },
          },
          take: 5,
        },
      },
    });

    if (!team) {
      throw new NotFoundException(
        'Фентезі команду для цього користувача не знайдено.',
      );
    }

    return this.formatTeam(team);
  }

  async updateByUserId(userId: string, dto: UpdateFantasyTeamDto) {
    const team = await this.prisma.fantasyTeam.findUnique({
      where: { userId },
    });

    if (!team) {
      throw new NotFoundException('Фентезі команду не знайдено.');
    }

    if (dto.name) {
      const trimmedName = dto.name.trim();
      if (trimmedName !== team.name) {
        const nameExists = await this.prisma.fantasyTeam.findFirst({
          where: {
            name: {
              equals: trimmedName,
              mode: 'insensitive',
            },
            NOT: { id: team.id },
          },
        });

        if (nameExists) {
          throw new ConflictException(
            `Команда з назвою "${trimmedName}" вже існує.`,
          );
        }
      }

      const updated = await this.prisma.fantasyTeam.update({
        where: { userId },
        data: {
          name: trimmedName,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      return this.formatTeam(updated);
    }

    return this.formatTeam(team);
  }

  async getTeamHistoryByUserId(userId: string) {
    const team = await this.prisma.fantasyTeam.findUnique({
      where: { userId },
      select: {
        id: true,
        name: true,
        totalPoints: true,
        overallRank: true,
      },
    });

    if (!team) {
      throw new NotFoundException('Фентезі команду не знайдено.');
    }

    const history = await this.prisma.fantasyTeamGameweek.findMany({
      where: { fantasyTeamId: team.id },
      include: {
        gameweek: {
          select: {
            id: true,
            number: true,
            deadline: true,
            isFinished: true,
          },
        },
      },
      orderBy: {
        gameweek: {
          number: 'asc',
        },
      },
    });

    return {
      team,
      history,
    };
  }

  async getLeaderboard(page: number = 1, limit: number = 50) {
    const currentPage = Math.max(1, page || 1);
    const currentLimit = Math.max(1, Math.min(100, limit || 50));
    const skip = (currentPage - 1) * currentLimit;

    const [total, teams] = await Promise.all([
      this.prisma.fantasyTeam.count(),
      this.prisma.fantasyTeam.findMany({
        skip,
        take: currentLimit,
        orderBy: [{ totalPoints: 'desc' }, { createdAt: 'asc' }],
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return {
      items: teams.map((team, index) => ({
        ...this.formatTeam(team),
        rank: team.overallRank ?? skip + index + 1,
      })),
      meta: {
        total,
        page: currentPage,
        limit: currentLimit,
        totalPages: Math.ceil(total / currentLimit),
      },
    };
  }

  async findOne(id: string) {
    const team = await this.prisma.fantasyTeam.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        picks: {
          include: {
            player: {
              include: {
                team: true,
              },
            },
          },
          orderBy: [{ isBench: 'asc' }, { orderNumber: 'asc' }],
        },
        gameweeks: {
          include: {
            gameweek: true,
          },
          orderBy: {
            gameweek: {
              number: 'desc',
            },
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Фентезі команду з ID "${id}" не знайдено.`);
    }

    return this.formatTeam(team);
  }

  async getTeamGameweekDetails(id: string, gameweekId: string) {
    const gameweek = await this.prisma.gameweek.findUnique({
      where: { id: gameweekId },
    });

    if (!gameweek) {
      throw new NotFoundException(`Тур з ID "${gameweekId}" не знайдено.`);
    }

    const team = await this.prisma.fantasyTeam.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        picks: {
          include: {
            player: {
              include: {
                team: true,
                gameweekStats: {
                  where: { gameweekId },
                },
              },
            },
          },
          orderBy: [{ isBench: 'asc' }, { orderNumber: 'asc' }],
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Фентезі команду з ID "${id}" не знайдено.`);
    }

    const gameweekStat = await this.prisma.fantasyTeamGameweek.findUnique({
      where: {
        fantasyTeamId_gameweekId: {
          fantasyTeamId: id,
          gameweekId,
        },
      },
    });

    const captainPick = team.picks.find((p) => p.isCaptain);
    const viceCaptainPick = team.picks.find((p) => p.isViceCaptain);

    const captainStats = captainPick?.player.gameweekStats[0];
    const captainPlayed = (captainStats?.minutesPlayed ?? 0) > 0;

    const activeCaptainId = captainPlayed
      ? captainPick?.playerId
      : viceCaptainPick?.playerId;

    const formattedPicks = team.picks.map((pick) => {
      const stat = pick.player.gameweekStats[0] || null;
      const rawPoints = stat?.points ?? 0;
      const isDoubled = pick.playerId === activeCaptainId;
      const finalPoints = isDoubled ? rawPoints * 2 : rawPoints;

      return {
        id: pick.id,
        fantasyTeamId: pick.fantasyTeamId,
        playerId: pick.playerId,
        isCaptain: pick.isCaptain,
        isViceCaptain: pick.isViceCaptain,
        isActiveCaptain: isDoubled,
        isBench: pick.isBench,
        orderNumber: pick.orderNumber,
        points: finalPoints,
        player: {
          ...pick.player,
          price:
            pick.player.price !== undefined && pick.player.price !== null
              ? pick.player.price.toString()
              : undefined,
          gameweekStat: stat,
        },
      };
    });

    return {
      team: {
        id: team.id,
        name: team.name,
        user: team.user,
        totalPoints: team.totalPoints,
        overallRank: team.overallRank,
      },
      gameweek,
      summary: gameweekStat || {
        points: 0,
        pointsOnBench: 0,
        transfersMade: 0,
        transfersCost: 0,
        netPoints: 0,
        gameweekRank: null,
      },
      picks: formattedPicks,
    };
  }

  async findAll(params: { search?: string; page?: number; limit?: number }) {
    const { search, page = 1, limit = 20 } = params;
    const currentPage = Math.max(1, page || 1);
    const currentLimit = Math.max(1, Math.min(100, limit || 20));
    const skip = (currentPage - 1) * currentLimit;

    const where: any = {};
    if (search && search.trim() !== '') {
      const trimmed = search.trim();
      where.OR = [
        { name: { contains: trimmed, mode: 'insensitive' } },
        { user: { email: { contains: trimmed, mode: 'insensitive' } } },
      ];
    }

    const [total, teams] = await Promise.all([
      this.prisma.fantasyTeam.count({ where }),
      this.prisma.fantasyTeam.findMany({
        where,
        skip,
        take: currentLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
            },
          },
          _count: {
            select: {
              picks: true,
              gameweeks: true,
            },
          },
        },
      }),
    ]);

    return {
      items: teams.map((team) => this.formatTeam(team)),
      meta: {
        total,
        page: currentPage,
        limit: currentLimit,
        totalPages: Math.ceil(total / currentLimit),
      },
    };
  }

  async remove(id: string): Promise<void> {
    const team = await this.prisma.fantasyTeam.findUnique({
      where: { id },
    });

    if (!team) {
      throw new NotFoundException(`Фентезі команду з ID "${id}" не знайдено.`);
    }

    await this.prisma.fantasyTeam.delete({
      where: { id },
    });
  }
}
