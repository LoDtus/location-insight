/** Hộp bao Việt Nam [minLng, minLat, maxLng, maxLat]; ngoài hộp này không gọi upstream. */
export const VN_BOUNDS = [102.0, 8.0, 110.0, 24.0] as const;

/** Hà Nội (ưu tiên giai đoạn đầu): [lng, lat]. */
export const DEFAULT_CENTER = [105.8342, 21.0278] as const;
export const DEFAULT_ZOOM = 12;

export const MAP_STYLES = ['tm', 'lm', 'dm', 'hm'] as const;
export type MapStyleId = (typeof MAP_STYLES)[number];

export const ROUTE_VEHICLES = ['car', 'motorcycle'] as const;
export type RouteVehicle = (typeof ROUTE_VEHICLES)[number];

export type MapApi = 'autocomplete' | 'place' | 'reverse' | 'route';

/** Giới hạn mỗi người dùng (cửa sổ cố định theo giây). */
export const MAP_USER_LIMITS: Readonly<
  Record<MapApi | 'config', { limit: number; windowSeconds: number }>
> = {
  config: { limit: 30, windowSeconds: 60 },
  autocomplete: { limit: 90, windowSeconds: 60 },
  place: { limit: 30, windowSeconds: 60 },
  reverse: { limit: 30, windowSeconds: 60 },
  route: { limit: 20, windowSeconds: 60 },
};

/** TTL cache (giây) theo mức đổi của dữ liệu. */
export const MAP_CACHE_TTL: Readonly<Record<MapApi, number>> = {
  autocomplete: 5 * 60,
  place: 60 * 60,
  reverse: 24 * 60 * 60,
  route: 3 * 60,
};

export const MAP_TEXT_MAX = 120;
export const MAP_REF_ID_MAX = 1500;
export const MAP_REF_ID_PATTERN = /^[A-Za-z0-9_:.-]+$/;
export const MAP_MAX_SUGGESTIONS = 10;
export const MAP_MAX_ROUTE_POINTS = 20000;

export const MAP_BREAKER = { failures: 5, openSeconds: 30 } as const;

export const MAP_REDIS_KEYS = {
  userLimit: (api: string, userId: string) => `ratelimit:map:${api}:${userId}`,
  cache: (api: MapApi, key: string) => `cache:map:${api}:${key}`,
  budget: (day: string) => `map:budget:${day}`,
  usage: (day: string, api: MapApi) => `map:usage:${day}:${api}`,
  hits: (day: string, api: MapApi) => `map:hits:${day}:${api}`,
  breakerFails: 'map:breaker:fails',
  breakerOpen: 'map:breaker:open',
};
