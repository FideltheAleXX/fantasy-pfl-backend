export class GameweekShortDto {
  id!: string;
  number!: number;
  deadline!: Date;
  isFinished!: boolean;
}

export class FantasyTeamShortDto {
  id!: string;
  name!: string;
  userId!: string;
  user?: {
    id: string;
    email: string;
  };
}

export class FantasyTeamGameweekDto {
  id!: string;
  fantasyTeamId!: string;
  fantasyTeam?: FantasyTeamShortDto;
  gameweekId!: string;
  gameweek?: GameweekShortDto;
  points!: number;
  pointsOnBench!: number;
  transfersMade!: number;
  transfersCost!: number;
  netPoints!: number;
  gameweekRank?: number | null;
  createdAt!: Date;
}

export class GameweekLeaderboardResponseDto {
  gameweekId!: string;
  gameweekNumber!: number;
  items!: FantasyTeamGameweekDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class GameweekStatsResponseDto {
  gameweekId!: string;
  gameweekNumber!: number;
  averagePoints!: number;
  highestPoints!: number;
  lowestPoints!: number;
  totalTeams!: number;
  totalTransfers!: number;
  highestScoringTeam?: {
    id: string;
    name: string;
    points: number;
  } | null;
}

