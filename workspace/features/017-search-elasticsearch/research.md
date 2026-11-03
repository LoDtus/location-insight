# Technical Research — Tìm kiếm gần đúng với Elasticsearch

Nguồn đọc ngày 03/11/2026 trừ khi ghi khác. Con số trong tài liệu này là **mục tiêu thiết kế hoặc kết quả thử nghiệm trên kho nhỏ**, không phải số đo hiệu năng của dự án.

**Tài liệu chính thức (Elastic)**

- [Match query](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-match-query): `fuzziness`, `prefix_length` (mặc định 0), `max_expansions` (mặc định 50), `fuzzy_transpositions` (mặc định `true`, đảo hai ký tự liền nhau tính 1 lỗi), `operator`, `minimum_should_match`. Fuzzy **bị bỏ qua với từ có từ đồng nghĩa**. Khi `search.allow_expensive_queries=false`, match có fuzziness báo lỗi.
- [Fuzziness (common options)](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/common-options): `AUTO` = độ dài 0–2 khớp đúng, 3–5 sai 1, > 5 sai 2; mặc định `AUTO:3,6`; "AUTO should generally be the preferred value".
- [search_as_you_type](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/search-as-you-type): sinh `_2gram`, `_3gram`, `_index_prefix`; `max_shingle_size` 2–4; truy vấn khuyến nghị `multi_match` kiểu `bool_prefix`; tăng shingle làm tăng kích thước index.
- [Synonyms](https://www.elastic.co/docs/solutions/search/full-text/search-with-synonyms): bộ từ đồng nghĩa quản lý qua API tự nạp lại analyzer; `synonym_graph` dành cho analyzer **lúc tìm**; bộ quản lý bằng API chỉ dùng lúc tìm; khuyến nghị tìm-lúc để cập nhật không cần reindex; inline "không khuyến nghị cho production"; bộ phải tồn tại trước khi index tham chiếu.
- [Aliases](https://www.elastic.co/docs/manage-data/data-store/aliases): đổi alias bằng một yêu cầu gồm `remove` + `add` là nguyên tử ("never points to both at the same time"); `is_write_index`.
- [Snapshot and restore](https://www.elastic.co/docs/deploy-manage/tools/snapshot-and-restore): snapshot là cách sao lưu duy nhất được hỗ trợ ("only reliable and supported way"), sao chép thư mục dữ liệu không được hỗ trợ; snapshot tăng dần theo segment; không khôi phục lên phiên bản thấp hơn; SLM để tự động hóa.
- [Important settings](https://www.elastic.co/docs/deploy-manage/deploy/self-managed/important-settings-configuration): khuyến nghị heap mặc định tự tính; `path.data` ngoài `$ES_HOME`; `network.host` không phải loopback → chế độ production, bootstrap check lỗi thì không khởi động. Trang này **không** nêu giá trị `vm.max_map_count`, `discovery.type`, quy tắc 50% RAM — các điểm đó lấy từ nguồn khác bên dưới hoặc ghi rõ là kiến thức nền.

**Dự án mã nguồn mở**

- Mastodon, [Full-text search](https://docs.joinmastodon.org/admin/elasticsearch/): tìm kiếm chữ **tùy chọn**, chỉ hoạt động khi ES có; phạm vi tìm bị giới hạn có chủ đích ("deliberately does not allow searching for arbitrary strings in the entire database"); preset `single_node_cluster` (không replica); heap 25–50% bộ nhớ, min = max; khuyên bật bảo mật ES, tạo role/user riêng chỉ có `monitor` và quyền index, giới hạn theo tiền tố index, chạy ES chỉ lắng nghe localhost sau tường lửa; `ES_PREFIX` khi dùng chung cụm; lệnh `tootctl search deploy` để dựng index.
- Mattermost (qua [kết quả tìm kiếm](https://docs.mattermost.com/administration-guide/scale/elasticsearch.html); trang gốc tôi không mở được, 404): tìm kiếm **mặc định bằng cơ sở dữ liệu**, ES bật sau; phải **bulk index** dữ liệu cũ xong rồi mới bật truy vấn bằng ES (trong lúc đó tìm kiếm DB vẫn chạy); khi ES không có thì **rơi về tìm DB**; deployment lớn có thể tắt DB search sau khi ES ổn. Thông tin từ trang tóm tắt, cần đối chiếu nếu dựa vào.
- GitLab Advanced Search (qua [tài liệu phát triển lưu trữ](https://archives.docs.gitlab.com/16.3/ee/development/advanced_search.html); trang hiện hành yêu cầu đăng nhập nên không mở được): reindex **không downtime** bằng cách tạo index mới, nạp dữ liệu cũ trong khi tìm kiếm vẫn dùng index ổn định, và đẩy cập nhật tới cả hai; dùng alias; thay đổi theo dõi qua hàng đợi (tóm tắt nói Redis ZSET, **chưa xác minh**), có số liệu Prometheus cho độ sâu hàng đợi.
- [duydo/elasticsearch-analysis-vietnamese](https://github.com/duydo/elasticsearch-analysis-vietnamese): plugin tách từ tiếng Việt `vi_analyzer`, Apache-2.0, hỗ trợ ES tới 9.3.0, dùng thư viện native CocCoc tokenizer (phải dựng bằng CMake và đặt thư viện JNI + từ điển trên máy), có thể kèm `asciifolding`. Không mở được ngày phát hành mới nhất.

**Chưa mở lại trong phiên này (kiến thức nền, xác minh nếu dựa vào):** Discourse và Zulip dùng PostgreSQL full-text thay vì ES (minh họa rằng nhiều dự án chọn không dùng ES khi chưa cần); Kibana/Elastic Cloud là đích "managed" tương thích; cách ES S3 snapshot repository làm việc với R2.

---

## Thử nghiệm thực tế (2026-11-03)

Dựng index tạm trên ES dev 9.2.0, nạp 12 địa danh Hà Nội, chạy 19 truy vấn lỗi gõ, rồi xóa index và synonym set. Kết quả chi tiết ở `analysis-and-queries.md` mục 4. Điều rút ra cho quyết định:

- Bộ phân tích **không plugin** đủ cho: bỏ dấu (gồm `đ`), chuỗi Unicode NFD, ghép chữ dính, gõ dở.
- Truy vấn `match` + `fuzziness: AUTO` cứu đảo/sai/thừa/thiếu chữ cái. **`match` không nhận tham số `transpositions`** (lỗi `400 [match] query does not support [transpositions]`); đúng là `fuzzy_transpositions` (mặc định bật).
- Nhiễu có điểm 2–7% điểm đầu bảng; kết quả đúng thấp nhất 30% → cắt theo tỉ lệ điểm khả thi.
- Synonyms API với `updateable: true` cập nhật được ngay, không reindex.

---

## Bản ghi quyết định 1 — ES là chỉ mục tìm kiếm bổ sung, PostgreSQL là nguồn sự thật, bật theo từng profile <!-- key: decision_record -->

**Status:** Accepted
**Category:** Architecture
**Door Type:** Two-way

### Bối cảnh <!-- key: context -->

Chủ dự án chỉ muốn ES xuất hiện ở một số chỗ, và chỉ khi người dùng gõ chữ để tìm. Lọc/sắp xếp không được qua ES.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Hợp với stack | Bảo trì (dev đơn lẻ) | Đảo ngược | Ghi chú |
| --- | --- | --- | --- | --- |
| A. ES làm bản sao tìm kiếm, ghi từ PostgreSQL, bật theo profile | Rất hợp (đã có ES, đã có tiền lệ outbox) | Trung bình | Cao | Khớp cách Mastodon, Mattermost, GitLab |
| B. ES là kho dữ liệu chính của module | Khác hẳn mô hình dữ liệu hiện có | Thấp | Thấp | Mất ràng buộc quan hệ, khó quyền xem |
| C. Chỉ PostgreSQL (`pg_trgm` + `unaccent`) | Không thêm hạ tầng | Cao | Cao | Không đảo từ/dính chữ/ngữ nghĩa tốt; ES đã có sẵn trong hạ tầng và chủ dự án muốn dùng |
| D. ES cho mọi tìm kiếm | Trái yêu cầu | — | — | Loại |

### Quyết định

**A.** Điều kiện gọi ES: có `q` ≥ 2 ký tự, profile bật, ES khỏe (FR-01). Mọi ca khác chạy PostgreSQL. `pg_trgm` (C) được giữ như một phương án *nâng cấp đường dự phòng* nếu `ILIKE` hiện tại quá kém khi ES tắt (không bắt buộc ở giai đoạn 1).

---

## Bản ghi quyết định 2 — Bộ phân tích tiếng Việt không plugin <!-- key: decision_record_analysis -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** Two-way (đổi analyzer = index phiên bản mới)

### Các phương án

| Option | Ưu | Nhược |
| --- | --- | --- |
| A. `standard` + `strip_combining` + `asciifolding` + shingle dính chữ + `search_as_you_type` | Không plugin, chạy trên image ES chuẩn, đã thử | Không tách từ ghép (`hồ gươm`) |
| B. Plugin `elasticsearch-analysis-vietnamese` (CocCoc) | Tách từ ghép đúng ngữ pháp | Phải build native, gắn vào image, bám phiên bản ES; tăng gánh bảo trì |
| C. Plugin `analysis-icu` (`icu_folding`) | Chuẩn hóa Unicode mạnh | Phải cài plugin; `asciifolding` đã đủ cho tiếng Việt theo thử nghiệm |

### Quyết định

**A.** Tiếng Việt cách âm tiết bằng dấu cách nên tách theo âm tiết là đủ cho tìm tên/địa danh/tiêu đề; các lỗi cần xử lý (không dấu, đảo, dính, sai chữ) không đòi hỏi tách từ ghép. **B** chỉ khi bộ ca thật chứng tỏ cần (Câu hỏi mở 7).

---

## Bản ghi quyết định 3 — Truy vấn nhiều tầng bằng `bool.should`, không dùng `query_string` <!-- key: decision_record_query -->

**Status:** Accepted
**Category:** Architecture
**Door Type:** Two-way

### Các phương án

| Option | Ghi chú |
| --- | --- |
| A. Nhiều mệnh đề `should` có boost (cụm đúng > đủ từ > fuzzy > tiền tố) | Dễ giải thích thứ tự, kiểm thử bằng bộ ca; đã thử cho kết quả đúng ở 15/15 ca có nghĩa |
| B. Một `multi_match` `fuzziness: AUTO` | Đơn giản nhưng không phân biệt đúng-dấu với không-dấu, không bắt chữ dính, khó kiểm soát thứ tự |
| C. `query_string`/`simple_query_string` | Cho người dùng cú pháp; rủi ro chèn toán tử, tốn chi phí; không cần |
| D. `function_score`/`rescore` với tín hiệu phổ biến, độ mới | Hữu ích sau; thêm khi có tín hiệu thật |

### Quyết định

**A** làm mặc định, `tieBreaker` của profile giải quyết hòa điểm. **D** là bậc sau (roadmap bậc 2). Tuyệt đối **không C** (threat-model T1).

---

## Bản ghi quyết định 4 — Từ đồng nghĩa lúc tìm bằng Synonyms API, nguồn chuẩn là tệp trong repo <!-- key: decision_record_synonyms -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** Two-way

### Các phương án

| Option | Ghi chú |
| --- | --- |
| A. Synonyms API + `synonym_graph` `updateable`, lúc tìm | Đổi ngay, không reindex (đã thử); bộ nằm trong ES nên cần nguồn chuẩn ngoài ES |
| B. Tệp trên node (`synonyms_path`) | Tài liệu: "less flexible"; phải đồng bộ mọi node và nạp lại thủ công |
| C. Inline trong index | Tài liệu: không khuyến nghị cho production; đổi cần reindex |
| D. Từ đồng nghĩa lúc lập chỉ mục | Phải reindex khi đổi; chỉ dùng filter `synonym` thường |

### Quyết định

**A**, với nguồn chuẩn là tệp JSON trong repo, áp dụng bằng `PUT _synonyms/vi-common` (idempotent) khi triển khai/khởi động, để mất ES không mất từ đồng nghĩa. Chuyển sang bảng PostgreSQL + màn hình admin khi cần (Câu hỏi mở 5).

---

## Bản ghi quyết định 5 — Đồng bộ bằng outbox PostgreSQL + worker, trạng thái đọc lại từ DB <!-- key: decision_record_sync -->

**Status:** Accepted
**Category:** Data Flow
**Door Type:** Two-way

### Các phương án

| Option | Hợp với stack | Rủi ro |
| --- | --- | --- |
| A. Outbox cùng giao dịch + worker `SKIP LOCKED` (đọc trạng thái hiện tại rồi bulk) | Có tiền lệ (`email-worker`, `push_outbox`) | Cần bảng và worker |
| B. Ghi ES ngay trong yêu cầu (dual write) | Đơn giản | Mất đồng bộ khi ES lỗi/giữa giao dịch; tăng độ trễ API |
| C. CDC (Debezium → Kafka → ES) | Chuẩn cho quy mô lớn | Quá nặng cho một máy |
| D. Chỉ reindex định kỳ | Đơn giản nhất | Độ trễ lớn, tốn tài nguyên |

### Quyết định

**A.** Worker không tin payload cũ trong outbox mà **đọc trạng thái hiện tại** từ PostgreSQL (tự khử thứ tự và trùng lặp). Gộp theo `(profile, id)`. **D** vẫn có dưới dạng lệnh `search:reindex` cho dựng lại/bù. **C** là bậc xa trong roadmap.

---

## Bản ghi quyết định 6 — ES tùy chọn, có dự phòng PostgreSQL và ngắt mạch <!-- key: decision_record_fallback -->

**Status:** Accepted
**Category:** Reliability
**Door Type:** Two-way

### Quyết định

ES không được là điểm chết của ứng dụng: không chặn khởi động, không loại khỏi readiness, tìm kiếm rơi về truy vấn dự phòng của profile (`source = 'database'`). Mattermost cũng rơi về tìm DB khi ES không khả dụng. Sau 3 lỗi liên tiếp, ngắt mạch 30 giây (trong bộ nhớ tiến trình; không cần Redis). Đánh đổi: kết quả dự phòng kém chính xác hơn; giao diện được thông báo `degraded` để tùy chọn hiển thị.

---

## Bản ghi quyết định 7 — Một node, 1 shard, 0 replica; đường lên nhiều node giữ nguyên hợp đồng <!-- key: decision_record_topology -->

**Status:** Accepted
**Category:** Infrastructure
**Door Type:** Two-way

### Các phương án

| Option | Ghi chú |
| --- | --- |
| A. Một node (`discovery.type: single-node`), 1 shard, 0 replica | Khớp "chỉ chạy trên một máy/đĩa"; Mastodon khuyên `single_node_cluster` không replica |
| B. Ba node, replica 1 | Chịu lỗi nhưng không cần cho quy mô hiện tại |
| C. Dịch vụ managed | Chi phí và phụ thuộc bên ngoài; chưa cần |

### Quyết định

**A**; dữ liệu dựng lại được từ PostgreSQL nên mất node = reindex, không mất dữ liệu. Hợp đồng ứng dụng (alias, profile, `SearchService`) không đổi khi lên B/C (roadmap).
