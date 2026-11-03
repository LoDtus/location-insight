# Hợp đồng nội bộ: lớp tìm kiếm (`SearchService` / `SearchProfile`)

Không phải API HTTP; không thêm endpoint REST. Mỗi module giữ endpoint tìm kiếm riêng của mình và gọi `SearchService`. Đây là **bản đặc tả** (mã chưa tồn tại). Không dùng `any` (`.cursor/rules/global.md` §2).

## SearchProfile (khai báo một lần mỗi nơi dùng ES)

```ts
interface SearchFieldSpec {
  /** Tên trường trong document ES, camelCase. */
  name: string;
  /** Nhân vào boost các tầng (ví dụ title 3, address 1). */
  boost: number;
  /** Trường ngắn: bật chữ dính, gõ dở, fuzzy. Trường dài: false (BR-05). */
  short: boolean;
}

interface SearchFilterSpec {
  name: string;                       // trường keyword/date/boolean trong ES
  kind: 'term' | 'terms' | 'range';
}

interface SearchProfile<TRow, TFilters> {
  /** Tên logic, kebab-case số nhiều: 'discussion-topics'. Alias = tên này, index = `${name}-v${version}`. */
  readonly name: string;
  /** Tăng khi đổi analyzer/mapping (BR-06). */
  readonly version: number;
  readonly fields: readonly SearchFieldSpec[];
  readonly filters: readonly SearchFilterSpec[];
  /** Cùng sắp xếp mặc định khi hòa điểm, ví dụ updatedAt desc. */
  readonly tieBreaker: readonly SortSpec[];
  /** Mặc định 0.15 (FR-05). */
  readonly scoreRatioMin?: number;
  /** refresh_interval của index, mặc định '5s'. */
  readonly refreshInterval?: string;

  /** Hàng PostgreSQL -> document ES (chỉ trường cần tìm/lọc, FR-15). Trả null nếu bản ghi không nên nằm trong ES (đã ẩn/xóa). */
  toDocument(row: TRow): SearchDocument | null;
  /** Nạp hàng theo lô cho worker/reindex: keyset theo id, lọc updated_at >= since (nếu có). */
  loadBatch(afterId: string | null, limit: number, since?: Date): Promise<TRow[]>;
  loadByIds(ids: readonly string[]): Promise<TRow[]>;
  /** Chuyển bộ lọc của yêu cầu sang mệnh đề filter ES, gồm quyền xem (BR-08). */
  toFilters(filters: TFilters, viewer: SearchViewer): readonly SearchFilterClause[];
  /** Truy vấn dự phòng PostgreSQL (FR-10). Nhận cùng bộ lọc, trả đã sắp xếp. */
  fallback(request: SearchRequest<TFilters>): Promise<SearchHit<TRow>[]>;
}
```

## SearchService

```ts
interface SearchRequest<TFilters> {
  q: string;                           // thô từ client; service chuẩn hóa
  filters: TFilters;
  viewer: SearchViewer;                // dùng cho quyền xem
  page: { size: number; from: number };// size <= 50, from + size <= 1000
  sort?: SortSpec;                     // không có -> theo điểm (FR-06)
}

interface SearchResult<TRow> {
  items: Array<{ row: TRow; score: number | null }>;
  source: 'elasticsearch' | 'database';
  degraded: boolean;                   // true nếu đã rơi về PostgreSQL
  /** Chỉ có khi profile bật đếm (FR-14/Câu hỏi mở 6). */
  total?: number;
}

class SearchService {
  /** Trả null khi KHÔNG nên dùng ES (không có q, q quá ngắn, profile tắt, ES không khỏe): người gọi chạy luồng PostgreSQL thường. */
  search<TRow, TFilters>(
    profile: SearchProfile<TRow, TFilters>,
    request: SearchRequest<TFilters>,
  ): Promise<SearchResult<TRow> | null>;

  /** Gọi trong CÙNG giao dịch với thay đổi bản ghi (outbox). */
  enqueue(
    profile: SearchProfile<unknown, unknown>,
    id: string,
    op: 'upsert' | 'delete',
    manager: EntityManager,
  ): Promise<void>;
}
```

Cách module dùng (minh họa):

```ts
const result = await this.search.search(topicsProfile, { q, filters, viewer, page });
if (result === null) return this.repository.listWithFilters(filters, sort, page); // luồng PostgreSQL bình thường
return result; // đã hydrate từ PostgreSQL, đúng thứ tự
```

## Điều kiện bắt buộc

- `search()` tự quyết có gọi ES hay không (FR-01) và trả `null` khi không; người gọi **không** tự kiểm `ELASTICSEARCH_ENABLED`.
- Chuẩn hóa `q`: cắt khoảng trắng, NFC, bỏ ký tự điều khiển, gộp khoảng trắng liên tiếp, cắt còn ≤ 120 ký tự và ≤ 8 từ. Sau chuẩn hóa còn < 2 ký tự: `null`.
- Truy vấn dựng **chỉ** từ `match`/`match_phrase`/`multi_match`; `q` đi vào trường `query` dạng chuỗi, không ghép vào cấu trúc.
- Tìm kiếm đặt `_source: false`, `timeout: '2s'`, `track_total_hits: false` (trừ khi bật đếm).
- Hydrate: `loadByIds` giữ thứ tự ES; bản ghi không có/không được xem bị bỏ và gọi `enqueue(..., 'delete')` (FR-07).
- `enqueue` trong cùng giao dịch; worker đọc lại hàng hiện tại, nếu `toDocument` trả `null` thì xóa document.
- Lỗi ES không bao giờ ném ra người dùng: ghi nhật ký, tăng số liệu, rơi về `fallback` (FR-10).
- Nhật ký không ghi `q` đầy đủ ở mức info (có thể chứa dữ liệu cá nhân); ghi độ dài và số kết quả.

## Mã lỗi nghiệp vụ gợi ý (ở endpoint của module)

| Tình huống | HTTP | Ghi chú |
| --- | --- | --- |
| `q` rỗng/quá ngắn/quá dài hoặc `size`/`from` vượt giới hạn | 422 | Trước khi gọi ES (hoặc coi `q` ngắn là "không có q" nếu UI cho phép) |
| Vượt tần suất | 429 | Dùng throttler hiện có, giới hạn riêng cho tìm kiếm |
| ES lỗi | 200 | Trả kết quả dự phòng với `degraded = true`, không lỗi |
