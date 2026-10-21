import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BulkCreatePicksDto } from './dto/bulk-create-picks.dto';
import { SetLineupDto } from './dto/set-lineup.dto';
import { SetCaptainDto } from './dto/set-captain.dto';
import { TransfersDto } from './dto/transfers.dto';
import { FantasyTeamPickDto } from './dto/fantasy-team-pick.dto';

@Injectable()
export class FantasyTeamPickService {
  constructor(private readonly prisma: PrismaService) {}

  private mapPickToDto(pick: any): FantasyTeamPickDto {
    return {
      id: pick.id,
      fantasyTeamId: pick.fantasyTeamId,
      playerId: pick.playerId,
      isCaptain: pick.isCaptain,
      isViceCaptain: pick.isViceCaptain,
      isBench: pick.isBench,
      orderNumber: pick.orderNumber,
      player: pick.player
        ? {
            ...pick.player,
            price: pick.player.price?.toString?.() ?? String(pick.player.price),
          }
        : undefined,
    };
  }

  private async checkDeadline(): Promise<void> {
    const upcomingGw = await this.prisma.gameweek.findFirst({
      where: { isFinished: false },
      orderBy: { number: 'asc' },
    });

    if (upcomingGw && new Date() > new Date(upcomingGw.deadline)) {
      throw new BadRequestException(
        `Дедлайн для туру ${upcomingGw.number} минув (${upcomingGw.deadline.toISOString()}). Зміни заблоковані.`,
      );
    }
  }

  async findByFantasyTeamId(
    fantasyTeamId: string,
  ): Promise<FantasyTeamPickDto[]> {
    const picks = await this.prisma.fantasyTeamPick.findMany({
      where: { fantasyTeamId },
      include: {
        player: {
          include: {
            team: true,
          },
        },
      },
      orderBy: [{ isBench: 'asc' }, { orderNumber: 'asc' }],
    });

    return picks.map((p) => this.mapPickToDto(p));
  }

