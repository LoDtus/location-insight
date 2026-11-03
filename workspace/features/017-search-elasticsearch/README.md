# Nền tảng tìm kiếm gần đúng với Elasticsearch

**Feature ID:** 017-search-elasticsearch
**Status:** Draft
**Last Updated:** 2026-11-03

## Tổng quan <!-- key: overview -->

Elasticsearch (ES) là **công cụ tìm kiếm chữ bổ sung**, không phải cơ chế tìm kiếm mặc định. Module nào cần thì được chỉ định rõ (qua một *search profile*), và chỉ khi người dùng **gõ chữ để tìm**. Lọc và sắp xếp thuần vẫn chạy bằng PostgreSQL như hiện nay. ES chịu được các lỗi gõ thường gặp của tiếng Việt: không dấu, sai dấu, đảo thứ tự từ, dính chữ, sai/thiếu/thừa chữ cái, thừa/thiếu từ; và xếp kết quả **khớp nhất lên đầu**. Dữ liệu gốc luôn ở PostgreSQL; ES chỉ là bản sao dùng để tìm, xóa đi dựng lại được.

Đặc tả này **chỉ mô tả**, chưa có thay đổi mã. Phương án đã được thử trên cụm ES dev (9.2.0, tạo index tạm rồi xóa): xem `analysis-and-queries.md` mục "Kết quả thử nghiệm" và `research.md`.

## Mục tiêu & Phạm vi <!-- key: goals_scope -->

**In scope (giai đoạn 1):**

- Một lớp tìm kiếm dùng chung (`SearchService` + `SearchProfile`) để module nào cũng "cắm" được mà không viết lại truy vấn.
- Bộ phân tích tiếng Việt **không cần plugin**: bỏ dấu, chuẩn hóa Unicode, ghép chữ dính, gợi ý khi gõ dở.
- Truy vấn nhiều tầng: tầng khớp chính xác điểm cao nhất, tầng sai chính tả điểm thấp hơn, cắt nhiễu theo tỉ lệ điểm.
- Từ đồng nghĩa/viết tắt (ngữ nghĩa nhẹ, không AI): `bv ≈ bệnh viện`, `cc ≈ chung cư`… quản lý bằng Synonyms API, đổi không cần dựng lại index.
- Đồng bộ PostgreSQL → ES bằng bảng outbox + worker; dựng lại index không gián đoạn bằng alias.
- Chạy được khi ES tắt hoặc hỏng: ES là phụ thuộc **tùy chọn**, tự rơi về tìm kiếm PostgreSQL hiện có.
- Cấu hình, vận hành một node trên đĩa cục bộ (dev và production), bảo mật, sao lưu.

**Out of scope (chưa làm, thiết kế chỗ chứa — xem `scaling-roadmap.md`):**

- Tìm kiếm vector/AI (`semantic_text`, embedding, kNN, ELSER) và kết hợp RRF.
- Nhiều node, replica, phân vùng theo thời gian, ILM.
- Tách tiến trình worker, CDC (Debezium), Logstash.
- Plugin tách từ tiếng Việt (CocCoc) — chỉ nêu là phương án nâng cấp.
- Gợi ý tìm kiếm theo lịch sử/độ phổ biến, sửa lỗi "có phải bạn muốn tìm…".
- Chọn module/trường cụ thể: do chủ dự án chỉ định (xem `§Câu hỏi mở`).

## Đối tượng liên quan <!-- key: actors -->

- Người dùng: gõ chữ vào ô tìm của một màn hình đã được chỉ định dùng ES.
- Module nghiệp vụ (discussions, feedback, map/places, admin users…): khai báo `SearchProfile` và gọi `SearchService.search()`.
- Worker đồng bộ: đọc outbox, ghi ES theo lô.
- Người vận hành: dựng lại index, quản lý từ đồng nghĩa, sao lưu.
- Elasticsearch một node (Docker, đĩa cục bộ).

## Yêu cầu chức năng <!-- key: functional_requirements -->

