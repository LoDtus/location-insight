import { Type } from 'class-transformer';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { REFUND_REASONS, type RefundReason } from '../refund-policy.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const squash = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/\s+/g, '') : value;

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

export class CreateRefundDto {
  @IsIn(REFUND_REASONS)
  reason: RefundReason;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  userNote?: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(/^[\p{L}\p{M} .'-]+$/u, { message: 'Tên chủ tài khoản không hợp lệ.' })
  payoutAccountName: string;

  @Transform(squash)
  @IsString()
  @Matches(/^[0-9A-Za-z]{4,32}$/, { message: 'Số tài khoản không hợp lệ.' })
  payoutAccountNumber: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  payoutBank: string;
}

export class DecideRefundDto {
  @IsIn(['approve', 'reject'])
  decision: 'approve' | 'reject';

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  note: string;
}

export class RefundPaidOutDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  referenceCode: string;
}

export class RefundListQueryDto {
  @IsOptional()
  @IsIn(['requested', 'approved', 'rejected', 'paid_out'])
  status?: 'requested' | 'approved' | 'rejected' | 'paid_out';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
