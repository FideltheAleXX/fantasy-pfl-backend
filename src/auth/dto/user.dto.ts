import { UserRole, UserStatus } from '../../generated/prisma/enums';

export class UserDto {
  id!: string;
  email!: string;
  role!: UserRole;
  status!: UserStatus;
  createdAt!: Date;
}
