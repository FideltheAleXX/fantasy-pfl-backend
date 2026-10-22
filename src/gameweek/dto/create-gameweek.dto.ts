import { IsDateString, IsInt, IsNotEmpty, Min } from 'class-validator';

export class CreateGameweekDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  number!: number;

  @IsDateString()
  @IsNotEmpty()
  deadline!: string;
}
