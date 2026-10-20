import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/enums';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Користувач не авторизований');
    }

    if (user.role !== UserRole.admin) {
      throw new ForbiddenException('Доступ тільки для адміністраторів');
    }

    return true;
  }
}
