import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePlayerGameweekStatDto {
  @IsString()
  @IsNotEmpty()
  playerId!: string;

  @IsString()
  @IsNotEmpty()
  gameweekId!: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  minutesPlayed?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  goals?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  assists?: number;

  @IsBoolean()
  @IsOptional()
  cleanSheet?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  goalsConceded?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  yellowCards?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  redCards?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  saves?: number;

  @IsInt()
  @IsOptional()
  points?: number;
}

