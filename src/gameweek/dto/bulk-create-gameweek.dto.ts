import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateGameweekDto } from './create-gameweek.dto';

export class BulkCreateGameweekDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGameweekDto)
  gameweeks!: CreateGameweekDto[];
}
