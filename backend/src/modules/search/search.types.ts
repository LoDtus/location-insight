import type { estypes } from '@elastic/elasticsearch';

/** Trường văn bản tìm kiếm của một profile (xem 017-search-elasticsearch/interfaces/search-port.md). */
export interface SearchFieldSpec {
  /** Tên trường trong document ES, camelCase. */
  name: string;
  /** Nhân vào boost các tầng (ví dụ tiêu đề 3, địa chỉ 1). */
  boost: number;
  /** Trường ngắn: bật chữ dính, gõ dở và fuzzy. Trường dài: false (BR-05). */
  short: boolean;
}

export interface SearchFilterSpec {
  name: string;
  type: 'keyword' | 'boolean' | 'date' | 'long';
}

export interface SortSpec {
  field: string;
  order: 'asc' | 'desc';
}

export interface SearchViewer {
  userId: string | null;
  isAdmin: boolean;
}

export type SearchDocument = Record<string, unknown>;
export type SearchFilterClause = estypes.QueryDslQueryContainer;

export interface SearchPage {
  size: number;
  from: number;
}

export interface SearchRequest<TFilters> {
  /** Chuỗi thô từ client; service tự chuẩn hóa. */
  q: string;
  filters: TFilters;
  viewer: SearchViewer;
  page: SearchPage;
  /** Không có thì xếp theo điểm (FR-06). */
  sort?: SortSpec;
}

export interface SearchResult<TRow> {
  items: Array<{ row: TRow; score: number | null }>;
  source: 'elasticsearch' | 'database';
  /** true nếu đã rơi về PostgreSQL vì ES không dùng được. */
  degraded: boolean;
}

/** Khai báo một nơi dùng ES. Phương thức khai báo dạng method để TS cho phép gán profile cụ thể vào registry. */
export interface SearchProfile<TRow, TFilters> {
  /** kebab-case số nhiều, ví dụ 'discussion-topics'. Alias = tên này, index = `${name}-v${version}`. */
  readonly name: string;
  /** Tăng khi đổi analyzer hoặc mapping (BR-06). */
  readonly version: number;
  readonly fields: readonly SearchFieldSpec[];
  readonly filters: readonly SearchFilterSpec[];
  /** Sắp xếp khi hòa điểm, ví dụ updatedAt desc. Cuối cùng luôn theo `docId`. */
  readonly tieBreaker: readonly SortSpec[];
  /** Mặc định 0.15 (FR-05). */
  readonly scoreRatioMin?: number;
  /** refresh_interval của index, mặc định '5s'. */
  readonly refreshInterval?: string;

  idOf(row: TRow): string;
  /** Hàng PostgreSQL → document ES (chỉ trường cần tìm/lọc, FR-15). null nếu bản ghi không nên nằm trong ES. */
  toDocument(row: TRow): SearchDocument | null;
  /** Nạp theo lô cho reindex: keyset theo id tăng dần; `since` lọc `updated_at >= since`. */
  loadBatch(
    afterId: string | null,
    limit: number,
    since?: Date,
  ): Promise<TRow[]>;
  /** Trả các hàng còn tồn tại, KHÔNG lọc quyền xem (quyền xem do `canView`). */
  loadByIds(ids: readonly string[]): Promise<TRow[]>;
  canView(row: TRow, viewer: SearchViewer): boolean;
  /** Bộ lọc của yêu cầu, gồm quyền xem (BR-08). */
  toFilters(filters: TFilters, viewer: SearchViewer): SearchFilterClause[];
  /** Truy vấn dự phòng PostgreSQL (FR-10), đã sắp xếp và phân trang. */
  fallback(request: SearchRequest<TFilters>): Promise<TRow[]>;
}
