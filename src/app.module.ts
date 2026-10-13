import { Module } from '@nestjs/common';
import { PlayersModule } from './players/players.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, PlayersModule],
})
export class AppModule {}
