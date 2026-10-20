export class PlayerGameweekStatDto {
  id!: string;
  playerId!: string;
  gameweekId!: string;
  minutesPlayed!: number;
  goals!: number;
  assists!: number;
  cleanSheet!: boolean;
  goalsConceded!: number;
  yellowCards!: number;
  redCards!: number;
  saves!: number;
  points!: number;
}
