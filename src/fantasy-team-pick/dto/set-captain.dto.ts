import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SetCaptainDto {
  @IsString()
  @IsOptional()
  captainId?: string;

  @IsString()
  @IsOptional()
  captainPlayerId?: string;

  @IsString()
  @IsOptional()
  viceCaptainId?: string;

  @IsString()
  @IsOptional()
  viceCaptainPlayerId?: string;
}