  async createBatch(
    fantasyTeamId: string,
    dto: BulkCreatePicksDto,
  ): Promise<FantasyTeamPickDto[]> {
    await this.checkDeadline();

    if (!dto.picks || dto.picks.length !== 15) {
      throw new BadRequestException(
        'Команда повинна складатись рівно з 15 гравців.',
      );
    }

    const playerIds = dto.picks.map((p) => p.playerId);
    if (new Set(playerIds).size !== 15) {
      throw new BadRequestException(
        'У складі не може бути гравців, що повторюються.',
      );
    }

    const orderNumbers = dto.picks.map((pick) => pick.orderNumber);
    if (new Set(orderNumbers).size !== orderNumbers.length) {
      throw new BadRequestException(
        'Номери гравців у складі не можуть повторюватися.',
      );
    }

    const players = await this.prisma.player.findMany({
      where: { id: { in: playerIds } },
      include: { team: true },
    });

    if (players.length !== 15) {
      throw new NotFoundException(
        'Одного або декількох обраних гравців не знайдено.',
      );
    }

    const playerMap = new Map(players.map((p) => [p.id, p]));

    const positionCounts = { gk: 0, def: 0, mid: 0, fwd: 0 };
    const teamCounts = new Map<string, number>();

    for (const player of players) {
      positionCounts[player.position]++;

      const count = (teamCounts.get(player.teamId) || 0) + 1;
      if (count > 3) {
        throw new BadRequestException(
          `Перевищено ліміт: максимум 3 гравці з однієї реальної команди ("${player.team.name}").`,
        );
      }
      teamCounts.set(player.teamId, count);
    }

    if (
      positionCounts.gk !== 2 ||
      positionCounts.def !== 5 ||
      positionCounts.mid !== 5 ||
      positionCounts.fwd !== 3
    ) {
      throw new BadRequestException(
        `Невірний розподіл за позиціями. Необхідно: 2 GK, 5 DEF, 5 MID, 3 FWD. Отримано: ${positionCounts.gk} GK, ${positionCounts.def} DEF, ${positionCounts.mid} MID, ${positionCounts.fwd} FWD.`,
      );
    }

    const starters = dto.picks.filter((p) => !p.isBench);
    const bench = dto.picks.filter((p) => p.isBench);

    if (starters.length !== 11 || bench.length !== 4) {
      throw new BadRequestException(
        'У старті має бути рівно 11 гравців, на лаві запасних — 4.',
      );
    }

    const starterPositions = { gk: 0, def: 0, mid: 0, fwd: 0 };
    for (const pick of starters) {
      const player = playerMap.get(pick.playerId)!;
      starterPositions[player.position]++;
    }

    if (starterPositions.gk !== 1) {
      throw new BadRequestException(
        'У стартовому складі має бути рівно 1 воротар.',
      );
    }
    if (starterPositions.def < 3 || starterPositions.def > 5) {
      throw new BadRequestException(
        `У стартовому складі має бути від 3 до 5 захисників (зараз: ${starterPositions.def}).`,
      );
    }
    if (starterPositions.mid < 2 || starterPositions.mid > 5) {
      throw new BadRequestException(
        `У стартовому складі має бути від 2 до 5 півзахисників (зараз: ${starterPositions.mid}).`,
      );
    }
    if (starterPositions.fwd < 1 || starterPositions.fwd > 3) {
      throw new BadRequestException(
        `У стартовому складі має бути від 1 до 3 нападників (зараз: ${starterPositions.fwd}).`,
      );
    }

    const captains = dto.picks.filter((p) => p.isCaptain);
    const viceCaptains = dto.picks.filter((p) => p.isViceCaptain);

    if (captains.length !== 1 || viceCaptains.length !== 1) {
      throw new BadRequestException(
        'Необхідно обрати рівно 1 капітана та 1 віце-капітана.',
      );
    }

    if (captains[0].playerId === viceCaptains[0].playerId) {
      throw new BadRequestException(
        'Капітан та віце-капітан мають бути різними гравцями.',
      );
    }

    if (captains[0].isBench || viceCaptains[0].isBench) {
      throw new BadRequestException(
        'Капітан і віце-капітан не можуть бути на лаві запасних.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.fantasyTeamPick.deleteMany({
        where: { fantasyTeamId },
      });

      await tx.fantasyTeamPick.createMany({
        data: dto.picks.map((pick) => ({
          fantasyTeamId,
          playerId: pick.playerId,
          isCaptain: Boolean(pick.isCaptain),
          isViceCaptain: Boolean(pick.isViceCaptain),
          isBench: pick.isBench,
          orderNumber: pick.orderNumber,
        })),
      });
    });

    return this.findByFantasyTeamId(fantasyTeamId);
  }

  async updateLineup(
    fantasyTeamId: string,
    dto: SetLineupDto,
  ): Promise<FantasyTeamPickDto[]> {
    await this.checkDeadline();

    const currentPicks = await this.prisma.fantasyTeamPick.findMany({
      where: { fantasyTeamId },
      include: {
        player: true,
      },
    });

    if (currentPicks.length !== 15) {
      throw new NotFoundException(
        `Склад команди "${fantasyTeamId}" не сформований або не містить 15 гравців.`,
      );
    }

    const pickMap = new Map(currentPicks.map((p) => [p.id, { ...p }]));
    const playerToPickMap = new Map(
      currentPicks.map((p) => [p.playerId, p.id]),
    );

    for (const update of dto.picks) {
      const pickId =
        update.pickId ||
        (update.playerId ? playerToPickMap.get(update.playerId) : undefined);

      if (!pickId || !pickMap.has(pickId)) {
        throw new BadRequestException(
          `Пік для оновлення не знайдено: ${update.pickId || update.playerId}`,
        );
      }

      const pick = pickMap.get(pickId)!;
      pick.isBench = update.isBench;
      pick.orderNumber = update.orderNumber;
    }

    const updatedPicks = Array.from(pickMap.values());
    const orderNumbers = updatedPicks.map((pick) => pick.orderNumber);
    if (new Set(orderNumbers).size !== orderNumbers.length) {
      throw new BadRequestException(
        'Номери гравців у складі не можуть повторюватися.',
      );
    }

    const starters = updatedPicks.filter((p) => !p.isBench);
    const bench = updatedPicks.filter((p) => p.isBench);

    if (starters.length !== 11 || bench.length !== 4) {
      throw new BadRequestException(
        `Після змін у старті має бути 11 гравців, а на лаві — 4. Отримано: ${starters.length} в старті та ${bench.length} на лаві.`,
      );
    }

    const starterPositions = { gk: 0, def: 0, mid: 0, fwd: 0 };
    for (const pick of starters) {
      starterPositions[pick.player.position]++;
    }

    if (starterPositions.gk !== 1) {
      throw new BadRequestException(
        'У стартовому складі має бути рівно 1 воротар.',
      );
    }
    if (starterPositions.def < 3 || starterPositions.def > 5) {
      throw new BadRequestException(
        `У стартовому складі має бути від 3 до 5 захисників (зараз: ${starterPositions.def}).`,
      );
    }
    if (starterPositions.mid < 2 || starterPositions.mid > 5) {
      throw new BadRequestException(
        `У стартовому складі має бути від 2 до 5 півзахисників (зараз: ${starterPositions.mid}).`,
      );
    }
    if (starterPositions.fwd < 1 || starterPositions.fwd > 3) {
      throw new BadRequestException(
        `У стартовому складі має бути від 1 до 3 нападників (зараз: ${starterPositions.fwd}).`,
      );
    }

    for (const pick of bench) {
      if (pick.isCaptain) {
        throw new BadRequestException(
          'Капітан не може бути переміщений на лаву запасних. Спочатку призначте іншого капітана.',
        );
      }
      if (pick.isViceCaptain) {
        throw new BadRequestException(
          'Віце-капітан не може бути переміщений на лаву запасних. Спочатку призначте іншого віце-капітана.',
        );
      }
    }

    await this.prisma.$transaction(
      dto.picks.map((update) => {
        const pickId =
          update.pickId ||
          (update.playerId ? playerToPickMap.get(update.playerId) : undefined)!;

        return this.prisma.fantasyTeamPick.update({
          where: { id: pickId },
          data: {
            isBench: update.isBench,
            orderNumber: update.orderNumber,
          },
        });
      }),
    );

    return this.findByFantasyTeamId(fantasyTeamId);
  }

  async setCaptains(
    fantasyTeamId: string,
    dto: SetCaptainDto,
  ): Promise<FantasyTeamPickDto[]> {
    await this.checkDeadline();

    const captainTarget = dto.captainPlayerId || dto.captainId;
    const viceCaptainTarget = dto.viceCaptainPlayerId || dto.viceCaptainId;

    if (!captainTarget || !viceCaptainTarget) {
      throw new BadRequestException(
        'Необхідно вказати ID капітана та віце-капітана.',
      );
    }

    if (captainTarget === viceCaptainTarget) {
      throw new BadRequestException(
        'Капітан та віце-капітан мають бути різними гравцями.',
      );
    }

    const currentPicks = await this.prisma.fantasyTeamPick.findMany({
      where: { fantasyTeamId },
      include: { player: true },
    });

    if (currentPicks.length === 0) {
      throw new NotFoundException(
        `Склад для команди "${fantasyTeamId}" не знайдено.`,
      );
    }

    const captainPick = currentPicks.find(
      (p) => p.id === captainTarget || p.playerId === captainTarget,
    );
    const viceCaptainPick = currentPicks.find(
      (p) => p.id === viceCaptainTarget || p.playerId === viceCaptainTarget,
    );

    if (!captainPick) {
      throw new NotFoundException(
        'Обраного капітана не знайдено у вашому складі.',
      );
    }
    if (!viceCaptainPick) {
      throw new NotFoundException(
        'Обраного віце-капітана не знайдено у вашому складі.',
      );
    }

    if (captainPick.isBench) {
      throw new BadRequestException(
        'Капітан не може перебувати на лаві запасних.',
      );
    }
    if (viceCaptainPick.isBench) {
      throw new BadRequestException(
        'Віце-капітан не може перебувати на лаві запасних.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.fantasyTeamPick.updateMany({
        where: { fantasyTeamId },
        data: { isCaptain: false, isViceCaptain: false },
      }),
      this.prisma.fantasyTeamPick.update({
        where: { id: captainPick.id },
        data: { isCaptain: true },
      }),
      this.prisma.fantasyTeamPick.update({
        where: { id: viceCaptainPick.id },
        data: { isViceCaptain: true },
      }),
    ]);

    return this.findByFantasyTeamId(fantasyTeamId);
  }

  async makeTransfers(
    fantasyTeamId: string,
    dto: TransfersDto,
  ): Promise<FantasyTeamPickDto[]> {
    await this.checkDeadline();

    const pairs: { playerOutId: string; playerInId: string }[] = [];

    if (dto.transfers && dto.transfers.length > 0) {
      pairs.push(...dto.transfers);
    } else if (dto.transfersOut && dto.transfersIn) {
      if (dto.transfersOut.length !== dto.transfersIn.length) {
        throw new BadRequestException(
          'Кількість гравців на вихід (transfersOut) має співпадати з кількістю на вхід (transfersIn).',
        );
      }
      for (let i = 0; i < dto.transfersOut.length; i++) {
        pairs.push({
          playerOutId: dto.transfersOut[i],
          playerInId: dto.transfersIn[i],
        });
      }
    } else {
      throw new BadRequestException('Не передано жодного трансферу.');
    }

    const currentPicks = await this.prisma.fantasyTeamPick.findMany({
      where: { fantasyTeamId },
      include: {
        player: {
          include: {
            team: true,
          },
        },
      },
    });

    if (currentPicks.length !== 15) {
      throw new NotFoundException(
        `Склад команди "${fantasyTeamId}" не містить 15 гравців.`,
      );
    }

    const currentPickPlayerIds = new Set(currentPicks.map((p) => p.playerId));
    const playersInIds = pairs.map((p) => p.playerInId);
    const playersOutIds = pairs.map((p) => p.playerOutId);

    if (new Set(playersOutIds).size !== playersOutIds.length) {
      throw new BadRequestException(
        'Список гравців на вихід містить дублікати.',
      );
    }

    for (const outId of playersOutIds) {
      if (!currentPickPlayerIds.has(outId)) {
        throw new BadRequestException(
          `Гравець з ID "${outId}" не належить вашій команді і не може бути проданий.`,
        );
      }
    }

    const retainedPlayerIds = new Set(
      currentPicks
        .map((p) => p.playerId)
        .filter((id) => !playersOutIds.includes(id)),
    );

    for (const inId of playersInIds) {
      if (retainedPlayerIds.has(inId)) {
        throw new BadRequestException(
          `Гравець з ID "${inId}" вже є у складі вашої команди.`,
        );
      }
    }

    if (new Set(playersInIds).size !== playersInIds.length) {
      throw new BadRequestException(
        'Список придбаних гравців містить дублікати.',
      );
    }

    const incomingPlayers = await this.prisma.player.findMany({
      where: { id: { in: playersInIds } },
      include: { team: true },
    });

    if (incomingPlayers.length !== playersInIds.length) {
      throw new NotFoundException(
        'Одного або більше придбаних гравців не знайдено в базі даних.',
      );
    }

    const incomingPlayerMap = new Map(incomingPlayers.map((p) => [p.id, p]));

    const simulatedPlayers = currentPicks
      .filter((p) => !playersOutIds.includes(p.playerId))
      .map((p) => p.player)
      .concat(incomingPlayers);

    const positionCounts = { gk: 0, def: 0, mid: 0, fwd: 0 };
    const teamCounts = new Map<string, number>();

    for (const player of simulatedPlayers) {
      positionCounts[player.position]++;

      const count = (teamCounts.get(player.teamId) || 0) + 1;
      if (count > 3) {
        throw new BadRequestException(
          `Після трансферів перевищено ліміт: більше 3 гравців з команди "${player.team.name}".`,
        );
      }
      teamCounts.set(player.teamId, count);
    }

    if (
      positionCounts.gk !== 2 ||
      positionCounts.def !== 5 ||
      positionCounts.mid !== 5 ||
      positionCounts.fwd !== 3
    ) {
      throw new BadRequestException(
        `Трансфери порушують баланс позицій (2 GK, 5 DEF, 5 MID, 3 FWD). Отримано: ${positionCounts.gk} GK, ${positionCounts.def} DEF, ${positionCounts.mid} MID, ${positionCounts.fwd} FWD.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const pair of pairs) {
        const pick = currentPicks.find((p) => p.playerId === pair.playerOutId)!;

        await tx.fantasyTeamPick.update({
          where: { id: pick.id },
          data: {
            playerId: pair.playerInId,
            isCaptain: pick.isCaptain ? false : pick.isCaptain,
            isViceCaptain: pick.isViceCaptain ? false : pick.isViceCaptain,
          },
        });
      }
    });

    return this.findByFantasyTeamId(fantasyTeamId);
  }
}
