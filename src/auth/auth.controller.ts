import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { UserDto } from './dto/user.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async registration(@Body() data: RegisterDto): Promise<UserDto> {
    return this.authService.registration(data);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() data: LoginDto): Promise<UserDto> {
    return this.authService.login(data);
  }
}

// authRouter.get('/google', authController.startGoogleAuthentication);

// authRouter.get('/google/callback', authController.googleCallback);
