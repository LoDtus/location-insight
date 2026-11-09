import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MapConfig {
  constructor(private readonly config: ConfigService) {}

  private str(name: string, fallback = ''): string {
    return (this.config.get<string>(name) ?? '').trim() || fallback;
  }

  private num(name: string, fallback: number): number {
    const value = Number(this.str(name));
    return Number.isFinite(value) && this.str(name) !== '' ? value : fallback;
  }

  /** Khóa API (search, route…): chỉ dùng ở backend. */
  get apiKey(): string {
    return this.str('VIETMAP_API_KEY');
  }
  /** Khóa Tilemap: giao cho trình duyệt (nằm trong style URL). */
  get tileKey(): string {
    return this.str('VIETMAP_TILE_KEY');
  }
  get searchEnabled(): boolean {
    return this.apiKey.length > 0;
  }
  get tilesEnabled(): boolean {
    return this.tileKey.length > 0;
  }
  get trafficEnabled(): boolean {
    return this.str('MAP_TRAFFIC_ENABLED') === 'true';
  }
  get baseUrl(): string {
    const url = this.str('VIETMAP_BASE_URL', 'https://maps.vietmap.vn').replace(/\/+$/, '');
    const production = this.str('NODE_ENV') === 'production';
    if (production && !url.startsWith('https://')) {
      throw new Error('VIETMAP_BASE_URL phải dùng https:// ở production.');
    }
    return url;
  }
  get timeoutMs(): number {
    return Math.min(Math.max(this.num('VIETMAP_TIMEOUT_MS', 4000), 500), 15000);
  }
  /** Khóa OpenAQ v3 (tiêu chí không khí). Trống thì tiêu chí không khí báo "chưa cấu hình". */
  get openaqApiKey(): string {
    return this.str('OPENAQ_API_KEY');
  }
  get openaqBaseUrl(): string {
    return this.str('OPENAQ_BASE_URL', 'https://api.openaq.org').replace(/\/+$/, '');
  }
  /** 0 = không giới hạn. */
  get dailyBudget(): number {
    return Math.max(0, Math.floor(this.num('MAP_DAILY_BUDGET', 1200)));
  }
}
