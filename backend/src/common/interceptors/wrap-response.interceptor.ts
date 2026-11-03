import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { Observable, map } from 'rxjs';
import { ApiMetadataDto } from '../../shared/dtos/response/api-metadata.dto.js';
import { ApiResponseDto } from '../../shared/dtos/response/api-response.dto.js';
import {
  serializeDates,
  toUtcIsoString,
} from '../../shared/utils/iso-date.util.js';
import { isHealthUrl } from '../../shared/utils/runtime.util.js';

type PayloadWithMetadata = {
  data: unknown;
  metadata?: ApiMetadataDto;
};

@Injectable()
export class WrapResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponseDto<T> | T
> {
  constructor(private readonly cls: ClsService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponseDto<T> | T> {
    // Sự kiện WebSocket không có phản hồi HTTP để bọc.
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<Request>();
    const url = request.originalUrl || request.url || '';
    const path = url.split('?')[0] ?? '';
    if (isHealthUrl(url) || path.includes('/billing/sepay/webhook') || path.includes('/media/avatars/')) {
      return next.handle();
    }

    return next.handle().pipe(
      map((result: unknown) => {
        const httpResponse = context.switchToHttp().getResponse<Response>();
        const status = httpResponse.statusCode ?? 200;
        const traceId = this.readTraceId();

        if (traceId) {
          httpResponse.setHeader('x-trace-id', traceId);
        }

        if (result instanceof ApiResponseDto || isApiResponse(result)) {
          const current = result as ApiResponseDto<T>;
          current.timestamp = toUtcIsoString(new Date(current.timestamp));
          current.traceId = current.traceId ?? traceId;
          return serializeDates(current);
        }

        let data = result;
        let metadata: ApiMetadataDto | undefined;

        if (hasMetadata(result)) {
          data = result.data;
          metadata = result.metadata;
        }

        return serializeDates(
          new ApiResponseDto<T>({
            timestamp: toUtcIsoString(new Date()),
            success: status < 400,
            status,
            data: data as T,
            metadata,
            traceId,
          }),
        );
      }),
    );
  }

  private readTraceId(): string | undefined {
    try {
      return this.cls.getId();
    } catch {
      return undefined;
    }
  }
}

function isApiResponse(value: unknown): value is ApiResponseDto {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.success === 'boolean' &&
    typeof record.status === 'number' &&
    typeof record.timestamp === 'string'
  );
}

function hasMetadata(value: unknown): value is PayloadWithMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return 'data' in value && 'metadata' in value;
}
