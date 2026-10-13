import { PlayerStatus, Position } from '../../generated/prisma/enums';

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
  // team!: Team[];
  // gameweekStats: PlayerGameweekStat[];
  // fantasyTeamPicks: FantasyTeamPick[];
}
