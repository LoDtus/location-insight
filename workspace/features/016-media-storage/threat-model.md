# Mô hình mối đe dọa — Lưu trữ tệp đa phương tiện (016-media-storage)

Cơ sở: `.cursor/rules/security.md`, OWASP File Upload Cheat Sheet, tài liệu URL ký của AWS/Cloudflare (xem `research.md`). Tài sản: tệp riêng tư của người dùng (ảnh có thể chứa vị trí), khóa truy cập kho, tính sẵn sàng của kho.

Biên tin cậy: trình duyệt (không tin) ⇄ backend (tin) ⇄ kho S3 (tin nhưng cô lập). URL ký là cầu nối: một khi phát ra là bearer token.

| # | Mối đe dọa | Vector | Biện pháp (tham chiếu) | Rủi ro còn lại |
| --- | --- | --- | --- | --- |
| T1 | Truy cập tệp của người khác (IDOR) | Đoán/gửi `object_key`, `id` | Không API nhận khóa thô; kiểm quyền ở dòng metadata trước khi ký; 404 thống nhất (BR-05) | Thấp |
| T2 | Rò rỉ URL ký | Chia sẻ, nhật ký, referrer, cache proxy | Hạn ngắn (10 phút riêng tư); không ghi URL ký vào nhật ký (BR-11); `Referrer-Policy` của web; không đưa URL vào analytics | Trung bình: URL còn hiệu lực trong hạn là chấp nhận được, vì là bearer |
| T3 | Giả MIME / đuôi tệp | `Content-Type` giả, đuôi kép | Danh sách cho phép theo module; magic bytes tại `complete` (FR-04); khóa sinh ở server, đuôi suy từ loại đã kiểm (BR-03) | Thấp |
| T4 | XSS qua tệp được phục vụ (SVG/HTML) | Tải SVG/HTML rồi mở trên origin kho | Không nhận SVG/HTML/XML (BR-07); `Content-Disposition`, `nosniff` khi ký GET; kho ở origin khác web | Thấp |
| T5 | Lạm dụng dung lượng / DoS chi phí | Tải rất nhiều tệp, hoặc tệp lớn qua PUT ký | Hạn mức `pending`, giới hạn kích thước tại `complete`, proxy giới hạn thân PUT (prod tự host), job dọn `pending` (FR-07); thử ký `Content-Length` | Trung bình: PUT lớn vẫn tốn băng thông đến khi kiểm; chấp nhận ở quy mô hiện tại |
| T6 | Rò vị trí qua EXIF | Ảnh có GPS hiển thị cho người khác | Loại EXIF ở `complete` (FR-12) | Trung bình cho đến khi FR-12 được triển khai |
| T7 | Lộ khóa truy cập kho | Khóa root dùng trong ứng dụng, khóa lọt nhật ký/repo | Khóa dịch vụ giới hạn bucket (BR-09); khóa chỉ ở `.env*` gốc (BR-10); không ghi khóa vào nhật ký | Thấp nếu làm đủ; hiện tại **Cao** ở prod vì dùng khóa root (điểm lệch 4) |
| T8 | Kho bị khai thác (MinIO không còn vá) | CVE mới của MinIO bản cuối | Không publish console/API quản trị; reverse proxy lọc phương thức/đường dẫn; ghim digest; theo dõi CVE; đường thoát sang R2/SeaweedFS (`research.md` bản ghi 2) | Trung bình, tăng dần theo thời gian nếu giữ MinIO ở production |
| T9 | Mất dữ liệu | Hỏng đĩa (một ổ, không erasure), xóa nhầm, ransomware | Sao lưu hằng đêm ra nơi thứ hai (FR-13); thử khôi phục; bind mount trên đĩa riêng | Trung bình: RPO tối đa 24 giờ |
| T10 | Tệp mồ côi / rò dung lượng | Upload không `complete`, xóa nội dung mà lỗi xóa tệp | Job dọn `pending`; job đối soát (FR-07); xóa tệp là best-effort có ghi cảnh báo (FR-06) | Thấp |
| T11 | Ghi đè đối tượng | PUT lặp tới cùng URL ký trong hạn | Khóa mới theo UUID cho mỗi upload; hạn ngắn; sau `complete` dòng chuyển `ready` và không phát URL PUT nữa | Thấp |
| T12 | Path traversal / khóa độc | Tên tệp, khóa do client chọn | Khóa do server sinh; `StorageService` từ chối `..`, `/` đầu, rỗng (storage-port) | Thấp |
| T13 | CORS quá rộng | `*` origin cho kho | Chỉ origin web (cấu hình), phương thức `GET/PUT/HEAD` | Thấp |
| T14 | Lọt công cụ dev vào prod | `/reset`, cờ dev | Không liên quan trực tiếp tới kho, nhưng `S3_AUTO_CREATE_BUCKET=false` ở prod và không đụng `dev-reset` (BR-12) | Thấp |
| T15 | Nội dung lậu/độc hại | Mã độc, nội dung vi phạm | Ngoài phạm vi giai đoạn 1; điểm móc quét ở `complete`; quy trình báo cáo/gỡ ở `010-feedback`/`008-discussions` | Chấp nhận có điều kiện |

## Dữ liệu nhạy cảm

- Ảnh/video người dùng: riêng tư theo mặc định; vị trí có thể nằm trong EXIF.
- Khóa truy cập kho, VAPID/JWT khóa khác nằm ngoài tài liệu này nhưng cùng quy tắc bí mật.
- URL ký: coi như bí mật ngắn hạn.

## Việc kiểm tra nên có khi triển khai

- Thử `GET` URL ký của người A bằng tài khoản B (đúng là URL vẫn hoạt động: bearer) và thử gọi API xin URL cho tệp của A bằng tài khoản B (phải 404).
- Thử PUT với `Content-Type` khác với khi ký (phải 403).
- Thử tải `.svg`, `.html` đổi tên thành `.jpg` (phải 422 tại `complete`).
- Quét nhật ký tìm `X-Amz-Signature`, `S3_SECRET_KEY` (phải rỗng).
- Thử khôi phục từ bản sao lưu.
