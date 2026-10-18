import { UserDto } from './user.dto';

export class AuthResponseDto {
  user!: UserDto;
  token!: string;
}
