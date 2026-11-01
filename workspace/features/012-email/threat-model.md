# Mô hình đe dọa — gửi email (012-email)

| # | Mối đe dọa | Biện pháp | Dư rủi ro |
| --- | --- | --- | --- |
| T1 | **Chèn header** qua tiêu đề/tên (`\r\nBcc:`) | Tiêu đề bị bỏ ký tự điều khiển; người nhận lấy từ DB; nodemailer mã hóa header | Thấp |
| T2 | **XSS/HTML injection** trong email qua biến (tên hiển thị, nội dung góp ý) | Mọi biến escape HTML; biến URL chỉ `http(s)`; khung email không cho script | Client email hiển thị tùy ý — chỉ dùng thẻ an toàn |
| T3 | **Admin (hoặc phiên admin bị chiếm) chèn mã độc/phishing vào mẫu** | `sanitize-html` allowlist (không script/form/iframe/img từ xa/`on*`/`javascript:`); `href` chỉ `https`/`mailto` hoặc biến `*_url`; mọi sửa mẫu ghi `admin_audit_logs`; cần `email:manage`; gửi thử chỉ tới chính admin | Admin vẫn có thể viết nội dung lừa đảo bằng chữ — chấp nhận, có audit |
| T4 | **SSTI** (mẫu thực thi mã) | Cú pháp chỉ `{{biến}}` thay chuỗi, biến phải nằm trong danh mục; không helper, không biểu thức | Không |
| T5 | **Lạm dụng làm máy gửi thư** (spam người khác qua "quên mật khẩu", "theo dõi") | Giới hạn auth 3/giờ/email; giới hạn 20/giờ/người nhận + 5/giờ/(người nhận, loại notification); `dedupe_key`; người nhận luôn là chủ tài khoản | Email giả danh có thể gửi tới người tồn tại tài khoản — mức tối thiểu của mọi hệ thống |
| T6 | **Lộ token trong DB/nhật ký** (`reset_url`) | Nội dung email nhạy cảm bị `NULL` ngay khi sent/dead; nhật ký log không in nội dung/URL; token gốc không lưu riêng (đã băm ở `auth_one_time_tokens`); bỏ log token dev khi đã có Mailpit | Cửa sổ giữa xếp hàng và gửi (giây–phút) |
| T7 | **Liệt kê tài khoản** qua hành vi gửi | Luồng quên mật khẩu/đăng ký giữ nguyên phản hồi đồng nhất của 003-auth; enqueue không đổi thời gian phản hồi đáng kể (một INSERT) | Thấp |
| T8 | **Giả mạo liên kết hủy đăng ký** | HMAC-SHA256(`EMAIL_LINK_SECRET`, `userId.category`), so sánh hằng thời gian; token không hết hạn nhưng chỉ có tác dụng tắt một loại | Ai có email có thể tắt thông báo của người đó — đúng với mọi dịch vụ |
| T9 | **Hủy đăng ký loại bắt buộc** | Chỉ `notification`/`marketing` nhận hủy; `security`/`transactional` bị từ chối | Không |
| T10 | **Bão thử lại** khi provider sập | Backoff mũ, tối đa 5 lần, đồng thời 5; dòng `dead` dừng hẳn | Thấp |
| T11 | **Gửi trùng** do nhiều worker | `FOR UPDATE SKIP LOCKED` + lease; `dedupe_key` | Gửi trùng hiếm khi worker chết đúng sau khi SMTP nhận nhưng trước khi ghi `sent` (at-least-once) — chấp nhận |
| T12 | **Hộp thư bị bounce cứng làm hại uy tín gửi** | Bounce cứng (SMTP 5xx user unknown) → `email_suppressions` | Bounce không đồng bộ chờ webhook (bậc 2) |
| T13 | **PII trong log/nhật ký lưu quá lâu** | Xóa nội dung sau 7 ngày, xóa dòng sau 90 ngày; admin chỉ thấy địa chỉ, tiêu đề, trạng thái, lỗi | — |
| T14 | **Cấu hình SMTP lộ** | Chỉ từ biến môi trường; không trả về qua API; `MAIL_DRIVER=log` ở môi trường không có SMTP không in nội dung nhạy cảm | — |
| T15 | **Redis lỗi** | Giới hạn tần suất fail-open có log (không mất email bảo mật); worker/hàng đợi không phụ thuộc Redis | Có thể vượt giới hạn trong lúc Redis lỗi |