- **FR-01 (khi nào gọi ES):** chỉ gọi khi (a) người dùng nhập chữ `q`, (b) sau chuẩn hóa `q` dài ≥ 2 ký tự, (c) profile được bật (`ELASTICSEARCH_PROFILES`) và ES đang khỏe. Không có `q` thì **không** gọi ES: lọc/sắp xếp/phân trang chạy bằng PostgreSQL. Sơ đồ: `diagrams/flow-when-to-use-es.mmd`.
- **FR-02 (profile):** mỗi nơi dùng ES khai báo một `SearchProfile` (tên, trường tìm kiếm + trọng số, trường lọc, hàm `toDocument`, truy vấn dự phòng PostgreSQL). Thêm nơi dùng mới = thêm một profile, không đổi `SearchService`. Hợp đồng ở `interfaces/search-port.md`.
- **FR-03 (chịu lỗi gõ):** các tình huống sau phải tìm ra đúng đối tượng ở **hạng 1**: không dấu; sai dấu; đảo thứ tự từ; dính chữ (`hoankiem`); đảo hai chữ cái liền nhau (`keim`); sai 1 chữ cái; thừa 1 chữ cái; thiếu 1 chữ cái; người dùng gõ thừa từ; người dùng gõ thiếu từ; đang gõ dở (`bach ma`); `đ` ↔ `d`. Bộ ca kiểm thử mẫu và kết quả ở `analysis-and-queries.md`.
- **FR-04 (xếp hạng):** kết quả xếp từ khớp nhất đến ít khớp nhất theo thứ tự tầng: cụm đúng có dấu > cụm đúng không dấu > đủ từ đảo thứ tự > chữ dính > sai chính tả (fuzzy) > gõ dở (tiền tố) > khớp một phần số từ. Cùng điểm thì xếp theo `tieBreaker` của profile (ví dụ độ mới/phổ biến), cuối cùng theo `docId` (trường keyword chứa id bản ghi) để ổn định.
- **FR-05 (cắt nhiễu):** loại kết quả có điểm < 15% điểm cao nhất của trang đầu (`scoreRatioMin`, chỉnh theo profile). Mọi kết quả sai chính tả hợp lệ phải vượt ngưỡng này (kiểm bằng bộ ca mẫu).
- **FR-06 (lọc kèm tìm):** khi có `q` kèm bộ lọc (thành phố, trạng thái, quyền xem…), bộ lọc đi vào mệnh đề `filter` của ES (không tính điểm, cache được). Người dùng chọn sắp xếp tường minh (mới nhất…): `q` chỉ còn là điều kiện khớp, ES sắp xếp theo trường đó, điểm dùng để cắt nhiễu.
- **FR-07 (hydrate):** ES chỉ trả `id` + điểm. Backend đọc bản ghi từ PostgreSQL theo `id`, giữ thứ tự của ES, kiểm quyền xem một lần nữa, bỏ `id` không còn/không được xem và xếp lệnh xóa vào outbox (tự chữa chỉ mục cũ). Không bao giờ trả `_source` của ES cho client.
- **FR-08 (đồng bộ):** thay đổi bản ghi và dòng outbox cùng giao dịch PostgreSQL. Worker (trong tiến trình backend, `FOR UPDATE SKIP LOCKED`, như `email-worker`) gộp theo `(profile, id)`, đọc **trạng thái hiện tại** từ PostgreSQL, ghi ES bằng Bulk API. Độ trễ mục tiêu ≤ 5 giây. Sơ đồ: `diagrams/sequence-index-sync.mmd`.
- **FR-09 (dựng lại):** `SearchIndexService.reindex(profile)` tạo index mới, nạp từ PostgreSQL theo lô keyset 1.000 dòng, bù các thay đổi trong lúc nạp (`updated_at` ≥ mốc bắt đầu − 60 giây), rồi đổi alias nguyên tử; một khóa tư vấn PostgreSQL ngăn hai instance dựng cùng lúc. Tự chạy ở nền khi profile đã bật mà **chưa có alias** hoặc **phiên bản index thấp hơn `profile.version`**. Tên index luân phiên `-vN` và `-vN-b` để dựng lại cùng phiên bản không đụng index đang phục vụ; index trước được giữ cho tới lần dựng lại kế tiếp (thay vì hẹn giờ 24 giờ). **Chưa có lệnh CLI** `search:reindex`: sẽ thêm khi có profile đầu tiên và biết module nào sở hữu nó. Sơ đồ: `diagrams/flow-reindex-zero-downtime.mmd`.
- **FR-10 (dự phòng):** profile **đã bật** nhưng ES chưa sẵn sàng, quá 2 giây, hoặc lỗi: `SearchService` trả kết quả từ truy vấn dự phòng của profile (PostgreSQL), kèm `source = 'database'`, `degraded = true`. Sau 3 lỗi liên tiếp, ngắt mạch 30 giây trước khi thử lại. Khi ES **tắt hẳn** (`ELASTICSEARCH_ENABLED=false`) hoặc profile **chưa bật**, `search()` trả `null` và người gọi chạy luồng PostgreSQL bình thường của mình.
- **FR-11 (ES tùy chọn):** ứng dụng **khởi động và chạy bình thường** khi ES tắt/chưa sẵn sàng hoặc `ELASTICSEARCH_ENABLED=false`. `/health/ready` báo ES là `degraded`, không làm hỏng readiness (điểm lệch 1–2).
- **FR-12 (từ đồng nghĩa):** từ đồng nghĩa nằm trong Synonyms API (`vi-common`), áp dụng lúc **tìm** (không lúc lập chỉ mục), đổi không cần dựng lại index. Nguồn chuẩn là tệp TypeScript trong repo `backend/src/modules/search/search-synonyms.ts`, được `PUT` idempotent mỗi khi ES sẵn sàng (`configuration.md`). Danh sách hiện có chỉ là mẫu 3 quy tắc cần chủ dự án duyệt.
- **FR-13 (giới hạn truy vấn):** `q` 2–120 ký tự, tối đa 8 từ (thừa bị cắt), `size` ≤ 50, `from + size` ≤ 1000, mỗi lần tìm timeout 2 giây. Dùng `match`, **không** dùng `query_string`.
- **FR-14 (quan sát):** số liệu: `search_requests_total{profile,source}`, `search_latency_ms{profile}`, `search_fallback_total{reason}`, `search_outbox_depth{profile}`, `search_outbox_lag_seconds`, `search_index_docs{profile}`, `search_zero_result_total{profile}`.
- **FR-15 (an toàn dữ liệu):** chỉ lập chỉ mục trường cần để tìm/lọc; không lập chỉ mục dữ liệu nhạy cảm (mật khẩu, token, email người dùng khác…) trừ profile quản trị đã được duyệt. Mapping `dynamic: strict`.

