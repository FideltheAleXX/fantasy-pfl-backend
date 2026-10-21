import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreatePickItemDto {
  @IsString()
  @IsNotEmpty()
  playerId!: string;

  @IsBoolean()
  @IsOptional()
  isCaptain?: boolean = false;

  @IsBoolean()
  @IsOptional()
  isViceCaptain?: boolean = false;

  @IsBoolean()
  isBench!: boolean;

  @IsInt()
  @Min(1)
  @Max(15)
  orderNumber!: number;
}

export class BulkCreatePicksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePickItemDto)
  picks!: CreatePickItemDto[];
}

