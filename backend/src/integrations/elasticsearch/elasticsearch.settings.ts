const DEFAULT_SEARCH_TIMEOUT_MS = 2000;
const DEFAULT_SYNC_INTERVAL_MS = 2000;
const DEFAULT_SYNC_BATCH = 200;

export interface ElasticsearchSettings {
  /** Công tắc tổng: false thì không kết nối, mọi tìm kiếm rơi về PostgreSQL (FR-11). */
  enabled: boolean;
  /** Các profile được dùng ES (BR-02). Rỗng = không profile nào. */
  profiles: ReadonlySet<string>;
  /** Tiền tố tên index/alias khi dùng chung cụm (kebab-case, có thể rỗng). */
  indexPrefix: string;
  searchTimeoutMs: number;
  syncIntervalMs: number;
  syncBatch: number;
}

type Reader = (name: string) => string | undefined;

export function resolveElasticsearchSettings(
  read: Reader,
): ElasticsearchSettings {
  return {
    enabled: read('ELASTICSEARCH_ENABLED') !== 'false',
    profiles: parseList(read('ELASTICSEARCH_PROFILES')),
    indexPrefix: parsePrefix(read('ELASTICSEARCH_INDEX_PREFIX')),
    searchTimeoutMs: parsePositiveInt(
      read('ELASTICSEARCH_SEARCH_TIMEOUT_MS'),
      DEFAULT_SEARCH_TIMEOUT_MS,
    ),
    syncIntervalMs: parsePositiveInt(
      read('ELASTICSEARCH_SYNC_INTERVAL_MS'),
      DEFAULT_SYNC_INTERVAL_MS,
    ),
    syncBatch: Math.min(
      parsePositiveInt(read('ELASTICSEARCH_SYNC_BATCH'), DEFAULT_SYNC_BATCH),
      1000,
    ),
  };
}

function parseList(raw: string | undefined): ReadonlySet<string> {
  const items = (raw ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item !== '');
  return new Set(items);
}

/** Chỉ nhận kebab-case chữ thường; giá trị lạ bị bỏ để tên index luôn hợp lệ (naming.md). */
function parsePrefix(raw: string | undefined): string {
  const value = (raw ?? '').trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*-?$/.test(value) ? value : '';
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