## Quy tắc nghiệp vụ <!-- key: business_rules -->

- **BR-01 (PostgreSQL là nguồn sự thật):** mất ES không mất dữ liệu; mọi thứ dựng lại được từ PostgreSQL (và tệp từ đồng nghĩa trong repo).
- **BR-02 (ES không phải mặc định):** không module nào tự động dùng ES. Dùng ES là quyết định rõ ràng: tạo profile, thêm tên vào `ELASTICSEARCH_PROFILES`, gọi `SearchService` đúng chỗ.
- **BR-03 (đặt tên, theo `.cursor/rules/naming.md`):** index `kebab-case`, số nhiều, hậu tố phiên bản: `discussion-topics-v1`; ứng dụng chỉ dùng **alias không hậu tố** (`discussion-topics`); trường `camelCase` (khớp JSON của API); analyzer/filter `snake_case` (`vi_fold`). Tiền tố tùy chọn `ELASTICSEARCH_INDEX_PREFIX` khi dùng chung cụm.
- **BR-04 (bộ phân tích dùng chung):** mọi profile dùng cùng bộ analyzer `vi_*` (`analysis-and-queries.md`). Không tự chế analyzer riêng cho từng profile nếu chưa có lý do đo được.
- **BR-05 (trường dài không fuzzy):** fuzzy và chữ dính chỉ áp cho trường **ngắn** (tên, tiêu đề, địa chỉ). Trường dài (nội dung bài) chỉ khớp không dấu + khớp một phần số từ, để tránh chậm và nhiễu.
- **BR-06 (phiên bản index):** đổi analyzer hoặc mapping = index `-vN+1` + reindex + đổi alias. Không sửa mapping tại chỗ trừ thêm trường mới.
- **BR-07 (nhất quán cuối cùng):** người vừa tạo bản ghi có thể chưa thấy nó trong kết quả tìm vài giây. Giao diện hiển thị bản ghi vừa tạo từ phản hồi API, không từ tìm kiếm.
- **BR-08 (ba lớp quyền):** bộ lọc quyền xem nằm trong truy vấn ES, **và** PostgreSQL kiểm lại khi hydrate (FR-07). ES không là nơi quyết định quyền cuối cùng.
- **BR-09 (bảo mật cụm):** production bật xác thực, không công khai cổng ES ra Internet (`configuration.md`).
- **BR-10 (không AI):** giai đoạn này không dùng embedding/LLM. Ngữ nghĩa chỉ là từ đồng nghĩa + chuẩn hóa chữ.

