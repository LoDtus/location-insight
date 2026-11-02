import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { MapConfig } from './map.config.js';
import { redactUrl } from './map.mapper.js';

export interface UpstreamResult {
  status: number;
  body: unknown;
}

/**
 * Cổng duy nhất tới Vietmap. Host cố định từ cấu hình, tham số dựng bằng
 * URLSearchParams, khóa API không bao giờ vào log hay thông điệp lỗi.
 */
@Injectable()
export class VietmapClient {
  private readonly logger = new Logger(VietmapClient.name);

  constructor(private readonly config: MapConfig) {}

  /**
   * GET idempotent. Trả về cả 2xx và 4xx "nghiệp vụ" (400/404) để caller quyết định;
   * lỗi hạ tầng (401/403/429/5xx/timeout/mạng) ném BusinessException.
   */
  async get(path: string, params: Record<string, string | string[]>): Promise<UpstreamResult> {
    if (!this.config.searchEnabled) {
      throw this.unavailable('Dịch vụ bản đồ chưa được cấu hình.');
    }
    const url = this.buildUrl(path, params);
    let lastStatus = 0;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { accept: 'application/json' },
          redirect: 'error',
          signal: AbortSignal.timeout(this.config.timeoutMs),
        });
        lastStatus = response.status;
        if (response.status >= 500 && attempt < 2) continue;
        return await this.handle(response, url);
      } catch (error) {
        if (error instanceof BusinessException) throw error;
        if (attempt < 2) continue;
        const timeout = error instanceof Error && error.name === 'TimeoutError';
        this.logger.warn(
          `Gọi Vietmap thất bại (${timeout ? 'timeout' : 'mạng'}) ${redactUrl(url)}`,
        );
        throw timeout
          ? new BusinessException(
              ErrorCode.EXTERNAL_SERVICE_TIMEOUT,
              'Dịch vụ bản đồ phản hồi quá chậm, vui lòng thử lại.',
              null,
              HttpStatus.GATEWAY_TIMEOUT,
            )
          : this.bad();
      }
    }
    this.logger.warn(`Vietmap trả ${lastStatus} ${redactUrl(url)}`);
    throw this.bad();
  }

  private buildUrl(path: string, params: Record<string, string | string[]>): string {
    const query = new URLSearchParams();
    query.set('apikey', this.config.apiKey);
    for (const [key, value] of Object.entries(params)) {
      for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
    }
    return `${this.config.baseUrl}${path}?${query.toString()}`;
  }

  private async handle(response: Response, url: string): Promise<UpstreamResult> {
    const status = response.status;
    if (status === 401 || status === 403) {
      this.logger.error('Vietmap từ chối khóa API (401/403) — kiểm tra VIETMAP_API_KEY và API bật trên khóa');
      throw this.unavailable('Dịch vụ bản đồ tạm thời không khả dụng.');
    }
    if (status === 429) {
      this.logger.warn('Vietmap trả 429 (hết hạn mức)');
      throw this.unavailable('Dịch vụ bản đồ đang quá tải, vui lòng thử lại sau ít phút.');
    }
    if (status >= 500) {
      this.logger.warn(`Vietmap trả ${status} ${redactUrl(url)}`);
      throw this.bad();
    }
    const text = await response.text();
    if (status === 400 || status === 404) return { status, body: null };
    if (status < 200 || status >= 300) throw this.bad();
    try {
      return { status, body: JSON.parse(text) as unknown };
    } catch {
      this.logger.warn(`Vietmap trả nội dung không phải JSON ${redactUrl(url)}`);
      throw this.bad();
    }
  }

  private unavailable(message: string): BusinessException {
    return new BusinessException(
      ErrorCode.SERVICE_UNAVAILABLE,
      message,
      null,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private bad(): BusinessException {
    return new BusinessException(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      'Dịch vụ bản đồ gặp sự cố, vui lòng thử lại.',
      null,
      HttpStatus.BAD_GATEWAY,
    );
  }
}
