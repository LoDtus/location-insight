import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CONTRACT_IDS, LAYER_CODE_PATTERN, PACKAGE_LIMITS, SOURCE_CODE_PATTERN, type ContractId, type LayerUsage } from './package-contracts.js';
import type { ImportJobStatus } from './datasets.types.js';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

const DRAFT_KINDS = ['data', 'criteria', 'hotfix'] as const;
const IMPORT_STATUSES: readonly ImportJobStatus[] = ['uploaded', 'validating', 'validated', 'rejected', 'saving', 'saved', 'discarded', 'failed'];

export class CreateDraftDto {
  @IsIn(DRAFT_KINDS)
  kind: (typeof DRAFT_KINDS)[number];

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  note: string;
}

export class SetReleaseLayerDto {
  @IsUUID()
  layerVersionId: string;
}

export class PublishReleaseDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  acceptWarnings?: string;
}

export class WithdrawReleaseDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;

  @IsInt()
  @Min(1)
  baseVersion: number;
}

export class CreateLayerDto {
  @Transform(trim)
  @Matches(new RegExp(LAYER_CODE_PATTERN))
  code: string;

  @IsIn(CONTRACT_IDS)
  contract: ContractId;

  @Transform(trim)
  @Matches(new RegExp(SOURCE_CODE_PATTERN))
  sourceCode: string;

  @IsIn(['public', 'internal'])
  usage: Exclude<LayerUsage, 'blocked'>;

  @Transform(trim)
  @IsString()
  @MaxLength(300)
  attribution: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  description?: string;
}

export class UpdateLayerDto {
  @IsOptional()
  @IsIn(['public', 'internal', 'blocked'])
  usage?: LayerUsage;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  attribution?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}

export class CreateUploadTicketDto {
  @IsInt()
  @Min(1)
  @Max(PACKAGE_LIMITS.packageMaxBytes)
  sizeBytes: number;
}

export class SubmitUploadDto {
  @IsUUID()
  uploadId: string;
}

export class SaveImportDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  acceptWarnings?: string;
}

export class ImportListQueryDto {
  @IsOptional()
  @IsIn(IMPORT_STATUSES)
  status?: ImportJobStatus;

  @IsOptional()
  @Matches(new RegExp(LAYER_CODE_PATTERN))
  layerCode?: string;
}
