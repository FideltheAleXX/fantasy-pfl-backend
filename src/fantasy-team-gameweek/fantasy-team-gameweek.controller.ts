import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { FantasyTeamGameweekService } from './fantasy-team-gameweek.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UpdateTeamGameweekDto } from './dto/update-team-gameweek.dto';

@Controller('fantasy-team-gameweek')
export class FantasyTeamGameweekController {
  constructor(private readonly service: FantasyTeamGameweekService) {}

  @Get('gameweek/:gameweekId/leaderboard')
  async getGameweekLeaderboard(
    @Param('gameweekId') gameweekId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50,
  ) {
    return this.service.getGameweekLeaderboard(gameweekId, page, limit);
  }

  @Get('gameweek/:gameweekId/stats')
  async getGameweekStats(@Param('gameweekId') gameweekId: string) {
    return this.service.getGameweekStats(gameweekId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/current')
  async getMyCurrentGameweek(@Request() req: any) {
    const userId = req.user.sub;
    return this.service.getMyCurrentGameweek(userId);
  }

  @Get('team/:fantasyTeamId')
  async getTeamGameweeks(@Param('fantasyTeamId') fantasyTeamId: string) {
    return this.service.getTeamGameweeks(fantasyTeamId);
  }

  @Get('team/:fantasyTeamId/gameweek/:gameweekId')
  async getTeamGameweek(
    @Param('fantasyTeamId') fantasyTeamId: string,
    @Param('gameweekId') gameweekId: string,
  ) {
    return this.service.getTeamGameweek(fantasyTeamId, gameweekId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTeamGameweekDto) {
    return this.service.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('gameweek/:gameweekId/recalculate')
  @HttpCode(HttpStatus.OK)
  async recalculate(@Param('gameweekId') gameweekId: string) {
    return this.service.recalculate(gameweekId);
  }
}
