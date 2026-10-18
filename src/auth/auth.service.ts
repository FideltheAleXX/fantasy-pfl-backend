import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { UserDto } from './dto/user.dto';
import { User } from '../generated/prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(user: User): UserDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  async registration(data: RegisterDto): Promise<UserDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser) {
      throw new ConflictException('Користувач з таким email вже існує');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(data.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
      },
    });

    return this.toDto(user);
  }
}
