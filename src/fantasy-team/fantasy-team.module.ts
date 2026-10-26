import { Module } from '@nestjs/common';
import { FantasyTeamController } from './fantasy-team.controller';
import { FantasyTeamService } from './fantasy-team.service';

@Module({
  controllers: [FantasyTeamController],
  providers: [FantasyTeamService],
  exports: [FantasyTeamService],
})
export class FantasyTeamModule {}
