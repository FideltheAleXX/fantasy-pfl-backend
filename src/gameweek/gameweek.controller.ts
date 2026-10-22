import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { GameweekService } from './gameweek.service';
import { CreateGameweekDto } from './dto/create-gameweek.dto';
import { UpdateGameweekDto } from './dto/update-gameweek.dto';
import { BulkCreateGameweekDto } from './dto/bulk-create-gameweek.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('gameweek')
export class GameweekController {
  constructor(private readonly gameweekService: GameweekService) {}

  @Get('current')
  async getCurrentGameweek() {
    return this.gameweekService.getCurrentGameweek();
  }

  @Get('next')
  async getNextGameweek() {
    return this.gameweekService.getNextGameweek();
  }

  @Get()
  async findAll(@Query('isFinished') isFinished?: string) {
    const finishedFilter =
      isFinished !== undefined ? isFinished === 'true' : undefined;
    return this.gameweekService.findAll(finishedFilter);
  }

  @Get('number/:number')
  async findByNumber(@Param('number', ParseIntPipe) number: number) {
    return this.gameweekService.findByNumber(number);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.gameweekService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  async create(@Body() dto: CreateGameweekDto) {
    return this.gameweekService.create(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('batch')
  async createBatch(@Body() dto: BulkCreateGameweekDto) {
    return this.gameweekService.createBatch(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateGameweekDto) {
    return this.gameweekService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post(':id/finish')
  @HttpCode(HttpStatus.OK)
  async finishGameweek(@Param('id') id: string) {
    return this.gameweekService.finishGameweek(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.gameweekService.remove(id);
  }
}
