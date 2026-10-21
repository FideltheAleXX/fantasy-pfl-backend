import { PlayerDto } from '../../players/dto/player.dto';

export class FantasyTeamPickDto {
  id!: string;
  fantasyTeamId!: string;
  playerId!: string;
  player?: PlayerDto;
  isCaptain!: boolean;
  isViceCaptain!: boolean;
  isBench!: boolean;
  orderNumber!: number;
}

