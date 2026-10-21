import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FantasyTeamPickService } from './fantasy-team-pick.service';
import { SetLineupDto } from './dto/set-lineup.dto';
import { SetCaptainDto } from './dto/set-captain.dto';
import { TransfersDto } from './dto/transfers.dto';
import { BulkCreatePicksDto } from './dto/bulk-create-picks.dto';
import { FantasyTeamPickDto } from './dto/fantasy-team-pick.dto';

@Controller('fantasy-team-pick')
@UseGuards(JwtAuthGuard)
export class FantasyTeamPickController {
  constructor(private readonly pickService: FantasyTeamPickService) {}

  @Get('team/:fantasyTeamId')
  async getTeamPicks(
    @Param('fantasyTeamId') fantasyTeamId: string,
  ): Promise<FantasyTeamPickDto[]> {
    return this.pickService.findByFantasyTeamId(fantasyTeamId);
  }

  @Post('team/:fantasyTeamId/batch')
  async setInitialPicks(
    @Param('fantasyTeamId') fantasyTeamId: string,
    @Body() dto: BulkCreatePicksDto,
  ): Promise<FantasyTeamPickDto[]> {
    return this.pickService.createBatch(fantasyTeamId, dto);
  }

  @Put('team/:fantasyTeamId/lineup')
  async updateLineup(
    @Param('fantasyTeamId') fantasyTeamId: string,
    @Body() dto: SetLineupDto,
  ): Promise<FantasyTeamPickDto[]> {
    return this.pickService.updateLineup(fantasyTeamId, dto);
  }

  @Patch('team/:fantasyTeamId/captain')
  async setCaptains(
    @Param('fantasyTeamId') fantasyTeamId: string,
    @Body() dto: SetCaptainDto,
  ): Promise<FantasyTeamPickDto[]> {
    return this.pickService.setCaptains(fantasyTeamId, dto);
  }

  @Post('team/:fantasyTeamId/transfers')
  async makeTransfers(
    @Param('fantasyTeamId') fantasyTeamId: string,
    @Body() dto: TransfersDto,
  ): Promise<FantasyTeamPickDto[]> {
    return this.pickService.makeTransfers(fantasyTeamId, dto);
  }
}
