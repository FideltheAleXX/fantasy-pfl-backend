import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Некоректный формат email' })
  @IsNotEmpty({ message: 'Email обов’язковий до заповнення' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Пароль обов’язковий до заповнення' })
  password!: string;
}
