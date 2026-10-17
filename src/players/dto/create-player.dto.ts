import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { PlayerStatus, Position } from '../../generated/prisma/enums';
import { TeamDto } from '../../team/dto/team.dto';

export class CreatePlayerDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsString()
  @IsOptional()
  photoUrl?: string;

  @IsInt()
  @IsOptional()
  jerseyNumber?: number;

  @IsEnum(Position)
  position!: Position;

  @IsString()
  @IsNotEmpty()
  price!: string;

  @IsEnum(PlayerStatus)
  status!: PlayerStatus;

  @IsString()
  @IsOptional()
  statusDescription?: string;

  @IsInt()
  @IsOptional()
  chanceOfPlaying?: number;

  @IsInt()
  totalPoints!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  form!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  selectedByPercent!: number;

  @IsString()
  @IsNotEmpty()
  teamId!: string;
}
