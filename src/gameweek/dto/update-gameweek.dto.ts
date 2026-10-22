import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateGameweekDto } from './create-gameweek.dto';

export class UpdateGameweekDto extends PartialType(CreateGameweekDto) {
  @IsBoolean()
  @IsOptional()
  isFinished?: boolean;
}
