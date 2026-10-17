import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTeamDto } from './dto/create-team.dto';
import { TeamDto } from './dto/team.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateTeamDto): Promise<TeamDto> {
    const team = await this.prisma.team.create({
      data,
    });
    return team;
  }

  async findAll(): Promise<TeamDto[]> {
    const teams = await this.prisma.team.findMany({
      orderBy: [{ name: 'asc' }],
    });
    return teams;
  }

  async findOne(id: string): Promise<TeamDto> {
    const team = await this.prisma.team.findFirst({
      where: { id },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID "${id}" not found`);
    }
    return team;
  }

  async update(id: string, data: CreateTeamDto): Promise<TeamDto> {
    const team = await this.prisma.team.update({
      where: { id },
      data,
    });
    return team;
  }

  async remove(id: string) {
    await this.prisma.team.delete({
      where: { id },
    });
  }
}
