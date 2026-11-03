import {
  IsOptional,
  Equals,
  IsBoolean,
  IsEmail,
  IsString,
  Matches,
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
  @IsString()
  @MinLength(1)
  @MaxLength(254)
  @Matches(/^([a-z0-9]+(?:-[a-z0-9]+)*|[^\s@]+@[^\s@]+\.[^\s@]+)$/i)
  email: string;

  @IsString()
  @MaxLength(128)
  password: string;

  @IsOptional()
  @IsBoolean()
  remember?: boolean;
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
