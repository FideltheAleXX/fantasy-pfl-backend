import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFantasyTeamDto {
  @IsString()
  @IsOptional()
  @MaxLength(30)
  name?: string;
}
