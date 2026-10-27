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

export class CreateRefundDto {
  @IsIn([
    'within_24h',
    'service_outage',
    'operator_stop',
    'duplicate_or_wrong',
    'overpay',
    'legal',
  ])
  reason:
    | 'within_24h'
    | 'service_outage'
    | 'operator_stop'
    | 'duplicate_or_wrong'
    | 'overpay'
    | 'legal';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  userNote?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  payoutAccountName: string;

  @IsString()
  @MinLength(4)
  @MaxLength(32)
  payoutAccountNumber: string;

  @IsString()
  @MinLength(2)
  @MaxLength(64)
  payoutBank: string;

  @IsInt()
  @Min(1)
  amountVnd: number;
}

export class ResolveOrderDto {
  @IsIn(['fulfill', 'reject'])
  decision: 'fulfill' | 'reject';

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason: string;
}

export class RefundDecisionDto {
  @IsIn(['approve', 'reject'])
  decision: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class PaidOutDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  referenceCode: string;
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
