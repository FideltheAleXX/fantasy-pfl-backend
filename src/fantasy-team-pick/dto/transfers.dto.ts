import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SingleTransferDto {
  @IsString()
  @IsNotEmpty()
  playerOutId!: string;

  @IsString()
  @IsNotEmpty()
  playerInId!: string;
}

export class TransfersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SingleTransferDto)
  @IsOptional()
  transfers?: SingleTransferDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  transfersOut?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  transfersIn?: string[];
}

