import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateTeamGameweekDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  points?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  pointsOnBench?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  transfersMade?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  transfersCost?: number;

  @IsOptional()
  @IsInt()
  netPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  gameweekRank?: number;
}

