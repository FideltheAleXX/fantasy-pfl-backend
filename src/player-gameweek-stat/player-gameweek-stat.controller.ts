import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PlayerGameweekStatService } from './player-gameweek-stat.service';
import { PlayerGameweekStatDto } from './dto/player-gameweek-stat.dto';
import { CreatePlayerGameweekStatDto } from './dto/create-player-gameweek-stat.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BulkGameweekStatDto } from './dto/bulk-gameweek-stat.dto';

@Controller('player-gameweek-stat')
export class PlayerGameweekStatController {
  constructor(private readonly statService: PlayerGameweekStatService) {}

  @Get()
  async getStats(
    @Query('gameweekId') gameweekId?: string,
    @Query('playerId') playerId?: string,
  ): Promise<PlayerGameweekStatDto[]> {
    return this.statService.findStats({ gameweekId, playerId });
  }

  @Get('player/:playerId')
  async getByPlayer(
    @Param('playerId') playerId: string,
  ): Promise<PlayerGameweekStatDto[]> {
    return this.statService.findByPlayerId(playerId);
  }

  @Get('player/:playerId/gameweek/:gameweekId')
  async getByPlayerAndGameweek(
    @Param('playerId') playerId: string,
    @Param('gameweekId') gameweekId: string,
  ): Promise<PlayerGameweekStatDto> {
    return this.statService.findByPlayerAndGameweek(playerId, gameweekId);
  }

  @Get('gameweek/:gameweekId/dream-team')
  async getDreamTeam(@Param('gameweekId') gameweekId: string) {
    return this.statService.getDreamTeam(gameweekId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('batch')
  async bulkUpsert(@Body() dto: BulkGameweekStatDto) {
    return this.statService.bulkUpsert(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('gameweek/:gameweekId/calculate-points')
  @HttpCode(HttpStatus.OK)
  async calculateGameweekPoints(@Param('gameweekId') gameweekId: string) {
    return this.statService.calculatePointsForGameweek(gameweekId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  async create(@Body() dto: CreatePlayerGameweekStatDto) {
    return this.statService.create(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreatePlayerGameweekStatDto>,
  ) {
    return this.statService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    return this.statService.delete(id);
  }
}
