# Technical Research — Nền tảng lưu trữ tệp đa phương tiện

Nguồn tham khảo (mở và đọc ngày 03/11/2026 trừ khi ghi khác). Các con số công suất là **mục tiêu thiết kế**, không phải số đo của dự án này.

**Tài liệu chính thức**

- MinIO, [github.com/minio/minio](https://github.com/minio/minio): kho "archived by the owner on Apr 25, 2026", README "THIS REPOSITORY IS NO LONGER MAINTAINED", bản nhị phân cũ không nhận cập nhật; trỏ sang AIStor Free (một node, giấy phép thương mại) và AIStor Enterprise. Mã nguồn vẫn AGPL-3.0.
- MinIO, [Erasure Coding](https://docs.min.io/community/minio-object-store/operations/concepts/erasure-coding.html): tập erasure mặc định 2–16 ổ; production phải có parity `EC:3` trở lên. Một ổ đĩa không tạo được tập, tức không có dự phòng.
- Cloudflare, [R2 S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/): endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`; vùng `auto` (`us-east-1` và rỗng cũng ánh xạ về `auto`); hỗ trợ multipart, CORS, lifecycle (API mới); **không hỗ trợ** ACL, object tagging, versioning; checksum CRC64NVME chỉ `FULL_OBJECT`, các loại khác chỉ `COMPOSITE`.
- Cloudflare, [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/): hỗ trợ GET/HEAD/PUT/DELETE, **không** POST (form upload); hạn 1 giây–7 ngày; chỉ dùng với endpoint S3, **không** dùng với tên miền riêng; cần CORS khi gọi từ trình duyệt; "treat presigned URLs as bearer tokens"; PUT phải ký `Content-Type`, gửi khác sẽ `403 SignatureDoesNotMatch`.
- Cloudflare, [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/): `r2.dev` chỉ cho không-production (giới hạn tốc độ, không WAF/cache); tên miền riêng hỗ trợ Cloudflare Cache; kiểm soát truy cập bằng Access hoặc WAF token.
- AWS, [Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html): URL ký là bearer, dùng được nhiều lần tới khi hết hạn; hạn bị chặn bởi vòng đời thông tin xác thực dùng để ký; PUT tới khóa đã có sẽ ghi đè; hạn được kiểm lúc nhận yêu cầu (tải dở dang vẫn chạy tiếp).
- OWASP, [File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html): không tin `Content-Type` của client; kiểm chữ ký tệp nhưng không chỉ dựa vào đó; tên tệp do server sinh (UUID); giới hạn kích thước; mã hóa lại ảnh và bỏ metadata (EXIF); quét mã độc; xác thực + phân quyền; quyền tối thiểu.

**Dự án mã nguồn mở tiêu biểu**

- Mastodon, [Object storage](https://docs.joinmastodon.org/admin/optional/object-storage/): cấu hình S3 qua biến môi trường (`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, khóa), `S3_ALIAS_HOST` để đổi nhà cung cấp mà không đổi URL công khai, `S3_OVERRIDE_PATH_STYLE`; ghi chú riêng cho MinIO (người dùng ẩn danh chỉ đọc, tài khoản ghi riêng) và **R2 không có ACL** nên media của tài khoản bị khóa vẫn truy cập được. Xóa theo lô (mặc định 1000/lô) khi nội dung bị xóa.
- GitLab, [Object storage](https://docs.gitlab.com/administration/object_storage/): upload trực tiếp bằng URL ký (direct upload), mỗi loại dữ liệu một bucket (khuyến nghị) hoặc tiền tố trong một bucket; `proxy_download: false` để client nhận redirect URL ký, giảm egress cho máy chủ; `path_style` cho dịch vụ tương thích S3; liệt kê MinIO/Ceph/… là cộng đồng hỗ trợ.
- Các nguồn thứ cấp về việc MinIO ngừng bảo trì và các phương án thay thế (đối chiếu chéo, **không** phải nguồn gốc): [wz-it.com](https://wz-it.com/en/blog/minio-successor-s3-storage-comparison/), [vonng.com](https://blog.vonng.com/en/db/minio-resurrect/), [stormdevelopments.ca](https://stormdevelopments.ca/blog/minio-s-community-edition-is-archived-what-still-runs-in-2026/). Các bài này không thống nhất ngày lưu trữ (từ tháng 2 đến tháng 4/2026); ta dùng ngày trên trang gốc GitHub. Bài wz-it ghi: SeaweedFS Apache-2.0 trên 10 năm tuổi, Garage AGPL-3.0, RustFS Apache-2.0 và trẻ nhất (bản 1.0.0 ngày 16/09/2026 theo bài này, **chưa xác minh**). Bài vonng/stormdevelopments còn nói thêm về việc bản console cộng đồng bị rút (tháng 5/2025) và image Docker bị gỡ; phần này **chưa xác minh** từ nguồn gốc.

**Chưa mở lại trong phiên này (kiến thức nền, cần xác minh nếu dựa vào):** Nextcloud (primary object store S3), Discourse (S3 uploads + CDN), Immich (lưu trữ cục bộ + sao lưu), `rclone` cho đồng bộ giữa S3 tương thích.

---

## Bản ghi quyết định 1 — Hợp đồng S3, không viết "trình điều khiển" lưu trữ riêng <!-- key: decision_record -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** Two-way (rẻ để đổi) *nếu giữ BR-01 và BR-02*

### Bối cảnh <!-- key: context -->

Hiện lưu ở đĩa qua MinIO; có thể lên R2 sau. Có thể thêm lớp trừu tượng "driver" (local FS / S3 / R2) hoặc dùng S3 API làm hợp đồng.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit với stack hiện có | Dễ bảo trì (dev đơn lẻ) | Khả năng đảo ngược | Ghi chú |
| --- | --- | --- | --- | --- |
| A. S3 API là hợp đồng, nhà cung cấp chọn bằng env | Rất khớp (`StorageService` đã làm vậy) | Cao: một đường mã | Cao | R2/MinIO/SeaweedFS/Garage/RustFS đều nói S3. Phải kỷ luật dùng tập con (BR-01) |
| B. Interface `StorageDriver` với hai hiện thực (đĩa cục bộ + S3) | Thêm lớp mới | Thấp: hai đường mã, URL ký phải tự làm cho đĩa | Cao | Tự viết lại những thứ S3 đã có (ký URL, Range, Head) |
| C. Chỉ lưu đĩa trực tiếp (`/var/data`) + Nginx phục vụ | Khác hẳn luồng hiện tại | Trung bình | Thấp | Mất URL ký, mất khả năng chuyển cloud |

### Quyết định

**Phương án A.** Không tạo lớp driver. Điều kiện: chỉ dùng tập con S3 chung (BR-01) và chỉ lưu `object_key` (BR-02). Lý do: yêu cầu "đừng quá đóng nhưng đừng cồng kềnh" thỏa bằng cách tận dụng hợp đồng công nghiệp thay vì tự đặt một hợp đồng thứ hai.

---

## Bản ghi quyết định 2 — Giữ MinIO ở giai đoạn đầu, ghim phiên bản, chuẩn bị đường thoát <!-- key: decision_record_minio -->

**Status:** Accepted (giới hạn); xem lại khi chuẩn bị production hoặc khi có CVE
**Category:** Technology Choice / Risk
**Door Type:** Two-way

### Bối cảnh

Kho MinIO Community đã lưu trữ ngày 25/04/2026 và không còn bản vá. Dự án đang chạy MinIO ở dev qua image `bitnamilegacy` (tên cho thấy kho image cũ).

### Các phương án

| Option | Ưu | Nhược |
| --- | --- | --- |
| A. Giữ MinIO bản hiện tại, ghim digest, chỉ dùng nội bộ | Không đổi gì, chạy được | Không vá lỗi; không để lộ ra Internet |
| B. AIStor Free (MinIO) | Cùng hệ sinh thái | Giấy phép thương mại, giới hạn một node; phụ thuộc nhà cung cấp |
| C. SeaweedFS (Apache-2.0) | Trưởng thành, còn phát triển, S3 API | Cấu hình khác MinIO; cần thử CORS/URL ký |
| D. Garage (AGPL-3.0) | Nhẹ, thiết kế cho nhiều site | Hệ sinh thái nhỏ; cần thử |
| E. RustFS (Apache-2.0) | Mới, nhanh | Trẻ nhất; chưa nên cho dữ liệu thật |
| F. Đi thẳng R2, bỏ tự host | Không vận hành đĩa, có bền vững + CDN | Phát sinh chi phí; phụ thuộc Cloudflare |

### Quyết định

- **Dev và giai đoạn đầu:** A. Ghim digest image; không publish console/API ra Internet; production nếu dùng MinIO thì đứng sau reverse proxy chỉ cho phép `GET/PUT/HEAD` trên đường dẫn bucket.
- **Đường thoát** chuẩn bị bằng BR-01/BR-02 chứ không bằng mã mới. Ứng viên tự host kế tiếp: C. Đích cloud: F (R2) như người dùng đã định.
- **Không** chọn sớm phương án thay thế khi chưa có nhu cầu production; ghi thành Open Question 1–2.

### Điều kiện xem xét lại (trigger)

Có CVE MinIO ảnh hưởng cấu hình đang dùng; hoặc quyết định chạy production tự host; hoặc image `bitnamilegacy` biến mất khỏi registry.

---

## Bản ghi quyết định 3 — Upload trực tiếp bằng URL PUT ký, ép kích thước tại `complete` <!-- key: decision_record_upload -->

**Status:** Accepted
**Category:** Architecture
**Door Type:** Two-way

### Các phương án

| Option | Di động MinIO/R2 | Ép kích thước | Tải backend |
| --- | --- | --- | --- |
| A. Presigned PUT + `complete` (hiện có) | Có | Không trước khi tải; kiểm sau bằng `HEAD` | Không |
| B. Presigned POST (policy `content-length-range`) | **Không** (R2 không hỗ trợ POST) | Có | Không |
| C. Backend nhận multipart rồi ghi lên kho | Có | Có | Cao, giữ kết nối, tốn RAM/băng thông |
| D. Multipart upload của S3 | Có | Từng phần | Không, nhưng phức tạp |

### Quyết định

**A.** Giữ luồng hiện có. Bù phần thiếu: (1) kiểm `ContentLength` thực qua `HEAD` và xóa nếu vượt; (2) hạn mức tệp `pending` mỗi người; (3) hết hạn URL PUT ≤ 10 phút; (4) thử nghiệm ký thêm `Content-Length` (một số triển khai chấp nhận header này khi ký, **cần xác minh bằng thử nghiệm** trên cả MinIO và R2 trước khi dựa vào). **D** chỉ khi có tệp > 100 MB (bậc 2 trong roadmap).

---

## Bản ghi quyết định 4 — Đọc bằng URL GET ký ngắn hạn, làm tròn mốc ký để cache <!-- key: decision_record_read --> 

**Status:** Proposed
**Category:** Performance
**Door Type:** Two-way

### Bối cảnh

Mỗi lần gọi `getSignedUrl`, `X-Amz-Date` đổi nên URL đổi, trình duyệt không dùng lại cache ảnh khi cuộn lại danh sách.

### Các phương án

| Option | Ghi chú |
| --- | --- |
| A. Giữ hiện tại (URL mới mỗi lần) | Đơn giản; mất cache trình duyệt |
| B. Làm tròn `signingDate` về đầu cửa sổ (ví dụ 10 phút) và `expiresIn` = cửa sổ + TTL | Cùng URL trong một cửa sổ; vẫn là bearer ngắn hạn. SDK hỗ trợ tham số `signingDate` khi ký |
| C. Backend proxy stream | Mất lợi thế tải trực tiếp, tốn tài nguyên |
| D. Bucket công khai + CDN cho tệp không nhạy cảm | Đúng đắn cho avatar/ảnh bản đồ; là việc của bậc sau |

### Quyết định

Giai đoạn đầu **A** (đã chạy). Khi số liệu cho thấy tải ảnh lặp là điểm nghẽn thì **B**; khi có nhóm tệp không nhạy cảm thì **D** qua tên miền riêng + cache (với R2: tên miền riêng + Cache rule; URL ký R2 không dùng với tên miền riêng).

---

## Bản ghi quyết định 5 — Một bucket, tiền tố theo miền; metadata ở bảng từng module <!-- key: decision_record_layout -->

**Status:** Accepted
**Category:** Data Model
**Door Type:** Two-way ở giai đoạn đầu, một chiều nếu thêm bảng hợp nhất sớm

### Các phương án

| Option | Ghi chú |
| --- | --- |
| A. Một bucket, tiền tố theo miền; bảng metadata riêng mỗi module (hiện trạng) | Ít thay đổi nhất; GitLab khuyến nghị bucket riêng nhưng cho phép tiền tố |
| B. Bucket riêng cho mỗi miền | Tách quyền tốt hơn; tăng cấu hình, tăng số khóa/CORS |
| C. Bảng `media_objects` hợp nhất | Dễ dọn mồ côi/hạn mức/đối soát toàn cục; phải di trú ba bảng, ràng buộc nhiều module |

### Quyết định

**A** với quy ước cột chung (xem `interfaces/storage-port.md` §Cột chuẩn). **C** là bậc 2 khi cần hạn mức hoặc đối soát xuyên miền. **B** chỉ khi xuất hiện nhóm công khai (BR-08).
