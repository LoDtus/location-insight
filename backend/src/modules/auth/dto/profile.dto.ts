import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName: string;

  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  username: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}
