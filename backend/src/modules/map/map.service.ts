import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { MapLimitsService, vnDay } from './map-limits.service.js';
import { MapConfig } from './map.config.js';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MAP_CACHE_TTL,
  MAP_REDIS_KEYS,
  MAP_STYLES,
  MAP_TEXT_MAX,
  VN_BOUNDS,
  type MapApi,
  type RouteVehicle,
} from './map.constants.js';
import {
  cleanText,
  parseLatLng,
  reverseCacheKey,
  routeCacheKey,
  searchCacheKey,
  type SearchFilters,
  hash,
  haversineM,
  normalizeDepartAt,
  toPlaceFromPlace,
  toPlaceFromReverse,
  toRoutes,
  toSuggestions,
} from './map.mapper.js';
import type {
  MapConfigPayload,
  MapPlace,
  MapRoute,
  MapSuggestion,
  MapUsagePayload,
} from './map.types.js';
import { VietmapClient } from './vietmap.client.js';

@Injectable()
export class MapService {
  private readonly logger = new Logger(MapService.name);
  /** Single-flight trong tiến trình: cùng khóa cache chỉ gọi upstream một lần. */
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly config: MapConfig,
    private readonly client: VietmapClient,
    private readonly limits: MapLimitsService,
    private readonly redis: RedisService,
  ) {}

  async clientConfig(userId: string): Promise<MapConfigPayload> {
    await this.limits.consumeUser('config', userId);
    const base = this.config.baseUrl;
    const key = encodeURIComponent(this.config.tileKey);
    const tiles = this.config.tilesEnabled;
    return {
      styles: tiles
        ? MAP_STYLES.map((id) => ({ id, url: `${base}/maps/styles/${id}/style.json?apikey=${key}` }))
        : [],
      trafficStyleUrl:
        tiles && this.config.trafficEnabled
          ? `${base}/maps/styles/tf/style.json?apikey=${key}`
          : null,
      center: [...DEFAULT_CENTER],
      zoom: DEFAULT_ZOOM,
      maxBounds: [...VN_BOUNDS],
      searchEnabled: this.config.searchEnabled,
      tilesEnabled: tiles,
    };
  }

  async search(
    userId: string,
    text: string,
    lat: number | undefined,
    lng: number | undefined,
    limit = 8,
    filters: SearchFilters = {},
  ): Promise<MapSuggestion[]> {
    await this.limits.consumeUser('autocomplete', userId);
    const clean = cleanText(text, MAP_TEXT_MAX);
    if (clean.length < 2) return [];
    const focusLat = lat ?? DEFAULT_CENTER[1];
    const focusLng = lng ?? DEFAULT_CENTER[0];
    return this.cached('autocomplete', searchCacheKey(clean, focusLat, focusLng, limit, filters), async () => {
      const params: Record<string, string> = {
        text: clean,
        focus: `${focusLat},${focusLng}`,
        display_type: '6',
      };
      if (filters.cats) params.cats = filters.cats;
      if (filters.scope) params.layers = filters.scope;
      if (filters.cityId) params.cityId = String(filters.cityId);
      if (filters.distId) params.distId = String(filters.distId);
      if (filters.wardId) params.wardId = String(filters.wardId);
      if (filters.radius) {
        params.circle_center = `${focusLat},${focusLng}`;
        params.circle_radius = String(filters.radius);
      }
      const result = await this.client.get('/api/autocomplete/v4', params);
      return toSuggestions(result.body, limit);
    });
  }

  async resolve(userId: string, refId: string): Promise<MapPlace> {
    await this.limits.consumeUser('place', userId);
    const place = await this.cached('place', hash(refId), async () => {
      const result = await this.client.get('/api/place/v4', { refid: refId });
      return toPlaceFromPlace(result.body);
    });
    if (!place) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Không tìm thấy địa điểm này nữa, vui lòng tìm lại.',
        null,
        HttpStatus.NOT_FOUND,
      );
    }
    return place;
  }

  async reverse(userId: string, lat: number, lng: number): Promise<MapPlace | null> {
    await this.limits.consumeUser('reverse', userId);
    const place = await this.cached('reverse', reverseCacheKey(lat, lng), async () => {
      const result = await this.client.get('/api/reverse/v4', {
        lat: String(lat),
        lng: String(lng),
        display_type: '6',
      });
      return toPlaceFromReverse(result.body);
    });
    // Khoảng cách tính theo đúng điểm được hỏi, không đưa vào cache (khóa cache làm tròn 5 chữ số).
    return place ? { ...place, distanceM: Math.round(haversineM({ lat, lng }, place) * 10) / 10 } : null;
  }

  async route(
    userId: string,
    fromText: string,
    toText: string,
    vehicle: RouteVehicle = 'motorcycle',
    alternatives = false,
    avoid?: string,
    time?: string,
  ): Promise<MapRoute[]> {
    await this.limits.consumeUser('route', userId);
    const from = parseLatLng(fromText);
    const to = parseLatLng(toText);
    if (!from || !to) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Điểm đi/đến không hợp lệ hoặc nằm ngoài Việt Nam.',
        { from: !from, to: !to },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (from[0] === to[0] && from[1] === to[1]) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Điểm đi và điểm đến trùng nhau.',
        null,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const departAt = time ? normalizeDepartAt(time) : '';
    if (departAt === null) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Giờ khởi hành phải theo dạng ISO UTC, ví dụ 2026-11-03T01:00:00Z.',
        { time: true },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const routes = await this.cached(
      'route',
      routeCacheKey([from[1], from[0]], [to[1], to[0]], vehicle, alternatives, avoid ?? '', departAt),
      async () => {
        const params: Record<string, string | string[]> = {
          point: [`${from[0]},${from[1]}`, `${to[0]},${to[1]}`],
          vehicle,
          points_encoded: 'false',
          annotations: 'congestion',
        };
        // Vietmap bỏ qua alternative=false: chỉ gửi khi bật.
        if (alternatives) params.alternative = 'true';
        if (avoid) params.avoid = avoid;
        if (departAt) params.time = departAt;
        const result = await this.client.get('/api/route/v4', params);
        const all = toRoutes(result.body);
        return alternatives ? all : all.slice(0, 1);
      },
    );
    if (!routes.length) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Không tìm được đường giữa hai điểm này.',
        null,
        HttpStatus.NOT_FOUND,
      );
    }
    return routes;
  }

  async usage(): Promise<MapUsagePayload> {
    const apis: MapApi[] = ['autocomplete', 'place', 'reverse', 'route'];
    const upstream: Record<string, number> = {};
    const cacheHits: Record<string, number> = {};
    for (const api of apis) {
      const row = await this.limits.readUsage(api);
      upstream[api] = row.upstream;
      cacheHits[api] = row.hits;
    }
    return { date: vnDay(), budget: this.config.dailyBudget, upstream, cacheHits };
  }

  async budgetUsed(): Promise<number> {
    return this.limits.readBudgetUsed();
  }

  /** Cache Redis (fail-open) + single-flight + ngân sách + cầu dao quanh lần gọi upstream. */
  private async cached<T>(api: MapApi, key: string, load: () => Promise<T>): Promise<T> {
    const redisKey = MAP_REDIS_KEYS.cache(api, key);
    const hit = await this.readCache<T>(redisKey);
    if (hit !== undefined) {
      void this.limits.countUsage('hits', api);
      return hit;
    }
    const pending = this.inFlight.get(redisKey) as Promise<T> | undefined;
    if (pending) return pending;

    const promise = this.callUpstream(api, load)
      .then(async (value) => {
        await this.writeCache(redisKey, value, MAP_CACHE_TTL[api]);
        return value;
      })
      .finally(() => this.inFlight.delete(redisKey));
    this.inFlight.set(redisKey, promise);
    return promise;
  }

  private async callUpstream<T>(api: MapApi, load: () => Promise<T>): Promise<T> {
    await this.limits.assertBreakerClosed();
    await this.limits.consumeBudget();
    try {
      const value = await load();
      void this.limits.recordSuccess();
      void this.limits.countUsage('usage', api);
      return value;
    } catch (error) {
      if (
        error instanceof BusinessException &&
        (error.code === ErrorCode.EXTERNAL_SERVICE_ERROR ||
          error.code === ErrorCode.EXTERNAL_SERVICE_TIMEOUT)
      ) {
        void this.limits.recordFailure();
      }
      throw error;
    }
  }

  private async readCache<T>(key: string): Promise<T | undefined> {
    try {
      return await this.redis.get<T>(key);
    } catch {
      this.logger.warn('Đọc cache bản đồ thất bại, bỏ qua cache');
      return undefined;
    }
  }

  private async writeCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, value, ttlSeconds * 1000);
    } catch {
      this.logger.warn('Ghi cache bản đồ thất bại');
    }
  }
}
