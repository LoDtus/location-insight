# Cấu hình và vận hành (017-search-elasticsearch)

Tuân `.cursor/rules/env-docker.md`: biến môi trường chỉ sửa ở `.env.development`, `.env.production`, `.env.example` ở root; compose chỉ nối dây. Tài liệu này là đặc tả; chưa sửa các tệp đó.

## Biến môi trường

| Biến | Có sẵn? | Ý nghĩa | Dev | Production (một máy) |
| --- | --- | --- | --- | --- |
| `ELASTICSEARCH_NODE` | Có | URL ES backend gọi | compose ghi đè `http://elasticsearch:9200` | `http://elasticsearch:9200` (mạng Docker nội bộ) |
| `ELASTICSEARCH_USERNAME` | Có (đang rỗng) | Người dùng kết nối | rỗng (bảo mật tắt) | người dùng riêng của ứng dụng, **không** dùng `elastic` |
| `ELASTICSEARCH_PASSWORD` | Có (đang rỗng) | Mật khẩu | rỗng | giá trị thật, ngoài repo |
| `ELASTICSEARCH_PORT` | Có | Cổng publish ra host | như hiện tại | chỉ gắn `127.0.0.1`, hoặc không publish |
| `ELASTICSEARCH_ENABLED` | Có (đã thêm vào `.env*`) | Công tắc tổng; `false` thì bỏ qua ES hoàn toàn, không kết nối | `true` | `true`/`false` |
| `ELASTICSEARCH_PROFILES` | Có (đã thêm; mặc định rỗng) | Danh sách profile được dùng ES, cách nhau dấu phẩy (BR-02). Rỗng = không profile nào | tên profile đang thử | các profile đã duyệt |
| `ELASTICSEARCH_INDEX_PREFIX` | Có (đã thêm), tùy chọn | Tiền tố tên index/alias khi dùng chung cụm (`li-dev-`) | rỗng | rỗng |
| `ELASTICSEARCH_SEARCH_TIMEOUT_MS` | Có (đã thêm), tùy chọn | Timeout mỗi lần tìm | `2000` | `2000` |
| `ELASTICSEARCH_SYNC_INTERVAL_MS` | Có (đã thêm), tùy chọn | Chu kỳ worker đọc outbox | `2000` | `2000` |
| `ELASTICSEARCH_SYNC_BATCH` | Có (đã thêm), tùy chọn; tối đa 1000 | Số dòng outbox mỗi lô bulk | `200` | `200` |

Ghi chú:

- Bật/tắt từng nơi dùng ES chỉ bằng `ELASTICSEARCH_PROFILES` (không cần phát hành lại mã) là cách thực hiện "tôi chỉ định chỗ nào dùng ES".
- Đổi `ELASTICSEARCH_ENABLED=false` luôn an toàn: mọi tìm kiếm rơi về PostgreSQL (FR-10, FR-11).
- Điều chỉnh `requestTimeout: 30000` toàn cục của client cho thao tác nền (bulk, reindex), nhưng truyền timeout 2 giây riêng cho từng lần tìm.
- Cổng `9200`/`9300` nội bộ được phép ghi cứng trong image; cổng publish ra host luôn là `${ELASTICSEARCH_PORT}`.

## Dev: ghi chú

- Giữ cấu hình dev hiện tại: một node, bảo mật tắt, heap 512 MB, volume `elasticsearch_data`.
- `/reset` (xóa DB dev) **không** động tới ES. Hậu quả: ES giữ id cũ; bước hydrate loại chúng và dọn dần (FR-07). Để index đầy đủ lại sau reset, tăng `version` của profile hoặc xóa alias để ứng dụng dựng lại (chưa có lệnh CLI). Không đổi hành vi `/reset` (`.cursor/rules/dev-reset.md`).
- ES từ chối xóa bằng ký tự đại diện (`action.destructive_requires_name`): xóa index tay phải gọi đúng tên.
- Kiểm tra tay, khi cần thử nghiệm: dùng index có tiền tố riêng (`test-`) và xóa sau khi xong; không đụng alias của profile thật.

## Production một máy: các điểm bắt buộc

1. **Phiên bản:** ghim image (`9.2.0` hiện tại hoặc phiên bản đã chọn ở Câu hỏi mở 3), không dùng `latest`; client và server cùng minor.
2. **Bảo mật bật** (khác dev): bỏ các dòng `xpack.security.*: "false"`, đặt mật khẩu `elastic` qua `ELASTIC_PASSWORD` (map từ `ELASTICSEARCH_PASSWORD`, đúng ngoại lệ "map tên mà image bắt buộc" của `env-docker.md`). Tạo role + user riêng cho ứng dụng; không dùng siêu người dùng trong ứng dụng. Role mẫu (kiểm lại tên đặc quyền với phiên bản đang chạy):

```json
{
  "cluster": ["monitor", "manage_search_synonyms"],
  "indices": [
    {
      "names": ["discussion-topics*", "places*"],
      "privileges": ["create_index", "manage", "read", "write", "view_index_metadata"]
    }
  ]
}
```

   (`manage` cần để đổi alias; thu hẹp `names` theo `ELASTICSEARCH_INDEX_PREFIX` và danh sách profile thật.) Mastodon áp dụng cùng ý: role riêng chỉ có `monitor` và quyền index, giới hạn theo tiền tố.
