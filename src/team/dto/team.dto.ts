import { PlayerDto } from '../../players/dto/player.dto';

export class TeamDto {
  id!: string;
  name!: string;
  shortName!: string;
  badgeUrl?: string | null;
  players?: PlayerDto[];
}
