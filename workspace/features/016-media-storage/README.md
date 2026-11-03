# Nền tảng lưu trữ tệp đa phương tiện (MinIO / S3 / Cloudflare R2)

**Feature ID:** 016-media-storage
**Status:** Draft
**Last Updated:** 2026-11-03

## Tổng quan <!-- key: overview -->

Đây là nền tảng dùng chung để lưu ảnh, video, tệp đính kèm cho các module đã có và sẽ có (`008-discussions`, `009-messaging`, `010-feedback`, sau này avatar, bản xuất dữ liệu). Hiện tại tệp nằm trên đĩa máy chủ thông qua MinIO (giao diện S3). Nếu sau này cần đưa lên cloud thì dùng **Cloudflare R2**. Nguyên tắc: **S3 API là hợp đồng, MinIO chỉ là một cách triển khai hợp đồng đó**; đổi nơi lưu là đổi biến môi trường và sao chép dữ liệu, không đổi mã nghiệp vụ, không đổi cơ sở dữ liệu.

Đặc tả này **chỉ mô tả**; chưa có thay đổi mã nào đi kèm. Các điểm lệch giữa mã hiện tại và đặc tả được ghi ở `§Bối cảnh kỹ thuật` để làm việc triển khai sau.

## Mục tiêu & Phạm vi <!-- key: goals_scope -->

**In scope (giai đoạn 1, hầu hết là chuẩn hóa cái đã có):**

- Một cổng lưu trữ duy nhất `StorageService` (AWS SDK v3) cho mọi module; chỉ dùng **tập con S3 chạy được trên cả MinIO và R2** (`§Quy tắc nghiệp vụ` BR-01).
- Bucket riêng tư mặc định; trình duyệt tải lên/xuống trực tiếp qua URL ký sẵn (presigned), backend không chuyển tiếp byte tệp.
- Quy ước tên khóa đối tượng (`object_key`) và cột bảng chung cho mọi module có tệp.
- Vòng đời tệp: `pending → ready → deleted`, dọn tệp mồ côi, xóa tệp khi xóa nội dung chủ.
- Cấu hình theo môi trường (dev / prod tự host / R2) chỉ bằng `.env*` ở root (`configuration.md`).
- Sao lưu tối thiểu và quy trình chuyển MinIO → R2 không cần di trú DB.
- Quan sát: kiểm tra sức khỏe, số liệu, nhật ký không lộ URL ký.

**Out of scope (chưa làm, nhưng thiết kế chỗ chứa — xem `scaling-roadmap.md`):**

- CDN và bucket công khai cho tệp không nhạy cảm (avatar, ảnh bản đồ).
- Tạo ảnh thu nhỏ, chuyển mã video, quét mã độc (có điểm móc ở bước `complete`).
- Multipart upload cho tệp > 100 MB (giới hạn hiện tại 8 MB ảnh, 50 MB video không cần).
- Bảng media hợp nhất dùng chung giữa các module.
- MinIO phân tán nhiều node, nhân bản liên vùng, mã hóa phía máy chủ (SSE).
- Đổi sang phần mềm S3 tự host khác (SeaweedFS, Garage, RustFS): chỉ nêu đường thoát, chưa chọn.

## Đối tượng liên quan <!-- key: actors -->

- Người dùng đã đăng nhập: tải tệp lên, xem tệp của mình hoặc tệp được phép xem.
- Admin: xem tệp trong phản hồi/báo cáo, gỡ nội dung vi phạm.
- Module nghiệp vụ (discussions, messaging, feedback, tương lai: profile, export): gọi `StorageService`, sở hữu bảng metadata riêng.
- Job nền: dọn tệp `pending` quá hạn, xóa tệp của nội dung đã xóa, đối soát (giai đoạn 1+).
- Dịch vụ lưu trữ: MinIO (dev, tự host) hoặc Cloudflare R2 (cloud).
- Người vận hành: cấp khóa, sao lưu, chuyển nhà cung cấp.

## Yêu cầu chức năng <!-- key: functional_requirements -->

