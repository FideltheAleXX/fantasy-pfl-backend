import { Module } from '@nestjs/common';
import { FantasyTeamGameweekController } from './fantasy-team-gameweek.controller';
import { FantasyTeamGameweekService } from './fantasy-team-gameweek.service';

@Module({
  controllers: [FantasyTeamGameweekController],
  providers: [FantasyTeamGameweekService],
  exports: [FantasyTeamGameweekService],
})
export class FantasyTeamGameweekModule {}
