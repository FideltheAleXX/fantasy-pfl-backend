import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateFantasyTeamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  name!: string;
}