## Tóm tắt luồng người dùng <!-- key: user_flow_summary -->

1. **Tìm kiếm:** người dùng gõ chữ → backend chuẩn hóa `q` → ES trả danh sách `id` có điểm → PostgreSQL nạp bản ghi theo thứ tự → trả về. ES hỏng thì dự phòng PostgreSQL. Xem `diagrams/sequence-search.mmd`.
2. **Lọc/sắp xếp không có chữ:** PostgreSQL như cũ, không qua ES.
3. **Đồng bộ:** sửa/xóa bản ghi → dòng outbox cùng giao dịch → worker ghi ES. Xem `diagrams/sequence-index-sync.mmd`.
4. **Dựng lại:** người vận hành chạy `search:reindex` khi đổi mapping/analyzer. Xem `diagrams/flow-reindex-zero-downtime.mmd`.

## Bối cảnh kỹ thuật <!-- key: technical_context -->

**Hiện trạng (đối chiếu ngày 2026-11-03):**

- `backend/src/integrations/elasticsearch/`: `ElasticsearchIntegrationService` có `ping`, `createIndex`, `indexDocument`, `search(index, query)`; `ElasticsearchConfig` có `defaultSettings` (1 shard, 0 replica, `refresh_interval: 10s`) và `commonMappings`. **Chưa module nào dùng** (không index, không truy vấn).
- Tìm kiếm chữ hiện tại là `ILIKE` trên PostgreSQL: `admin-users.service.ts` (email, tên hiển thị), `discussions.service.ts` (tên chủ đề). Không có `pg_trgm`/`unaccent`.
- `infra/docker-compose.dev.yml`: dịch vụ `elasticsearch` image `9.2.0`, `discovery.type=single-node`, bảo mật tắt, heap 512 MB, volume `elasticsearch_data`, cổng `${ELASTICSEARCH_PORT}:9200`. `docker-compose.prod.yml` đang **trống**.
- Cụm dev: ES 9.2.0, Lucene 10.3.1, **không có plugin**, chưa có index.
- Tiền lệ: bảng outbox + `FOR UPDATE SKIP LOCKED` ở `email-worker.service.ts` và `push_outbox` của 014; quy tắc tên search layer ở `.cursor/rules/naming.md`.

**Điểm lệch cần xử lý khi triển khai (chưa sửa mã):**

Trạng thái (cập nhật 2026-11-03): ✅ đã làm trong mã/cấu hình · ⏳ còn lại.

