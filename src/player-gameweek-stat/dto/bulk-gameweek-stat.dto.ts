import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PlayerGameweekStatItemDto {
  @IsString()
  @IsNotEmpty()
  playerId!: string;

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

export class BulkGameweekStatDto {
  @IsString()
  @IsNotEmpty()
  gameweekId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlayerGameweekStatItemDto)
  stats!: PlayerGameweekStatItemDto[];
}

