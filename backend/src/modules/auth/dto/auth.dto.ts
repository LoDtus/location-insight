import {
  IsOptional,
  Equals,
  IsBoolean,
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName: string;

  @IsBoolean()
  @Equals(true)
  acceptTerms: boolean;
}

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MaxLength(128)
  password: string;
}

export class EmailDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class TokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string;
}

export class ResetPasswordDto extends TokenDto {
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password: string;
}

export class RefreshDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  refreshToken?: string;
}

export class PasswordChangeDto {
  @IsString()
  @MaxLength(128)
  currentPassword: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  newPassword: string;
}

export class ReauthDto {
  @IsString()
  @MaxLength(128)
  password: string;
}

export class RenameSessionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  deviceLabel: string;
}