| # | Hiện trạng ban đầu | Đặc tả yêu cầu | Trạng thái |
| --- | --- | --- | --- |
| 1 | `onModuleInit` thử 10 lần rồi **ném lỗi**: backend không khởi động được nếu ES tắt | Không chặn khởi động; thử lại nền; tuân `ELASTICSEARCH_ENABLED` (FR-11) | ✅ đã kiểm: backend lên bình thường khi ES tắt và tự nối lại khi ES trở lại |
| 2 | `/health/ready` coi ES là điều kiện sẵn sàng | Báo `degraded`, không loại instance khỏi vòng phục vụ (FR-11) | ✅ `elasticsearch: { mode: ready\|degraded\|disabled }`, luôn `up` |
| 3 | `search()` chỉ nhận `query`; không có `size`, `from`, `sort`, `_source`, `timeout`, lọc | Mở rộng theo `interfaces/search-port.md` | ✅ `searchWithTimeout`; lớp `SearchService` |
| 4 | `indexDocument` từng bản ghi, `refresh: false` | Thêm Bulk API, xóa, và `refresh` có kiểm soát khi reindex | ✅ `bulk`, `refresh`, `swapAlias`, `putSynonymSet`… |
| 5 | `requestTimeout: 30000` toàn cục | Tìm kiếm timeout 2 giây theo từng lời gọi (FR-13) | ✅ giữ 30 giây cho thao tác nền; mỗi lần tìm 2 giây, không thử lại |
| 6 | `createIndex` không đặt analyzer, không `dynamic: strict`, không alias, tên index không phiên bản | Theo BR-03, BR-04, BR-06 | ✅ `search-analysis.ts`, `search-index.service.ts`; `createIndex` giữ `dynamic` |
| 7 | Client `@elastic/elasticsearch` **9.5.1**, server **9.2.0** | Thống nhất phiên bản (Câu hỏi mở 3) | ⏳ chưa đổi; các API đang dùng (info, ping, search, bulk, alias, synonyms, count, refresh) đã chạy đúng giữa hai phiên bản này |
| 8 | Dev: bảo mật tắt, cổng publish mọi giao diện | Chấp nhận ở dev; production bật bảo mật, gắn `127.0.0.1` (BR-09) | ⏳ chờ compose production (đang trống) |
| 9 | Chưa có outbox, worker, lệnh reindex, tệp từ đồng nghĩa | Theo FR-08, FR-09, FR-12 | ✅ outbox, worker, dựng lại tự động, từ đồng nghĩa. ⏳ chưa có lệnh CLI (xem FR-09) |

**Đề xuất vị trí mã (chưa tạo):** tầng thấp giữ ở `integrations/elasticsearch`; logic dùng chung (registry profile, bộ dựng truy vấn, outbox, worker, reindex) ở `backend/src/modules/search/`; mỗi module nghiệp vụ chỉ thêm một tệp `*.search-profile.ts`.

## Phụ thuộc <!-- key: dependencies -->

- PostgreSQL (nguồn sự thật, bảng `search_outbox`), Elasticsearch 9.x (một node), Docker.
- Thư viện đã có: `@elastic/elasticsearch`, `@nestjs/elasticsearch`. Không thêm thư viện.
- Không dùng plugin ES. Không dùng Redis bắt buộc (ngắt mạch lưu trong bộ nhớ tiến trình).
- Liên quan: `013-map` (Vietmap lo gợi ý địa chỉ bên ngoài; ES dành cho **dữ liệu của chính dự án**), `008-discussions`, `010-feedback`, `rbac` (admin users).

## Ràng buộc <!-- key: constraints -->

- Hạ tầng một máy, đĩa cục bộ cho cả dev và production; cụm một node nên `number_of_replicas: 0` (cụm sẽ "green" khi không có replica).
- Bộ nhớ: ES chiếm RAM đáng kể (dev 512 MB heap); production cần dành RAM riêng (`configuration.md`).
- Giữ đơn giản: không Logstash, không Kafka/Debezium, không dịch vụ mới ngoài ES.
- Không đưa bí mật vào repo; biến môi trường chỉ sửa ở `.env*` gốc (`.cursor/rules/env-docker.md`).
- Tuân `.cursor/rules/security.md` (kiểm đầu vào, không `any`) và `testing-policy.md` (chỉ unit/integration, không e2e).

## Tài liệu liên quan (Artifacts) <!-- key: artifacts -->

- `research.md` — nguồn, kết quả thử nghiệm và 7 bản ghi quyết định.
- `analysis-and-queries.md` — cấu hình analyzer/mapping/truy vấn chi tiết, bảng tầng xếp hạng, bộ ca kiểm thử mẫu.
- `interfaces/search-port.md` — hợp đồng `SearchService`, `SearchProfile`.
- `postgresql.dbml` — bảng outbox.
- `configuration.md` — biến môi trường, compose, vận hành, từ đồng nghĩa, sao lưu.
- `diagrams/flow-when-to-use-es.mmd`, `diagrams/sequence-search.mmd`, `diagrams/sequence-index-sync.mmd`, `diagrams/flow-reindex-zero-downtime.mmd`.
- `threat-model.md`, `scaling-roadmap.md`.

