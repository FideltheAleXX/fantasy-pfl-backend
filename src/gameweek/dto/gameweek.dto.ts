export class GameweekDto {
  id!: string;
  number!: number;
  deadline!: Date;
  isFinished!: boolean;
}

export class CurrentGameweekResponseDto extends GameweekDto {
  isDeadlinePassed!: boolean;
  secondsUntilDeadline!: number;
  status!: 'upcoming' | 'in_progress' | 'finished';
}

