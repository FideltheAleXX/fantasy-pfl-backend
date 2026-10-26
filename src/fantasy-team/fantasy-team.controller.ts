import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { FantasyTeamService } from './fantasy-team.service';
import { CreateFantasyTeamDto } from './dto/create-fantasy-team.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UpdateFantasyTeamDto } from './dto/update-fantasy-team.dto';

@Controller('fantasy-team')
export class FantasyTeamController {
  constructor(private readonly fantasyTeamService: FantasyTeamService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createMyTeam(@Request() req: any, @Body() dto: CreateFantasyTeamDto) {
    const userId = req.user.sub;
    return this.fantasyTeamService.create(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyTeam(@Request() req: any) {
    const userId = req.user.sub;
    return this.fantasyTeamService.findByUserId(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMyTeam(@Request() req: any, @Body() dto: UpdateFantasyTeamDto) {
    const userId = req.user.sub;
    return this.fantasyTeamService.updateByUserId(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/history')
  async getMyHistory(@Request() req: any) {
    const userId = req.user.sub;
    return this.fantasyTeamService.getTeamHistoryByUserId(userId);
  }

  @Get('leaderboard')
  async getLeaderboard(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50,
  ) {
    return this.fantasyTeamService.getLeaderboard(page, limit);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.fantasyTeamService.findOne(id);
  }

  @Get(':id/gameweek/:gameweekId')
  async getTeamGameweek(
    @Param('id') id: string,
    @Param('gameweekId') gameweekId: string,
  ) {
    return this.fantasyTeamService.getTeamGameweekDetails(id, gameweekId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ) {
    return this.fantasyTeamService.findAll({ search, page, limit });
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.fantasyTeamService.remove(id);
  }
}
