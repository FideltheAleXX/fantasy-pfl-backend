import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class LineupPickItemDto {
  @IsString()
  @IsOptional()
  pickId?: string;

  @IsString()
  @IsOptional()
  playerId?: string;

  @IsBoolean()
  isBench!: boolean;

  @IsInt()
  @Min(1)
  @Max(15)
  orderNumber!: number;
}

export class SetLineupDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineupPickItemDto)
  picks!: LineupPickItemDto[];
}

