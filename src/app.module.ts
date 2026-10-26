import { Module } from '@nestjs/common';
import { PlayersModule } from './players/players.module';
import { PrismaModule } from './prisma/prisma.module';
import { TeamModule } from './team/team.module';
import { PlayerGameweekStatModule } from './player-gameweek-stat/player-gameweek-stat.module';
import { GameweekModule } from './gameweek/gameweek.module';
import { FantasyTeamPickModule } from './fantasy-team-pick/fantasy-team-pick.module';
import { AuthModule } from './auth/auth.module';
import { FantasyTeamModule } from './fantasy-team/fantasy-team.module';
import { FantasyTeamGameweekModule } from './fantasy-team-gameweek/fantasy-team-gameweek.module';

@Module({
  imports: [
    PrismaModule,
    PlayersModule,
    TeamModule,
    PlayerGameweekStatModule,
    GameweekModule,
    FantasyTeamPickModule,
    AuthModule,
    FantasyTeamModule,
    FantasyTeamGameweekModule,
  ],
  providers: [],
  controllers: [],
})
export class AppModule {}
