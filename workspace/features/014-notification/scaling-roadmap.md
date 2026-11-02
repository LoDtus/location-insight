# Lộ trình mở rộng — Thông báo (014-notification)

Các con số là **mục tiêu thiết kế**, không phải số đo. Mỗi bậc chỉ làm khi số đo của bậc trước chạm ngưỡng; kèm cách đo.

| Bậc | Quy mô tham chiếu | Việc làm | Ngưỡng chuyển bậc (đo bằng) |
| --- | --- | --- | --- |
| 0 (bản đầu) | ≤ 100.000 người dùng, ≤ 5 triệu dòng/ngày | Một bảng `notifications` với 2 chỉ mục một phần; một instance backend có thể nhân bản; worker push chạy trong tiến trình backend (`SKIP LOCKED`); Pub/Sub thuần | p95 `GET /notifications` > 50 ms hoặc `push_outbox` queued > 5.000 kéo dài > 1 phút |
| 1 | tới ~1 triệu người dùng | Dọn dẹp theo lô tách job riêng; replica đọc cho `GET /notifications`; tăng song song worker và tách worker thành tiến trình riêng (cùng ảnh Docker, khác lệnh) | Bảng > 100 triệu dòng, hoặc dọn dẹp > 1 giờ |
| 2 | bảng lớn | **Phân vùng theo tháng** theo thời gian (khóa phân vùng lấy từ UUID v7/`created_at`); dọn dẹp bằng `DROP PARTITION`; chỉ mục cục bộ theo phân vùng | Truy vấn danh sách phải quét nhiều phân vùng; vẫn dùng con trỏ `id` nên chỉ cắt theo phạm vi |
| 3 | tải push lớn | Chuyển hàng đợi push sang BullMQ/Redis Streams hoặc hàng đợi chuyên dụng; nhóm theo host dịch vụ push để tận dụng kết nối HTTP/2 giữ sống; thêm bộ giới hạn tốc độ theo host | Thông lượng worker < tốc độ tạo; 429 từ dịch vụ push |
| 4 | phát sóng ≥ 1 triệu người nhận | Thông báo phát sóng dùng **fan-out khi đọc**: một dòng chung + con trỏ đã đọc theo người (`broadcast_read(user_id, broadcast_id)`); giao diện hợp hai nguồn khi phân trang theo `id`; push phát sóng gửi theo lô có điều tiết | Thời gian fan-out khi ghi > cửa sổ cho phép |
| 5 | rất lớn | Tách `notification` thành dịch vụ riêng (đã có biên module rõ), băm phân vùng theo `user_id`, Redis adapter sharded cho Socket.IO | Một DB không còn chịu được ghi |

## Nguyên tắc xuyên suốt

- Hợp đồng REST/socket **không đổi** giữa các bậc.
- Chỉ tối ưu sau khi có số đo; mỗi bậc kèm kiểm thử tải (k6) và `EXPLAIN (ANALYZE, BUFFERS)` lưu lại ở thư mục này khi có.
- Thông báo phát sóng (giai đoạn 2) phải qua hàng đợi và điều tiết, không bao giờ chạy trong yêu cầu HTTP của admin.
- Mọi job nền dùng khóa phân tán hoặc `SKIP LOCKED` để chạy được trên nhiều instance.

## Chỉ số cần có từ bậc 0

`notifications_created_total{type}`, `notifications_read_total`, `notification_list_duration_ms`, `realtime_delivery_latency_ms` (tạo→socket), `push_sent_total{status}`, `push_latency_ms`, `push_outbox_depth`, `push_subscription_gone_total` (404/410), `notification_rate_limited_total`.
