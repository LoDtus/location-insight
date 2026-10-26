import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  NotEquals,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReasonDto {
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  reason: string;
}

export class GrantSubscriptionDto extends ReasonDto {
  @IsIn(['unlimited', 'valued'])
  plan: 'unlimited' | 'valued';

  @IsDateString()
  periodEnd: string;
}

export class GrantCreditDto extends ReasonDto {
  @IsInt()
  @Min(-10)
  @Max(10)
  @NotEquals(0)
  amount: number;

  @IsString()
  @MinLength(8)
  @MaxLength(80)
  idempotencyKey: string;
}

export class AdminUserQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;

  @IsOptional()
  @IsIn(['active', 'locked', 'deleted'])
  status?: 'active' | 'locked' | 'deleted';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}

export class AuditQueryDto {
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
