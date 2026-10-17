import { Module } from '@nestjs/common';
import { PlayersModule } from './players/players.module';
import { PrismaModule } from './prisma/prisma.module';
import { TeamModule } from './team/team.module';
import { PlayerGameweekStatModule } from './player-gameweek-stat/player-gameweek-stat.module';
import { GameweekModule } from './gameweek/gameweek.module';
import { FantasyTeamPickModule } from './fantasy-team-pick/fantasy-team-pick.module';

import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    PlayersModule,
    TeamModule,
    PlayerGameweekStatModule,
    GameweekModule,
    FantasyTeamPickModule,
    UsersModule,
  ],
  providers: [],
  controllers: [],
})
export class AppModule {}