## Tiêu chí nghiệm thu (Acceptance Criteria) <!-- key: acceptance_criteria -->

- [ ] Tắt container ES: backend vẫn khởi động, `/health/ready` trả 200 với ES `degraded`, tìm kiếm của profile đã bật trả kết quả từ PostgreSQL kèm `degraded = true`.
- [ ] Gửi yêu cầu chỉ có lọc/sắp xếp (không `q`): không có lời gọi nào tới ES (kiểm bằng số liệu hoặc mock).
- [ ] Bộ ca mẫu (≥ 20 truy vấn lỗi gõ trên dữ liệu thật của profile đầu tiên) đạt: đúng đối tượng ở hạng 1 cho ≥ 90%, hạng ≤ 3 cho 100% các ca trong FR-03.
- [ ] Thứ tự điểm theo tầng đúng FR-04 trên các ca có nhiều mức khớp.
- [ ] Sửa/xóa một bản ghi: hiện/biến mất khỏi kết quả tìm trong ≤ 5 giây; PostgreSQL xóa nhưng ES còn: bản ghi không xuất hiện ở kết quả (hydrate) và được dọn khỏi ES.
- [ ] `search:reindex` với dữ liệu đang được ghi: số bản ghi ES = PostgreSQL sau khi đổi alias; không lần tìm nào lỗi trong lúc đổi.
- [ ] Đổi tập từ đồng nghĩa: kết quả đổi theo ngay, không reindex.
- [ ] `q` chứa ký tự đặc biệt (`"`, `*`, `\`, `(`) không gây lỗi cú pháp và không đổi ngữ nghĩa truy vấn.
- [ ] Production: ES yêu cầu xác thực và không truy cập được từ ngoài máy.

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

1. **Profile đầu tiên là gì?** Ứng viên: chủ đề/bài thảo luận (`008`), điểm tiện ích đã nạp PostGIS (`data/curated/places`), phản hồi (`010`), người dùng cho admin. Đặc tả không chọn thay chủ dự án; cần chốt tên, trường tìm kiếm và trường lọc.
2. **Dữ liệu nào được phép nằm trong ES?** Đặc biệt với admin users (email, tên) — có chấp nhận lập chỉ mục không?
3. **Phiên bản:** nâng server lên cùng minor với client (9.5.x) hay hạ client về khớp 9.2? Cần đối chiếu bảng tương thích của Elastic trước khi triển khai.
4. **Bộ nhớ production:** máy chủ dành bao nhiêu RAM cho ES (heap 25–50% RAM theo hướng dẫn Mastodon/Elastic)?
5. **Nguồn từ đồng nghĩa:** tệp trong repo (đề xuất) hay bảng PostgreSQL có màn hình admin?
6. **Có cần tổng số kết quả chính xác** (ảnh hưởng chi phí `track_total_hits`)? Mặc định: không đếm, hoặc đếm tới 1.000.
7. **Tách từ tiếng Việt (CocCoc):** chỉ cân nhắc khi bộ ca thật cho thấy tách âm tiết không đủ; hiện không dùng.

## Nhật ký cập nhật <!-- key: update_log -->

- 2026-11-03: Áp dụng đặc tả vào mã: `integrations/elasticsearch` (khởi động không chặn, bulk, alias, synonyms, health `degraded`), module `modules/search` (profile, truy vấn nhiều tầng, outbox + worker, dựng lại luân phiên, ngắt mạch), biến môi trường. Kiểm chứng trên ES và PostgreSQL thật (xem `analysis-and-queries.md` mục 6). Tinh chỉnh so với bản nháp: `loadByIds` + `canView` thay vì lọc quyền khi nạp, trường `docId`, cột `revision` cho outbox, tên index luân phiên `-vN`/`-vN-b`, chưa có CLI reindex.
- 2026-11-03: Tạo đặc tả ban đầu từ tài liệu Elastic (match query, fuzziness, search_as_you_type, synonyms, aliases, snapshot), thực tiễn Mastodon/GitLab/Mattermost, và thử nghiệm thực tế trên ES dev 9.2.0 (index tạm đã xóa, không để lại index hay synonym set nào).
