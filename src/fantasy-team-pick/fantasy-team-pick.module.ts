import { Module } from '@nestjs/common';
import { FantasyTeamPickService } from './fantasy-team-pick.service';
import { FantasyTeamPickController } from './fantasy-team-pick.controller';

@Module({
  controllers: [FantasyTeamPickController],
  providers: [FantasyTeamPickService],
  exports: [FantasyTeamPickService],
})
export class FantasyTeamPickModule {}
