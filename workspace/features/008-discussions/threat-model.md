# Threat Model — Diễn đàn hỏi đáp

Phương pháp: STRIDE theo `02-planning-design/06-threat-modeling.md`.

## 1. Tài sản cần bảo vệ

- Chữ và ảnh hoặc video do người dùng đăng.
- Quyền ẩn bài và khóa chủ đề.
- Bucket MinIO, không để tệp đọc công khai vĩnh viễn.

## 2. Bề mặt tấn công

| Bề mặt | Ai gọi được | Ghi chú |
| --- | --- | --- |
| `POST /discussions/posts` và trả lời | Người đã đăng nhập | Chữ và liên kết |
| `POST /discussions/media` | Người đã đăng nhập | Tệp lên bucket |
| `GET /discussions/posts/{id}` | Người đã đăng nhập | IDOR nếu trả bài ẩn |
| `/admin/discussions/*` | Admin | Ẩn và khóa |

## 3. Phân tích STRIDE

| # | Loại | Mối đe dọa | Mức | Biện pháp | Kiểm thử |
| --- | --- | --- | --- | --- | --- |
| S1 | Spoofing | Gắn media của người khác vào bài mình | Cao | Chỉ nhận media `ready` có `author_id` đúng người gọi | mediaId của user khác bị 404 |
| T1 | Tampering | Gửi HTML hoặc script trong bài | Cao | Lưu chữ đã cắt thẻ, trình duyệt escape khi vẽ | body có `<script>` hiện thành chữ |
| T2 | Tampering | Khai `image/jpeg` nhưng tải tệp khác | Cao | Đọc magic byte lúc complete, lệch thì `rejected` | Đổi đuôi mp4 thành jpeg bị từ chối |
| R1 | Repudiation | Admin chối đã ẩn bài | Trung | `admin_audit_logs` bắt buộc lý do | Thiếu reason thì 400 |
| I1 | Information disclosure | URL tệp không hết hạn, hoặc bài ẩn vẫn trả body | Cao | URL đọc ký hạn. Bài `hidden` và `deleted` là 404 với người không có quyền duyệt | GET sau khi ẩn không còn body |
| I2 | Information disclosure | Ảnh nhà hoặc mặt người nằm trong câu hỏi | Trung | Không bucket công khai. Xóa bài rồi job xóa object sau 7 ngày | Object không còn sau hạn dọn |
| D1 | DoS | Đăng hoặc tải tệp liên tục | Trung | Ngưỡng Redis ở `redis.md`. Từ chối khi Redis lỗi | Lần vượt ngưỡng trả 429 |
| E1 | Elevation | User gọi API ẩn bài hoặc khóa chủ đề | Cao | `discussion:moderate` chỉ admin | User gọi hide thì 403 |

## 4. Bí mật

Không có khóa mới ngoài cấu hình MinIO sẵn có. Không ghi URL đã ký vào nhật ký.
