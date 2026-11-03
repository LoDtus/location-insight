# Lộ trình mở rộng — Lưu trữ tệp (016-media-storage)

Các con số là **mục tiêu thiết kế**, không phải số đo. Mỗi bậc chỉ làm khi số đo của bậc trước chạm ngưỡng. Hợp đồng `StorageService` và `object_key` **không đổi** giữa các bậc.

| Bậc | Quy mô tham chiếu | Việc làm | Ngưỡng chuyển bậc (đo bằng) |
| --- | --- | --- | --- |
| 0 (bản đầu) | Một máy, đĩa cục bộ, ≤ vài trăm GB | MinIO một node (dev, giai đoạn đầu) hoặc R2; URL ký trực tiếp; job dọn `pending`; sao lưu hằng đêm; cấu hình hoàn toàn bằng env | Dung lượng đĩa > 70%; hoặc quyết định chạy production thật (xem Open Question 1–2) |
| 1 | Production đầu tiên | Chốt phần mềm kho (R2, hoặc tự host có bảo trì); khóa dịch vụ giới hạn bucket; bỏ chuỗi cứng; không tự tạo bucket; job đối soát mồ côi (chỉ báo cáo); số liệu FR-15; loại EXIF | Trước khi mở cho người dùng thật |
| 2 | Nhiều loại tệp, cần quản trị chung | Bảng `media_objects` hợp nhất (di trú từ ba bảng) hoặc view hợp nhất; hạn mức dung lượng theo người/gói; multipart cho tệp > 100 MB; ảnh thu nhỏ tạo bất đồng bộ (worker, `SKIP LOCKED`) | Cần hạn mức theo gói (`007-billing`); tệp > 100 MB; `media_pending_count` hoặc đối soát phát hiện mồ côi lặp lại |
| 3 | Lưu lượng đọc ảnh lớn | Bucket công khai riêng cho tệp không nhạy cảm (avatar, ảnh bản đồ) qua tên miền riêng + cache (R2: custom domain + Cache rule; tự host: Nginx cache); làm tròn mốc ký cho URL riêng tư để cache trình duyệt (`research.md` bản ghi 4) | Băng thông ra từ kho/máy chủ > ngưỡng chi phí; p95 tải ảnh cao; tỷ lệ cache-miss ảnh lặp cao |
| 4 | Dữ liệu lớn, cần độ bền | R2 làm kho chính (nếu đang tự host) hoặc nhân bản chéo (R2 + sao lưu ngoài nhà cung cấp); lifecycle chuyển lớp lưu trữ nếu cần | Dung lượng vượt khả năng một máy; yêu cầu độ bền cao hơn một ổ đĩa |
| 5 | Rất lớn | Tách `media` thành dịch vụ riêng (đã có biên module); chuyển mã video, quét mã độc như hàng đợi chuyên dụng | Hàng đợi xử lý nền thành điểm nghẽn |

## Nguyên tắc xuyên suốt

- Chỉ tối ưu sau khi có số đo; ghi lại kết quả đo cạnh tài liệu này khi có.
- Tập con S3 di động (BR-01) và chỉ lưu `object_key` (BR-02) là hai ràng buộc quyết định việc "đổi nhà cung cấp không đau"; giữ chúng ở mọi bậc.
- Không thêm CDN, hàng đợi, proxy riêng trước bậc cần chúng.
- Mọi job nền (dọn, đối soát) chạy được trên nhiều instance (khóa phân tán hoặc `SKIP LOCKED`), không giả định một instance.

## Chỉ số cần có từ bậc 0

`storage_request_duration_ms{op,status}`, `storage_errors_total{op,code}`, `media_pending_count`, `media_orphan_deleted_total`, `media_bytes_total{domain}`, dung lượng đĩa/bucket, tuổi bản sao lưu gần nhất.
