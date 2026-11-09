import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../integrations/redis/redis.service.js';
import { MapConfig } from '../map.config.js';
import { haversineM } from '../map.mapper.js';

/**
 * PM2.5 của trạm gần nhất từ OpenAQ v3 (https://docs.openaq.org). Gọi từ backend, không từ trình duyệt; khóa API
 * chỉ nằm trong header. Kết quả cache theo ô ~1 km trong 1 giờ (không khí đổi theo giờ), nên một khu đông người
 * xem chỉ tốn vài lượt gọi.
 *
 * Luồng: `GET /v3/locations?coordinates=lat,lng&radius=…&parameters_id=2` (2 = pm25) → chọn trạm gần nhất còn số
 * đo mới → `GET /v3/locations/{id}/latest` → lấy giá trị của cảm biến pm25 của trạm đó.
 */

export const PM25_PARAMETER_ID = 2;
const CACHE_TTL_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 4000;

export interface AirReading {
  stationName: string;
  lat: number;
  lng: number;
  distanceM: number;
  pm25: number;
  observedAt: string;
}

export type AirResult = { kind: 'ok'; reading: AirReading } | { kind: 'none' } | { kind: 'unavailable'; reason: string };

interface StationCandidate {
  id: number;
  name: string;
  lat: number;
  lng: number;
  sensorIds: Set<number>;
  lastUtc: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function results(body: unknown): unknown[] {
  return isRecord(body) && Array.isArray(body.results) ? body.results : [];
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Đọc một trạm từ `/v3/locations`; bỏ trạm thiếu tọa độ hoặc không có cảm biến pm25. */
export function parseStation(value: unknown): StationCandidate | null {
  if (!isRecord(value) || !isRecord(value.coordinates)) return null;
  const id = finite(value.id);
  const lat = finite(value.coordinates.latitude);
  const lng = finite(value.coordinates.longitude);
  if (id === null || lat === null || lng === null) return null;
  const sensorIds = new Set<number>();
  for (const sensor of Array.isArray(value.sensors) ? value.sensors : []) {
    if (!isRecord(sensor) || !isRecord(sensor.parameter)) continue;
    const sensorId = finite(sensor.id);
    if (sensorId !== null && (sensor.parameter.id === PM25_PARAMETER_ID || sensor.parameter.name === 'pm25')) sensorIds.add(sensorId);
  }
  if (sensorIds.size === 0) return null;
  const last = isRecord(value.datetimeLast) && typeof value.datetimeLast.utc === 'string' ? value.datetimeLast.utc : null;
  return { id, name: typeof value.name === 'string' ? value.name.slice(0, 120) : `Trạm ${id}`, lat, lng, sensorIds, lastUtc: last };
}

/** Giá trị pm25 mới nhất của trạm từ `/v3/locations/{id}/latest`. */
export function parseLatest(body: unknown, sensorIds: ReadonlySet<number>): { value: number; utc: string } | null {
  let best: { value: number; utc: string } | null = null;
  for (const item of results(body)) {
    if (!isRecord(item) || !isRecord(item.datetime)) continue;
    const sensorId = finite(item.sensorsId);
    const value = finite(item.value);
    const utc = typeof item.datetime.utc === 'string' ? item.datetime.utc : null;
    if (sensorId === null || !sensorIds.has(sensorId) || value === null || value < 0 || !utc) continue;
    if (!best || utc > best.utc) best = { value, utc };
  }
  return best;
}

@Injectable()
export class OpenAqClient {
  private readonly logger = new Logger(OpenAqClient.name);

  constructor(
    private readonly config: MapConfig,
    private readonly redis: RedisService,
  ) {}

  get enabled(): boolean {
    return this.config.openaqApiKey.length > 0;
  }

  async nearestPm25(lat: number, lng: number, maxStationM: number, maxAgeHours: number): Promise<AirResult> {
    if (!this.enabled) return { kind: 'unavailable', reason: 'Chưa cấu hình OPENAQ_API_KEY.' };
    const key = `cache:map:air:pm25:${lat.toFixed(2)},${lng.toFixed(2)}:${maxStationM}`;
    try {
      const hit = await this.redis.get<AirResult>(key);
      if (hit && (hit.kind === 'ok' || hit.kind === 'none')) return this.withDistance(hit, lat, lng);
    } catch {
      // Redis lỗi: gọi thẳng.
    }
    try {
      const value = await this.fetchNearest(lat, lng, maxStationM, maxAgeHours);
      try {
        await this.redis.set(key, value, CACHE_TTL_MS);
      } catch {
        // Bỏ qua lỗi cache.
      }
      return this.withDistance(value, lat, lng);
    } catch (error) {
      this.logger.warn(`OpenAQ lỗi: ${error instanceof Error ? error.message : String(error)}`);
      return { kind: 'unavailable', reason: 'Nguồn không khí đang lỗi, thử lại sau.' };
    }
  }

  /** Khoảng cách tính lại theo đúng điểm hỏi (khóa cache làm tròn ~1 km). */
  private withDistance(result: AirResult, lat: number, lng: number): AirResult {
    if (result.kind !== 'ok') return result;
    return { kind: 'ok', reading: { ...result.reading, distanceM: Math.round(haversineM({ lat, lng }, result.reading)) } };
  }

  private async fetchNearest(lat: number, lng: number, maxStationM: number, maxAgeHours: number): Promise<AirResult> {
    const radius = Math.min(25000, Math.max(1000, Math.round(maxStationM)));
    const list = await this.get('/v3/locations', {
      coordinates: `${lat.toFixed(5)},${lng.toFixed(5)}`,
      radius: String(radius),
      parameters_id: String(PM25_PARAMETER_ID),
      limit: '20',
    });
    const minUtc = new Date(Date.now() - maxAgeHours * 3600 * 1000).toISOString();
    const stations = results(list)
      .map(parseStation)
      .filter((item): item is StationCandidate => item !== null && (item.lastUtc === null || item.lastUtc >= minUtc))
      .map((item) => ({ ...item, distanceM: haversineM({ lat, lng }, item) }))
      .filter((item) => item.distanceM <= maxStationM)
      .sort((a, b) => a.distanceM - b.distanceM);
    // Trạm gần nhất có thể chưa có số pm25 mới: thử tối đa 3 trạm.
    for (const station of stations.slice(0, 3)) {
      const latest = parseLatest(await this.get(`/v3/locations/${station.id}/latest`, {}), station.sensorIds);
      if (!latest || latest.utc < minUtc) continue;
      return {
        kind: 'ok',
        reading: { stationName: station.name, lat: station.lat, lng: station.lng, distanceM: Math.round(station.distanceM), pm25: latest.value, observedAt: latest.utc },
      };
    }
    return { kind: 'none' };
  }

  private async get(path: string, params: Record<string, string>): Promise<unknown> {
    const url = `${this.config.openaqBaseUrl}${path}?${new URLSearchParams(params).toString()}`;
    const response = await fetch(url, {
      headers: { accept: 'application/json', 'X-API-Key': this.config.openaqApiKey },
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`OpenAQ trả ${response.status} cho ${path}`);
    return (await response.json()) as unknown;
  }
}
