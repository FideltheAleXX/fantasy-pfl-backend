import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsEmail({}, { message: 'Некоректный формат email' })
  @IsNotEmpty({ message: 'Email обов’язковий до заповнення' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Пароль обовязковий до заповнення' })
  @MinLength(6, { message: 'Пароль повинен містити не менше 6-ти символів' })
  password!: string;
}