- **FR-01 (một cổng):** mọi truy cập bucket đi qua `StorageService`. Module nghiệp vụ không tạo `S3Client` riêng, không import `@aws-sdk/*` trực tiếp. Hợp đồng ở `interfaces/storage-port.md`.
- **FR-02 (khởi tạo upload):** module xác thực quyền, kiểm loại/kích thước khai báo theo danh sách cho phép của chính nó, tạo dòng metadata `pending`, sinh `object_key` phía server, trả `{ id, uploadUrl, expiresAt }`. URL PUT ký kèm `Content-Type` và hết hạn sau ≤ 10 phút.
- **FR-03 (tải lên trực tiếp):** trình duyệt `PUT` thẳng tới `uploadUrl`. Backend không nhận byte tệp.
- **FR-04 (xác nhận):** `complete` kiểm tệp có thật (`HEAD`), kích thước thực ≤ giới hạn, đọc vài byte đầu đối chiếu chữ ký (magic bytes) với loại khai báo. Đạt thì `ready`; không đạt thì xóa đối tượng và dòng, trả lỗi `422`. Chỉ tệp `ready` mới gắn được vào nội dung.
- **FR-05 (xem tệp):** backend kiểm quyền rồi trả URL GET ký sẵn. Hết hạn tùy loại: 10 phút cho tệp riêng tư (tin nhắn), tối đa 1 giờ cho nội dung đã công khai trong ứng dụng. Có thể làm tròn mốc ký để URL ổn định trong một cửa sổ (cache trình duyệt, `research.md` bản ghi 4).
- **FR-06 (xóa):** xóa nội dung chủ thì xóa dòng metadata và đối tượng. Lỗi xóa đối tượng không chặn xóa nội dung; đối tượng thừa sẽ do job dọn (FR-07) xử lý. Không im lặng nuốt lỗi: ghi nhật ký cảnh báo.
- **FR-07 (dọn mồ côi):** job định kỳ (mỗi giờ) xóa dòng `pending` quá 1 giờ cùng đối tượng nếu có. Job đối soát (hằng tuần, giai đoạn 1+) liệt kê bucket theo prefix và so với DB, chỉ **báo cáo** trước, xóa tự động khi đã tin kết quả.
- **FR-08 (cấu hình):** toàn bộ tham số lưu trữ đọc từ biến môi trường (`configuration.md`). Không có hằng số cổng, host, origin trong mã.
- **FR-09 (khởi động an toàn):** dev tự tạo bucket và đặt CORS. Production **không** tự tạo bucket, chỉ kiểm tồn tại (`HeadBucket`); thiếu thì dừng khởi động với lỗi rõ.
- **FR-10 (sức khỏe):** `/health` gọi `ping()` (`HeadBucket`) với timeout ngắn; lỗi lưu trữ không làm sập các API không dùng tệp (báo `degraded`).
- **FR-11 (lỗi nhà cung cấp):** timeout kết nối/đọc 5 giây, thử lại tối đa 2 lần với lỗi tạm thời; không thử lại lỗi 4xx. Lỗi trả về người dùng là thông báo chung, chi tiết chỉ vào nhật ký.
- **FR-12 (ảnh riêng tư vị trí):** ảnh người dùng tải lên được **loại bỏ EXIF (đặc biệt GPS)** trước khi hiển thị cho người khác. Điểm thực hiện: bước `complete` (đọc, mã hóa lại, ghi đè). Mức ưu tiên *Should* — cần quyết định thư viện (`§Câu hỏi mở`).
- **FR-13 (sao lưu):** sao chép bucket sang vị trí thứ hai mỗi đêm (`rclone`/`mc mirror` tới R2 hoặc đĩa khác) khi chạy production tự host. Có thử khôi phục định kỳ.
- **FR-14 (chuyển nhà cung cấp):** quy trình MinIO → R2 theo `diagrams/flow-provider-migration.mmd`: sao chép bucket, đổi biến môi trường, không đổi DB (BR-02).
- **FR-15 (số liệu):** `storage_request_duration_ms{op,status}`, `storage_errors_total{op,code}`, `media_pending_count`, `media_orphan_deleted_total`, `media_bytes_total{domain}`.

## Quy tắc nghiệp vụ <!-- key: business_rules -->

