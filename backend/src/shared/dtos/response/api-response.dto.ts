import { Exclude, Expose } from 'class-transformer';
import { toUtcIsoString } from '../../utils/iso-date.util.js';
import { ApiErrorDto } from './api-error.dto.js';
import { ApiMetadataDto } from './api-metadata.dto.js';

@Exclude()
export class ApiResponseDto<T = unknown> {
  @Expose()
  timestamp: string;

  @Expose()
  success: boolean;

  @Expose()
  status: number;

  @Expose()
  message?: string;

  @Expose()
  error?: ApiErrorDto;

  @Expose()
  data?: T;

  @Expose()
  metadata?: ApiMetadataDto;

  @Expose()
  traceId?: string;

  constructor(data: {
    success: boolean;
    status: number;
    timestamp?: string;
    message?: string;
    error?: ApiErrorDto;
    data?: T;
    metadata?: ApiMetadataDto;
    traceId?: string;
  }) {
    this.timestamp = data.timestamp ?? toUtcIsoString(new Date());
    this.success = data.success;
    this.status = data.status;
    this.message = data.message;
    this.error = data.error;
    this.data = data.data;
    this.metadata = data.metadata;
    this.traceId = data.traceId;
  }
}
