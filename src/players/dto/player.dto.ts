import { PlayerStatus, Position } from '../../generated/prisma/enums';
import { TeamDto } from '../../team/dto/team.dto';

export class PlayerDto {
  id!: string;
  firstName!: string;
  lastName!: string;
  displayName!: string;
  photoUrl?: string | null;
  jerseyNumber?: number | null;
  position!: Position;
  price!: string;
  status!: PlayerStatus;
  statusDescription?: string | null;
  chanceOfPlaying?: number | null;
  totalPoints!: number;
  form!: number;
  selectedByPercent!: number;
  teamId!: string;
  team?: TeamDto;
  // gameweekStats: PlayerGameweekStat[];
  // fantasyTeamPicks: FantasyTeamPick[];
}
