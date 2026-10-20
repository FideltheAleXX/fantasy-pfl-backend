import { Module } from '@nestjs/common';
import { PlayerGameweekStatService } from './player-gameweek-stat.service';
import { PlayerGameweekStatController } from './player-gameweek-stat.controller';

@Module({
  providers: [PlayerGameweekStatService],
  controllers: [PlayerGameweekStatController]
})
export class PlayerGameweekStatModule {}