- **BR-01 (tập con S3 di động):** chỉ dùng `PutObject`, `GetObject` (kể cả `Range`), `HeadObject`, `DeleteObject`, `DeleteObjects`, `ListObjectsV2`, URL ký GET/PUT, CORS bucket, lifecycle cấu hình mới. **Không dùng**: ACL, object tagging, versioning, POST policy (form upload), SSE-KMS, thông báo bucket, API quản trị riêng của MinIO. Lý do: R2 không hỗ trợ ACL/tagging/versioning/POST presigned (`research.md`), nên mã dùng chúng sẽ không chuyển nhà được.
- **BR-02 (chỉ lưu khóa):** DB chỉ lưu `object_key` (tương đối). **Không bao giờ** lưu URL, endpoint, tên bucket. Bucket lấy từ cấu hình. Đây là điều kiện để đổi nhà cung cấp không cần di trú DB.
- **BR-03 (khóa do server sinh):** `object_key = {domain}/{ownerScope}/{id}[.ext]`, `id` là UUID v7, `ext` suy ra từ loại đã kiểm (không lấy từ tên tệp người dùng). Tên tệp gốc nếu cần chỉ lưu ở cột DB đã làm sạch. Khóa không chứa email, tên, dữ liệu cá nhân. Tiền tố hiện có: `discussions/`, `feedback/`, `messaging/`; dự phòng: `avatars/`, `exports/`, `tmp/`.
- **BR-04 (riêng tư mặc định):** bucket không công khai, không liệt kê ẩn danh. Truy cập duy nhất là URL ký sau khi kiểm quyền ở backend. Công khai là quyết định theo từng loại tệp ở giai đoạn sau, đi qua bucket/tên miền riêng (không bật công khai cho bucket hiện tại).
- **BR-05 (kiểm quyền trước khi ký):** URL ký là bearer token. Backend chỉ ký sau khi xác định người gọi có quyền với **dòng metadata** (không tin `object_key` do client gửi). Không có API nhận `object_key` thô từ client.
- **BR-06 (kích thước):** URL PUT ký không ép được giới hạn kích thước một cách di động (R2 không hỗ trợ POST policy). Do đó giới hạn được ép tại `complete` (FR-04) và bằng hạn mức tệp `pending` trên mỗi người; thử nghiệm ký thêm `Content-Length` khi triển khai (`research.md` bản ghi 3).
- **BR-07 (loại tệp):** danh sách cho phép theo module. **Không nhận SVG, HTML, XML, tệp thực thi** làm tệp người dùng. Phục vụ lại với `Content-Disposition` phù hợp và `X-Content-Type-Options: nosniff` khi ký GET (tham số `ResponseContentType`/`ResponseContentDisposition`).
- **BR-08 (một bucket, nhiều tiền tố):** dùng một bucket `S3_BUCKET`. Tách bucket chỉ khi chính sách khác nhau (ví dụ công khai vs riêng tư) hoặc quyền khóa khác nhau.
- **BR-09 (đặc quyền tối thiểu):** ứng dụng dùng khóa riêng giới hạn trên đúng bucket (đọc/ghi/xóa/liệt kê), **không** dùng khóa root. Khóa root chỉ để vận hành.
- **BR-10 (bí mật):** khóa truy cập chỉ ở `.env*` gốc (`.cursor/rules/env-docker.md`); không ghi vào nhật ký, không trả về client, không commit giá trị thật.
- **BR-11 (nhật ký):** nhật ký ghi `op`, `id` metadata, mã lỗi, độ trễ; **không** ghi URL ký, query chữ ký, khóa truy cập.
- **BR-12 (dữ liệu dev):** `/reset` (xóa DB dev) hiện **không** xóa đối tượng trong bucket, nên tệp mồ côi tích tụ ở dev. Không đổi hành vi `/reset` trong đặc tả này (xem `.cursor/rules/dev-reset.md`); xem `§Câu hỏi mở`.

## Tóm tắt luồng người dùng <!-- key: user_flow_summary -->

1. **Tải lên:** người dùng chọn tệp → ứng dụng xin `uploadUrl` từ module → trình duyệt `PUT` thẳng vào kho → gọi `complete` → backend kiểm → tệp `ready` → gắn vào bài/tin nhắn/phản hồi. Xem `diagrams/sequence-upload.mmd`.
2. **Xem:** danh sách nội dung trả kèm URL GET ký sẵn đã kiểm quyền; trình duyệt tải thẳng từ kho. Xem `diagrams/sequence-read.mmd`.
3. **Xóa / hết hạn:** xóa nội dung hoặc job dọn xóa tệp. Vòng đời ở `diagrams/state-media-object.mmd`.
4. **Chuyển nhà cung cấp:** người vận hành sao chép bucket rồi đổi biến môi trường. Xem `diagrams/flow-provider-migration.mmd`.

## Bối cảnh kỹ thuật <!-- key: technical_context -->

