import { FantasyTeamPickDto } from '../../fantasy-team-pick/dto/fantasy-team-pick.dto';

export class FantasyTeamUserDto {
  id!: string;
  email!: string;
  role?: string;
  status?: string;
}

export class FantasyTeamDto {
  id!: string;
  name!: string;
  userId!: string;
  user?: FantasyTeamUserDto;
  bank!: string;
  teamValue!: string;
  totalPoints!: number;
  overallRank?: number | null;
  freeTransfers!: number;
  picks?: FantasyTeamPickDto[];
  gameweeks?: any[];
  _count?: {
    picks?: number;
    gameweeks?: number;
  };
  createdAt!: Date;
  updatedAt!: Date;
}

