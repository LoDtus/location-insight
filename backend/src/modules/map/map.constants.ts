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
/** Thao tác chỉ chạy trong hệ thống (không gọi Vietmap) nhưng vẫn giới hạn theo người dùng. */
export type MapLocalApi = 'config' | 'evaluate' | 'evaluation-read' | 'saved' | 'search-pins' | 'layers' | 'weights';

/** Giới hạn mỗi người dùng (cửa sổ cố định theo giây). */
export const MAP_USER_LIMITS: Readonly<
  Record<MapApi | MapLocalApi, { limit: number; windowSeconds: number }>
> = {
  config: { limit: 30, windowSeconds: 60 },
  /** Lượt bấm đánh giá (tính phí) và chỉnh tiêu chí. */
  evaluate: { limit: 30, windowSeconds: 60 },
  /** Đọc lại kết quả của chính mình (không tính phí, không tính toán). */
  'evaluation-read': { limit: 120, windowSeconds: 60 },
  saved: { limit: 60, windowSeconds: 60 },
  /** Ghim nhiều kết quả: mỗi lượt có thể tốn tới 1 Autocomplete + 10 Place (đều có cache). */
  'search-pins': { limit: 10, windowSeconds: 60 },
  /** Ô lớp bản đồ: mỗi lần kéo bản đồ có thể cần vài ô mới (đều có cache). */
  layers: { limit: 300, windowSeconds: 60 },
  /** Xem/đổi trọng số tiêu chí. */
  weights: { limit: 60, windowSeconds: 60 },
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

export const SEARCH_SCOPES = ['POI', 'ADDRESS', 'VILLAGE', 'WARD', 'DIST', 'CITY', 'STREET'] as const;
export const ROUTE_AVOID = ['ferry'] as const;
/** Mã nhóm POI: "1002-1" hoặc "3001"; tối đa 10 mã ngăn bởi dấu phẩy. */
export const MAP_CATS_PATTERN = /^\d{1,6}(-\d{1,3})?(,\d{1,6}(-\d{1,3})?){0,9}$/;
export const MAP_SCOPE_PATTERN = new RegExp(
  `^(${SEARCH_SCOPES.join('|')})(,(${SEARCH_SCOPES.join('|')})){0,6}$`,
);
export const MAP_RADIUS_RANGE = { min: 50, max: 50000 } as const;
export const MAP_TEXT_MAX = 120;
export const MAP_REF_ID_MAX = 1500;
export const MAP_REF_ID_PATTERN = /^[A-Za-z0-9_:.-]+$/;
export const MAP_MAX_SUGGESTIONS = 10;
export const MAP_MAX_ROUTE_POINTS = 20000;

/** Loại địa điểm suy từ `ref_id` của Vietmap (vm:POI:…, vm:ADDRESS:…). */
export const MAP_PLACE_KINDS = ['poi', 'address', 'street', 'ward', 'district', 'city', 'village', 'unknown'] as const;
export type MapPlaceKind = (typeof MAP_PLACE_KINDS)[number];

/** Mỗi người lưu tối đa chừng này địa điểm. */
export const MAP_SAVED_MAX = 200;
/** Số địa điểm tối đa trong danh sách so sánh (mỗi địa điểm là một cột). */
export const MAP_COMPARE_MAX = 6;
export const MAP_LABEL_MAX = 80;
export const MAP_NOTE_MAX = 1000;
/** Nhóm điểm tiện ích của các lớp bản đồ (khớp tools/data/osm_places.py). */
export const MAP_POI_CATEGORIES = [
  'school', 'bank', 'market', 'pharmacy', 'supermarket', 'hospital', 'park', 'food', 'townhall', 'hardware', 'bus', 'metro',
] as const;
export type MapPoiCategory = (typeof MAP_POI_CATEGORIES)[number];
/** Ô lớp bản đồ cố định ở zoom 13 (~4,6 km ở Hà Nội); client chỉ hiện lớp khi zoom ≥ 13. */
export const MAP_LAYER_TILE_ZOOM = 13;
/** Trần số điểm mỗi ô (ô dày nhất ở trung tâm Hà Nội ~1 500 điểm). */
export const MAP_LAYER_TILE_MAX = 3000;
/** Cache một ô (giây); khóa có phiên bản dữ liệu nên nhập dữ liệu mới là tự hết hiệu lực. */
export const MAP_LAYER_TTL = 24 * 60 * 60;

/** Số kết quả tối đa được ghim khi tìm theo loại hình ("ngân hàng"): mỗi kết quả tốn một lần Place (có cache). */
export const MAP_PIN_RESULTS_MAX = 10;
/** Cache kết quả phân tích dùng chung (giây). Bản gốc nằm ở DB nên hết hạn chỉ tốn một lần đọc DB. */
export const MAP_ANALYSIS_TTL = 24 * 60 * 60;

export const MAP_BREAKER = { failures: 5, openSeconds: 30 } as const;

export const MAP_REDIS_KEYS = {
  userLimit: (api: string, userId: string) => `ratelimit:map:${api}:${userId}`,
  cache: (api: MapApi, key: string) => `cache:map:${api}:${key}`,
  budget: (day: string) => `map:budget:${day}`,
  usage: (day: string, api: MapApi) => `map:usage:${day}:${api}`,
  hits: (day: string, api: MapApi) => `map:hits:${day}:${api}`,
  breakerFails: 'map:breaker:fails',
  breakerOpen: 'map:breaker:open',
  /** Kết quả phân tích dùng chung theo (phiên bản dữ liệu, tọa độ); chỉ đọc nội bộ, không trả thẳng cho client. */
  analysis: (analysisId: string) => `cache:map:analysis:${analysisId}`,
  datasetCurrent: 'map:dataset:current',
};
