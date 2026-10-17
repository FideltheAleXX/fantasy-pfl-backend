import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PlayerDto } from '../../players/dto/player.dto';

export class CreateTeamDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  shortName!: string;

  @IsString()
  @IsOptional()
  badgeUrl?: string | null;
}
