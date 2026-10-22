import { Module } from '@nestjs/common';
import { GameweekController } from './gameweek.controller';
import { GameweekService } from './gameweek.service';

@Module({
  controllers: [GameweekController],
  providers: [GameweekService]
})
export class GameweekModule {}
