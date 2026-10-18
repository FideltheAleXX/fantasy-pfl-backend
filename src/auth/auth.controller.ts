import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { UserDto } from './dto/user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async registration(@Body() data: RegisterDto): Promise<UserDto> {
    return this.authService.registration(data);
  }
}

// // 2. Log In
// authRouter.post('/login', validateRequest(loginSchema), authController.login);

// // 3. Log Out
// authRouter.post('/logout', authController.logout);

// // 4. OAuth2.0 via Google
// authRouter.get('/google', authController.startGoogleAuthentication);

// authRouter.get('/google/callback', authController.googleCallback);