3. **Không công khai ES:** không publish `9200` ra mọi giao diện. Hoặc không `ports`, backend gọi qua tên dịch vụ; hoặc `127.0.0.1:${ELASTICSEARCH_PORT}:9200` để quản trị cục bộ. HTTP TLS có thể tắt khi chỉ đi trong mạng Docker nội bộ (đánh đổi chấp nhận được cho một máy); bật lại nếu ES ra khỏi mạng nội bộ.
4. **Bộ nhớ:** đặt `ES_JAVA_OPTS=-Xms<N>g -Xmx<N>g` (hai giá trị bằng nhau). Mastodon khuyên heap 25–50% bộ nhớ; quy tắc "tối đa 50% RAM, dưới ~31 GB" là kiến thức nền, kiểm tra lại với tài liệu Elastic trước khi chốt. Phần RAM còn lại để cho bộ đệm hệ điều hành của Lucene. Dev đang dùng 512 MB.
5. **Hệ điều hành máy chủ:** ở chế độ production, ES chạy bootstrap check; cần `vm.max_map_count=262144` trên máy host (kiến thức nền, tài liệu Elastic mà tôi đọc không nêu giá trị). Thiếu thì container không khởi động.
6. **Dữ liệu:** bind mount tới thư mục riêng trên đĩa (ví dụ `disk/elasticsearch`, đã nằm trong `.gitignore` qua `/disk`), thuộc uid mà image ES dùng; không đặt chung đĩa hệ điều hành; theo dõi dung lượng đĩa vì ES ngừng ghi khi vượt ngưỡng watermark.
7. **Cụm một node:** `discovery.type=single-node`, `number_of_shards: 1`, `number_of_replicas: 0` (đã đúng trong `ElasticsearchConfig.defaultSettings`).
8. **Sao lưu:** dữ liệu dựng lại được từ PostgreSQL nên mất ES chỉ tốn thời gian `search:reindex` (RTO), không mất dữ liệu. Vì vậy snapshot là **tùy chọn** ở giai đoạn 1. Nếu muốn rút ngắn RTO: đăng ký repository `fs` (`path.repo`) trên đĩa khác và dùng SLM hằng đêm. Lưu ý từ tài liệu Elastic: snapshot là cách sao lưu duy nhất được hỗ trợ (không sao chép thư mục dữ liệu), và không khôi phục lên phiên bản thấp hơn. Bộ từ đồng nghĩa nằm trong ES nhưng **nguồn chuẩn ở repo** nên không phụ thuộc snapshot.
9. **Health check compose:** giữ `curl -fsS http://localhost:9200` (khi bật bảo mật cần truyền xác thực hoặc kiểm bằng `_cluster/health` với thông tin đăng nhập).

## Từ đồng nghĩa: nguồn chuẩn và cách áp dụng

- Tệp trong repo: `backend/src/modules/search/search-synonyms.ts` (hằng `VI_COMMON_SYNONYMS`), cùng cấu trúc `{ id, synonyms }` của Synonyms API. Ví dụ nội dung:

```json
{
  "synonyms_set": [
    { "id": "benh-vien", "synonyms": "bv, bệnh viện, benh vien" },
    { "id": "chung-cu", "synonyms": "cc, chung cư, chung cu" },
    { "id": "thanh-pho", "synonyms": "tp, thành phố, thanh pho" }
  ]
}
```

- Áp dụng bằng `PUT _synonyms/vi-common` khi triển khai/khởi động (idempotent, ES tự nạp lại analyzer). **Bộ phải tồn tại trước khi tạo index** tham chiếu nó.
- Viết tắt **một chữ cái** (`q`, `p`) rất mơ hồ và gây nhiễu; chỉ thêm khi đã đo trên dữ liệu thật. Danh sách trên chỉ là mẫu cần chủ dự án duyệt, không phải danh mục chốt.
- Viết quy tắc cả dạng có dấu và không dấu (analyzer đã bỏ dấu nên hai dạng thực chất là một).

## Dựng index và vòng đời (tóm tắt)

- Tên: `{prefix}{profile}-v{version}`; alias: `{prefix}{profile}` (naming.md).
- Khi ES sẵn sàng: áp dụng bộ từ đồng nghĩa, rồi với mỗi profile đã bật: nếu alias chưa có hoặc phiên bản thấp hơn thì dựng lại ở nền (tên index luân phiên `-vN`/`-vN-b`).
- Đổi analyzer/mapping: tăng `version` của profile và triển khai; ứng dụng tự dựng index mới và đổi alias. Index trước được giữ lại tới lần dựng lại kế tiếp để quay lui. Chưa có lệnh CLI thủ công.
- Chi tiết: `diagrams/flow-reindex-zero-downtime.mmd`.

## Danh mục kiểm khi thêm một profile mới

- [ ] Tên profile kebab-case số nhiều; trường `camelCase`; chỉ trường cần tìm/lọc (FR-15).
- [ ] Xác định trường ngắn/dài (BR-05).
- [ ] Viết `toFilters` kèm quyền xem; `fallback` PostgreSQL; `loadBatch` + `loadByIds`.
- [ ] Gọi `enqueue` trong cùng giao dịch ở mọi chỗ tạo/sửa/xóa/ẩn bản ghi.
- [ ] Bộ ca vàng (≥ 20 truy vấn lỗi gõ) chạy đạt.
- [ ] Thêm tên vào `ELASTICSEARCH_PROFILES` (dev trước).
