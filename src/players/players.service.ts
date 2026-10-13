import { Injectable, NotFoundException } from '@nestjs/common';
import { PlayerDto } from './dto/player.dto';
import { CreatePlayerDto } from './dto/create-player.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<PlayerDto[]> {
    const players = await this.prisma.player.findMany({
      orderBy: [
        {
          lastName: 'asc',
        },
      ],
    });
    return players.map((player) => ({
      ...player,
      price: player.price.toString(),
    }));
  }

  async getOne(id: string): Promise<PlayerDto> {
    const player = await this.prisma.player.findFirst({
      where: { id },
    });

    if (!player) {
      throw new NotFoundException(`Player with ID "${id}" not found`);
    }

    return {
      ...player,
      price: player.price.toString(),
    };
  }
  //TODO
  async createPlayer(data: CreatePlayerDto): Promise<PlayerDto> {
    const { id } = data;

    return this.prisma.player.create({
      data: {
        id,
      },
    });
  }

  //TODO
  async updatePlayer(id: string, data: CreatePlayerDto): Promise<PlayerDto> {
    const { firstName } = data;

    return this.prisma.player.update({
      where: { id },
      data: {
        firstName,
      },
    });
  }

  async deletePlayer(id: string) {
    await this.prisma.player.delete({
      where: { id },
    });
  }
}