**Hiện trạng (đối chiếu mã ngày 2026-11-03):**

- `backend/src/integrations/storage/storage.service.ts`: `S3Client` với `forcePathStyle`, `requestChecksumCalculation: 'WHEN_REQUIRED'` (đúng hướng cho R2), hai client (nội bộ + ký URL công khai), `onModuleInit` thử tạo bucket và đặt CORS tối đa 10 lần.
- Ba module dùng: discussions (`discussions/{userId}/{id}`), feedback (`feedback/{userId}/{id}.ext`), messaging (`messaging/{conversationId}/{id}.ext`); luồng `pending → complete → ready` đã có; giới hạn 8 MB ảnh, 50 MB video; dọn tệp ở `messaging-maintenance.service.ts`.
- `infra/docker-compose.dev.yml`: dịch vụ `minio` dùng image `bitnamilegacy/minio:2025.7.23-debian-12-r5`, dữ liệu ở volume có tên `minio_data`. Khóa root của MinIO chính là `S3_ACCESS_KEY`/`S3_SECRET_KEY` mà backend dùng.

**Điểm lệch cần xử lý khi triển khai (chưa sửa mã):**

| # | Hiện trạng | Đặc tả yêu cầu |
| --- | --- | --- |
| 1 | `publicEndpoint()` thay chuỗi cứng `://minio:9000` → `127.0.0.1:22374` | Dùng `S3_PUBLIC_ENDPOINT` bắt buộc ngoài dev; bỏ chuỗi cứng (FR-08) |
| 2 | CORS origin cứng `localhost:22360` | Lấy từ `CORS_ORIGINS` hoặc `S3_CORS_ORIGINS` (FR-08) |
| 3 | Luôn tạo bucket + đặt CORS khi khởi động | Chỉ dev; prod chỉ `HeadBucket` (FR-09) |
| 4 | Ứng dụng dùng khóa root MinIO | Khóa dịch vụ giới hạn theo bucket (BR-09) |
| 5 | `.env.production` có `S3_ENDPOINT=http://localhost:22374` | Cấu hình prod thật theo `configuration.md` |
| 6 | Image `bitnamilegacy/*` + MinIO Community đã ngừng bảo trì | Ghim phiên bản/digest, giảm bề mặt tấn công, chuẩn bị đường thoát (`research.md` bản ghi 1) |
| 7 | Chưa có sao lưu, chưa có đối soát mồ côi | FR-13, FR-07 |
| 8 | Không loại EXIF | FR-12 |

**Trạng thái MinIO (quan trọng):** kho `minio/minio` đã được chủ sở hữu **lưu trữ (archived) ngày 25/04/2026**, README ghi "no longer maintained"; bản nhị phân cũ không còn cập nhật. Mã nguồn vẫn AGPL-3.0 và bản hiện có chạy được, nhưng **sẽ không có bản vá bảo mật**. Vì vậy đặc tả giữ MinIO cho dev và giai đoạn đầu, đồng thời khóa chặt phạm vi chức năng vào S3 chuẩn để chuyển được (`research.md` bản ghi 1).

## Phụ thuộc <!-- key: dependencies -->

