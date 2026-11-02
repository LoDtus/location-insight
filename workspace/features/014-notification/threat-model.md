# Mô hình đe dọa — Thông báo (014-notification)

Phương pháp STRIDE theo `.cursor/skills/02-planning-design/06-threat-modeling.md`. Ranh giới tin cậy: trình duyệt/service worker ↔ backend ↔ PostgreSQL/Redis ↔ dịch vụ push của hãng (bên ngoài).

## Tài sản

- Nội dung thông báo (có thể nhạy cảm: thanh toán, bảo mật, tin nhắn).
- Đăng ký push (endpoint + khóa `p256dh`/`auth`): ai có chúng và khóa VAPID riêng có thể gửi push tới người dùng.
- Khóa riêng VAPID, khóa mã hóa đăng ký.
- Tính sẵn sàng của hộp thông báo và hàng đợi push.

## Bảng đe dọa

| ID | Loại | Mối đe dọa | Biện pháp | Mức còn lại |
| --- | --- | --- | --- | --- |
| T1 | Information disclosure (IDOR) | Đọc/đọc-hộ/xóa thông báo của người khác bằng cách đoán `id` | Mọi truy vấn có `user_id = :me`; ngoài chủ sở hữu trả 404 như "không tồn tại"; `id` UUID v7 (không cho phép liệt kê) | Thấp |
| T2 | Tampering / Open redirect | `link` bị nhồi `https://evil` hoặc `javascript:` để điều hướng người dùng | `link` chỉ là đường dẫn tương đối `/app/...` hoặc `/admin/...` theo danh sách mẫu của `type`; kiểm lúc **tạo** và lúc **hiển thị/điều hướng** (client dùng router nội bộ, không gán `location` bằng chuỗi lạ); service worker mở `new URL(link, origin)` rồi kiểm `origin` trùng | Thấp |
| T3 | XSS | Tiêu đề/phụ đề chứa HTML/script lấy từ tên người dùng, nội dung bài | Chỉ văn bản thuần, client hiển thị bằng text node; cắt độ dài; bỏ ký tự điều khiển/bidi; CSP chặt (không `unsafe-inline` cho script) | Thấp |
| T4 | SSRF | Đăng ký push với `endpoint` trỏ vào mạng nội bộ để máy chủ gọi tới | Chỉ `https`, host thuộc danh sách hậu tố dịch vụ push, cổng 443, chặn IP riêng/loopback/link-local sau khi phân giải DNS, không theo chuyển hướng, timeout 10 giây, kiểm lại khi gửi (không chỉ lúc đăng ký) | Thấp |
| T5 | Information disclosure | Rò khóa đăng ký push qua DB/log/sao lưu | Mã hóa AES-256-GCM `endpoint_enc`, `keys_enc`; khóa ở biến môi trường; log không có endpoint/khóa (chỉ 8 ký tự đầu `endpoint_hash`); API không trả lại khóa | Thấp |
| T6 | Spoofing | Kẻ khác gửi push giả mạo tới thiết bị | Chỉ máy chủ có khóa riêng VAPID gửi được; payload mã hóa RFC 8291 xác thực nguồn; khóa riêng ở biến môi trường, không vào repo/log; xoay khóa khi nghi lộ | Thấp |
| T7 | Information disclosure (thiết bị dùng chung) | Sau khi đăng xuất, người dùng kế tiếp vẫn thấy thông báo của người trước trên màn hình khóa/trung tâm thông báo | Đăng ký gắn với thiết bị nhưng **tạm ngưng** khi đăng xuất, thu hồi phiên, đổi mật khẩu, khóa tài khoản (máy chủ làm khi xử lý các sự kiện này; client gọi thêm `suspend` trước khi đăng xuất, best-effort); tạm ngưng thiết bị quá 60 ngày không thấy; service worker đóng thông báo đang hiển thị khi nhận `LOGOUT`; `endpoint` đăng ký bởi người khác chuyển chủ sở hữu; tùy chọn ẩn nội dung trên màn hình khóa | Trung bình (nếu đăng xuất lúc mất mạng thì client không kịp gọi `suspend`, push tiếp tục tới khi phiên bị thu hồi phía máy chủ hoặc thiết bị bị tạm ngưng vì hết hoạt động; hệ điều hành lưu thông báo đã hiện) |
| T8 | Information disclosure (màn hình khóa) | Người đứng cạnh đọc nội dung nhạy cảm | Quy tắc: loại `security`, `billing` mặc định dùng nội dung ngắn không chứa số tiền/mã; `hideContentOnLockScreen` | Trung bình |
| T9 | Denial of service | Một producer lỗi vòng lặp tạo hàng triệu dòng cho một người | Giới hạn 30 dòng/giờ/loại/người, trần 500 dòng/người, `dedupeKey`, gộp; cảnh báo khi vượt ngưỡng | Thấp |
| T10 | Denial of service | Đăng ký push hàng loạt để làm đầy DB/gọi ra ngoài | Tối đa 10 thiết bị/người; giới hạn 20 lần/giờ/người và 60 lần/giờ/IP; endpoint trùng cập nhật không tạo mới | Thấp |
| T11 | Denial of service | Tắc `push_outbox` khi dịch vụ push chậm | Timeout 10 giây, song song tối đa 10, circuit breaker theo host push, thử lại lùi cấp số nhân, `dead` sau 5 lần; không chặn đường tạo thông báo | Thấp |
| T12 | Repudiation | Thông báo bảo mật bị chối bỏ/không có bằng chứng | `push_outbox` giữ trạng thái giao 7 ngày; thông báo `security.*` giữ 365 ngày; thao tác admin giai đoạn 2 ghi `admin_audit_logs` | Thấp |
| T13 | Elevation of privilege | Người dùng thường gọi API soạn tay/hẹn giờ (giai đoạn 2) | Quyền `notification:manage` riêng, kiểm ở backend; giai đoạn 1 không có endpoint đó | Thấp |
| T14 | Tampering | Thông báo giả mạo nội dung nhờ chèn mẫu | `title`/`subtitle` dựng từ mẫu của máy chủ + tham số đã làm sạch; client không bao giờ gửi `title`/`subtitle` | Thấp |
| T15 | Information disclosure | Thông báo "bị chặn" (người đã chặn mình) vẫn nhận | `notify()` kiểm quan hệ chặn của `actor_id` (009) và `follow` trước khi tạo | Thấp |
| T16 | CSRF | Trang ngoài buộc người dùng đọc/xóa/đăng ký push | Cookie `SameSite`, token CSRF cho ghi như các endpoint khác; CORS whitelist | Thấp |
| T17 | Spoofing (socket) | Giả `presence.visible` để chặn push của người khác | Tín hiệu chỉ tác động tới khóa `notif:active:{userId}` của **chính** socket đã xác thực; không nhận userId từ client | Thấp |
| T18 | Privacy | Lộ thói quen người dùng qua thời điểm đọc/trạng thái | `read_at` chỉ chủ sở hữu thấy; không có "đã xem" cho bên thứ ba | Thấp |
| T19 | Supply chain | Thư viện `web-push` bị bỏ hoang hoặc có lỗ hổng | Ghim phiên bản; `npm audit` và Dependabot; bọc sau `PushSender` để thay | Trung bình |
| T20 | Log forgery | Chuỗi người dùng chèn xuống dòng vào log | Làm sạch `\n`, `\r` trước khi log (`security.md` §5) | Thấp |

## Kiểm tra trước khi phát hành

- Kiểm thử tự động cho T1 (ma trận người dùng A/B với từng endpoint), T2 (danh sách mẫu `link`, bao gồm `//evil`, `/\evil`, `%2f%2f`, `javascript:`), T4 (danh sách host, IP riêng, chuyển hướng), T9 (giới hạn).
- Đọc lại cấu hình CSP: `script-src` không có `unsafe-inline` ở production; `worker-src 'self'`; `manifest-src 'self'`.
- Không có khóa VAPID hay khóa mã hóa trong repo, ảnh Docker hay log (`git grep`).
