import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { TeamDto } from './dto/team.dto';

@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  async create(@Body() data: CreateTeamDto): Promise<TeamDto> {
    return this.teamService.create(data);
  }

  @Get()
  async findAll(): Promise<TeamDto[]> {
    return this.teamService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.teamService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: CreateTeamDto,
  ): Promise<TeamDto> {
    return this.teamService.update(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.teamService.remove(id);
  }
}