- `008-discussions`, `009-messaging`, `010-feedback`: ba bên dùng hiện tại.
- `rbac` (`quota.service`): hạn mức tệp `pending`/ngày nếu cần (BR-06).
- Redis: không bắt buộc; có thể dùng cho khóa job dọn dẹp đa instance.
- PostgreSQL: bảng metadata của từng module.
- Thư viện đã có: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`. Thư viện xử lý ảnh (FR-12) là phụ thuộc mới, cần quyết định riêng (`.cursor/rules/global.md` §7).
- Công cụ vận hành: `rclone` hoặc `mc` cho sao lưu/di chuyển (không thuộc ảnh Docker ứng dụng).

## Ràng buộc <!-- key: constraints -->

- **R2 không hỗ trợ:** ACL, object tagging, versioning, POST presigned form, SSE KMS; URL ký chỉ dùng được trên endpoint S3 (`<ACCOUNT_ID>.r2.cloudflarestorage.com`), **không** dùng với tên miền riêng; hạn tối đa 7 ngày; vùng dùng `auto`.
- **MinIO một ổ đĩa:** không có erasure coding, không có dự phòng khi hỏng đĩa; sao lưu là bắt buộc, không phải tùy chọn.
- Cổng nội bộ MinIO `9000`/`9001` được phép ghi cứng trong image; cổng publish ra host luôn là `${MINIO_API_PORT}`/`${MINIO_CONSOLE_PORT}` (`env-docker.md`).
- Không đưa bí mật vào repo; biến chỉ sửa ở `.env*` gốc.
- Không tăng số dịch vụ vận hành: không thêm CDN, hàng đợi, proxy riêng ở giai đoạn 1.

## Tài liệu liên quan (Artifacts) <!-- key: artifacts -->

- `research.md` — nguồn tham khảo và các bản ghi quyết định.
- `configuration.md` — ma trận biến môi trường theo môi trường, mẫu khóa/chính sách, CORS.
- `interfaces/storage-port.md` — hợp đồng nội bộ `StorageService`.
- `diagrams/sequence-upload.mmd`, `diagrams/sequence-read.mmd`, `diagrams/state-media-object.mmd`, `diagrams/flow-provider-migration.mmd`.
- `threat-model.md` — mô hình mối đe dọa.
- `scaling-roadmap.md` — các bậc mở rộng và ngưỡng chuyển bậc.
- Liên quan: `../008-discussions/diagrams/sequence-media.mmd`, `../010-feedback/README.md`, `../009-messaging/`.

## Tiêu chí nghiệm thu (Acceptance Criteria) <!-- key: acceptance_criteria -->

- [ ] Đổi `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_REGION`, khóa, bucket sang R2 thử nghiệm và chạy lại luồng upload → xem → xóa của cả ba module mà **không sửa dòng mã nghiệp vụ nào** và không đổi DB.
- [ ] Không còn chuỗi cứng host/cổng/origin trong `integrations/storage` (điểm lệch 1–2 đã xử lý).
- [ ] Prod khởi động khi bucket tồn tại; khi bucket thiếu, dừng với lỗi rõ ràng; không tự tạo.
- [ ] Tệp vượt giới hạn hoặc sai chữ ký bị từ chối ở `complete` và không còn trong bucket.
- [ ] Dòng `pending` quá 1 giờ biến mất cùng đối tượng sau một chu kỳ job.
- [ ] Không API nào nhận `object_key` từ client; mọi URL ký chỉ phát ra sau kiểm quyền.
- [ ] Nhật ký ứng dụng không chứa chuỗi `X-Amz-Signature`.
- [ ] Khôi phục thử từ bản sao lưu vào một bucket trống, ứng dụng đọc lại được tệp cũ.
- [ ] Ảnh có EXIF GPS sau khi tải lên không còn GPS khi tải về (nếu FR-12 được chấp nhận).

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

1. **Phần mềm S3 cho production tự host:** giữ MinIO bản cuối (ghim digest) hay chọn sớm phương án còn bảo trì (SeaweedFS Apache-2.0 là ứng viên mạnh; Garage, RustFS còn trẻ)? Mặc định đặc tả: giữ MinIO cho dev và giai đoạn đầu, quyết định lại khi chuẩn bị production thật hoặc khi có CVE MinIO.
2. **Có chạy production tự host hay đi thẳng R2?** Nếu đi thẳng R2 thì MinIO chỉ còn dev và các điểm lệch về MinIO ở production hết cần xử lý.
3. **FR-12 (loại EXIF):** chấp nhận thêm thư viện (ví dụ `sharp`) hay làm bằng cách khác? Kiểm tra `backend/package.json` ngày 2026-11-03: chưa có `sharp`.
4. **`/reset` ở dev có nên xóa luôn đối tượng trong bucket dev?** Chạm vào công cụ reset nên cần người dùng đồng ý rõ ràng theo `.cursor/rules/dev-reset.md`; đặc tả không tự thay đổi.
5. **Hạn mức:** có cần giới hạn dung lượng lưu trữ theo người dùng/gói (liên quan `007-billing`) không?
6. **Thử nghiệm ký `Content-Length`** trên MinIO và R2 (BR-06) — cần spike nhỏ khi triển khai.

## Nhật ký cập nhật <!-- key: update_log -->

- 2026-11-03: Tạo đặc tả ban đầu từ tài liệu chính thức (MinIO, Cloudflare R2, AWS S3), OWASP, và cách GitLab/Mastodon dùng kho đối tượng; đối chiếu mã `StorageService` hiện có. Phát hiện kho MinIO đã lưu trữ ngày 25/04/2026.
