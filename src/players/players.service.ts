import { Injectable, NotFoundException } from '@nestjs/common';
import { PlayerDto } from './dto/player.dto';
import { CreatePlayerDto } from './dto/create-player.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}
  private toDto(player: any): PlayerDto {
    return {
      ...player,
      price: player.price.toString(),
    };
  }

  async getAll(): Promise<PlayerDto[]> {
    const players = await this.prisma.player.findMany({
      orderBy: [
        {
          lastName: 'asc',
        },
      ],
    });
    return players.map((player) => this.toDto(player));
  }

  async getOne(id: string): Promise<PlayerDto> {
    const player = await this.prisma.player.findFirst({
      where: { id },
    });

    if (!player) {
      throw new NotFoundException(`Player with ID "${id}" not found`);
    }

    return this.toDto(player);
  }

  async createPlayer(data: CreatePlayerDto): Promise<PlayerDto> {
    const player = await this.prisma.player.create({
      data,
    });
    return this.toDto(player);
  }

  async updatePlayer(id: string, data: CreatePlayerDto): Promise<PlayerDto> {
    const player = await this.prisma.player.update({
      where: { id },
      data,
    });
    return this.toDto(player);
  }

  async deletePlayer(id: string) {
    await this.prisma.player.delete({
      where: { id },
    });
  }
}
