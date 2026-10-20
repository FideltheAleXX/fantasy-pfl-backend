import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerGameweekStatDto } from './dto/player-gameweek-stat.dto';
import { CreatePlayerGameweekStatDto } from './dto/create-player-gameweek-stat.dto';
import { BulkGameweekStatDto } from './dto/bulk-gameweek-stat.dto';
import { Position } from '../generated/prisma/enums';

@Injectable()
export class PlayerGameweekStatService {
  constructor(private readonly prisma: PrismaService) {}

  // Отримання стати
  async findStats(filter: {
    gameweekId?: string;
    playerId?: string;
  }): Promise<PlayerGameweekStatDto[]> {
    const where: { gameweekId?: string; playerId?: string } = {};
    if (filter.gameweekId) where.gameweekId = filter.gameweekId;
    if (filter.playerId) where.playerId = filter.playerId;

    return this.prisma.playerGameweekStat.findMany({
      where,
      orderBy: { points: 'desc' },
    });
  }

  // Історія турів для гравця
  async findByPlayerId(playerId: string): Promise<PlayerGameweekStatDto[]> {
    return this.prisma.playerGameweekStat.findMany({
      where: { playerId },
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

  // Дкталі гравця за тур
  async findByPlayerAndGameweek(
    playerId: string,
    gameweekId: string,
  ): Promise<PlayerGameweekStatDto> {
    const stat = await this.prisma.playerGameweekStat.findUnique({
      where: {
        playerId_gameweekId: { playerId, gameweekId },
      },
      include: {
        player: true,
        gameweek: true,
      },
    });

    if (!stat) {
      throw new NotFoundException(
        `Stat for player "${playerId}" in gameweek "${gameweekId}" not found`,
      );
    }

    return stat;
  }

  // Кращі гравці туру
  async getDreamTeam(gameweekId: string) {
    const stats = await this.prisma.playerGameweekStat.findMany({
      where: { gameweekId },
      include: {
        player: {
          include: {
            team: true,
          },
        },
      },
      orderBy: { points: 'desc' },
    });

    const gks = stats.filter((s) => s.player.position === Position.gk);
    const defs = stats.filter((s) => s.player.position === Position.def);
    const mids = stats.filter((s) => s.player.position === Position.mid);
    const fwds = stats.filter((s) => s.player.position === Position.fwd);

    const teamPlayers = [
      ...gks.slice(0, 1),
      ...defs.slice(0, 3),
      ...mids.slice(0, 4),
      ...fwds.slice(0, 3),
    ];

    return {
      gameweekId,
      formation: '1-3-4-3',
      totalPoints: teamPlayers.reduce((sum, s) => sum + s.points, 0),
      players: {
        goalkeeper: gks.slice(0, 1),
        defenders: defs.slice(0, 3),
        midfielders: mids.slice(0, 4),
        forwards: fwds.slice(0, 3),
      },
    };
  }

  // Оновлення стати
  async bulkUpsert(dto: BulkGameweekStatDto) {
    const { gameweekId, stats } = dto;

    const gameweek = await this.prisma.gameweek.findUnique({
      where: { id: gameweekId },
    });

    if (!gameweek) {
      throw new NotFoundException(`Gameweek with ID "${gameweekId}" not found`);
    }

    const operations = stats.map((item) =>
      this.prisma.playerGameweekStat.upsert({
        where: {
          playerId_gameweekId: {
            playerId: item.playerId,
            gameweekId,
          },
        },
        update: {
          ...item,
        },
        create: {
          ...item,
          gameweekId,
        },
      }),
    );

    const results = await this.prisma.$transaction(operations);

    return {
      gameweekId,
      updatedCount: results.length,
      stats: results,
    };
  }

  // Підрахунок очків
  async calculatePointsForGameweek(gameweekId: string) {
    const stats = await this.prisma.playerGameweekStat.findMany({
      where: { gameweekId },
      include: { player: true },
    });

    if (!stats.length) {
      return {
        gameweekId,
        message: 'No stats found for this gameweek',
        updatedCount: 0,
      };
    }

    for (const stat of stats) {
      const points = this.calculateStatPoints(stat, stat.player.position);

      await this.prisma.playerGameweekStat.update({
        where: { id: stat.id },
        data: { points },
      });

      await this.syncPlayerTotalAndForm(stat.playerId);
    }

    return {
      gameweekId,
      message: 'Points calculated successfully',
      updatedCount: stats.length,
    };
  }

  async create(
    dto: CreatePlayerGameweekStatDto,
  ): Promise<PlayerGameweekStatDto> {
    return this.prisma.playerGameweekStat.create({
      data: dto,
    });
  }

  async update(
    id: string,
    dto: Partial<CreatePlayerGameweekStatDto>,
  ): Promise<PlayerGameweekStatDto> {
    const stat = await this.prisma.playerGameweekStat.findUnique({
      where: { id },
    });

    if (!stat) {
      throw new NotFoundException(`Stat with ID "${id}" not found`);
    }

    return this.prisma.playerGameweekStat.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string): Promise<void> {
    const stat = await this.prisma.playerGameweekStat.findUnique({
      where: { id },
    });

    if (!stat) {
      throw new NotFoundException(`Stat with ID "${id}" not found`);
    }

    await this.prisma.playerGameweekStat.delete({
      where: { id },
    });
  }

  private calculateStatPoints(
    stat: {
      minutesPlayed: number;
      goals: number;
      assists: number;
      cleanSheet: boolean;
      goalsConceded: number;
      yellowCards: number;
      redCards: number;
      saves: number;
    },
    position: Position,
  ): number {
    let pts = 0;

    // Очки за хвилини
    if (stat.minutesPlayed >= 60) {
      pts += 2;
    } else if (stat.minutesPlayed > 0) {
      pts += 1;
    }

    // Очки за голи
    if (position === Position.gk || position === Position.def) {
      pts += stat.goals * 6;
    } else if (position === Position.mid) {
      pts += stat.goals * 5;
    } else if (position === Position.fwd) {
      pts += stat.goals * 4;
    }

    // Асисти
    pts += stat.assists * 3;

    // Сухарі
    if (stat.cleanSheet && stat.minutesPlayed >= 60) {
      if (position === Position.gk || position === Position.def) {
        pts += 4;
      } else if (position === Position.mid) {
        pts += 1;
      }
    }

    // Пропущені
    if (position === Position.gk || position === Position.def) {
      pts -= Math.floor(stat.goalsConceded / 2);
    }

    // Картки
    pts -= stat.yellowCards * 1;
    pts -= stat.redCards * 3;

    // Сейви
    if (position === Position.gk) {
      pts += Math.floor(stat.saves / 3);
    }

    return pts;
  }

  private async syncPlayerTotalAndForm(playerId: string): Promise<void> {
    const allStats = await this.prisma.playerGameweekStat.findMany({
      where: { playerId },
      include: { gameweek: true },
      orderBy: { gameweek: { number: 'desc' } },
    });

    const totalPoints = allStats.reduce((sum, s) => sum + s.points, 0);

    const lastStats = allStats.slice(0, 5);
    const form =
      lastStats.length > 0
        ? Number(
            (
              lastStats.reduce((sum, s) => sum + s.points, 0) / lastStats.length
            ).toFixed(1),
          )
        : 0.0;

    await this.prisma.player.update({
      where: { id: playerId },
      data: {
        totalPoints,
        form,
      },
    });
  }
}
