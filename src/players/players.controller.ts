import {
  Controller,
  Get,
  Post,
  Param,
  Put,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PlayersService } from './players.service';
import { PlayerDto } from './dto/player.dto';
import { CreatePlayerDto } from './dto/create-player.dto';

@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  async getAllPlayers(): Promise<PlayerDto[]> {
    return this.playersService.getAll();
  }

  @Get(':id')
  async getOnePlayer(@Param('id') id: string) {
    return this.playersService.getOne(id);
  }

  @Post()
  async createPlayer(@Body() data: CreatePlayerDto): Promise<PlayerDto> {
    return this.playersService.createPlayer(data);
  }

  @Put(':id')
  async updatePlayer(
    @Param('id') id: string,
    @Body() data: CreatePlayerDto,
  ): Promise<PlayerDto> {
    return this.playersService.updatePlayer(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePlayer(@Param('id') id: string): Promise<void> {
    await this.playersService.deletePlayer(id);
  }
}
