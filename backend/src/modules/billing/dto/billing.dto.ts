import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateOrderDto {
  @IsIn(['subscription', 'valuation_credit'])
  kind: 'subscription' | 'valuation_credit';

  @ValidateIf((value: CreateOrderDto) => value.kind === 'subscription')
  @IsIn(['unlimited', 'valued'])
  plan?: 'unlimited' | 'valued';

  @ValidateIf((value: CreateOrderDto) => value.kind === 'subscription')
  @IsIn(['month', 'year'])
  cycle?: 'month' | 'year';
}

export class ResolveOrderDto {
  @IsIn(['fulfill', 'reject'])
  decision: 'fulfill' | 'reject';

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason: string;
}

export class ChangePlanDto {
  @IsIn(['unlimited', 'valued'])
  plan: 'unlimited' | 'valued';
}

export class DirectoryQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsIn(['active', 'trailing', 'canceled', 'expired', 'none'])
  status?: 'active' | 'trailing' | 'canceled' | 'expired' | 'none';

  @IsOptional()
  @IsIn(['free', 'unlimited', 'valued'])
  plan?: 'free' | 'unlimited' | 'valued';

  @IsOptional()
  @IsIn(['created_desc', 'created_asc', 'name', 'expiry'])
  sort?: 'created_desc' | 'created_asc' | 'name' | 'expiry';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}

export class RevokeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason: string;
}

export class AdminListQueryDto {
  @IsOptional()
  @IsIn(['pending', 'paid', 'expired', 'canceled', 'needs_review'])
  status?: 'pending' | 'paid' | 'expired' | 'canceled' | 'needs_review';

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
