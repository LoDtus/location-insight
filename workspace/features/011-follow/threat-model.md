# Threat Model — Theo dõi người dùng

Phương pháp: STRIDE (`02-planning-design/06-threat-modeling.md`). Dữ liệu: quan hệ xã hội công khai trong ứng dụng, mức nhạy cảm thấp đến trung bình.

## Tài sản và bề mặt

- Quan hệ ai theo dõi ai và hai bộ đếm; kết quả tìm danh sách; luật Requests của nhắn tin (vì theo dõi bỏ qua yêu cầu).
- Bề mặt: `PUT/DELETE /users/{id}/follow`, `GET followers|following`, `GET /follow/relationships`, `scope=following` ở diễn đàn.

## STRIDE

| # | Loại | Mối đe dọa | Mức | Biện pháp | Kiểm thử |
| --- | --- | --- | --- | --- | --- |
| S1 | Spoofing | Theo dõi thay người khác | Cao | `followerId` chỉ lấy từ phiên, không nhận từ client; DTO `forbidNonWhitelisted` | Body có `followerId` bị 400 |
| T1 | Tampering | Gọi lặp hoặc đua để làm lệch bộ đếm | Trung | Chỉ đổi bộ đếm khi `INSERT ... ON CONFLICT DO NOTHING RETURNING` có dòng; khóa hai hàng theo thứ tự id; bộ đếm `GREATEST(…, 0)` | 10 request song song: bộ đếm đúng |
| T2 | Tampering | Dùng theo dõi để vượt Requests (spam nhắn tin): theo dõi hàng loạt rồi nhắn | Cao | Luật bỏ qua Requests chỉ áp khi **người nhận** theo dõi **người gửi**, không phải ngược lại; người gửi không tự quyết được | Người gửi theo dõi người nhận không làm hội thoại active |
| R1 | Repudiation | Chối đã theo dõi | Thấp | `created_at` trên cạnh; không cần nhật ký thêm | — |
| I1 | Information disclosure | Lộ email hoặc dữ liệu riêng qua danh sách | Trung | Chỉ trả `id`, tên, `username`, ảnh; không email | Phản hồi không có email |
| I2 | Information disclosure | Lộ ai chặn ai qua lỗi theo dõi | Trung | Một mã `cannot_follow_user` cho cả hai hướng chặn; danh sách không hiện người chặn mình | Hai hướng chặn trả cùng phản hồi |
| I3 | Information disclosure | Dò toàn bộ người dùng qua UUID | Thấp | UUID v7 + cần đăng nhập; tìm theo tên đã có giới hạn ở nhắn tin | — |
| D1 | DoS | Theo dõi/bỏ theo dõi liên tục, tạo hàng khổng lồ | Trung | 60 lần/giờ/người; trần 5.000 người theo dõi; Redis lỗi thì từ chối | Lần 61 bị 429 |
| D2 | DoS | Danh sách người theo dõi quá lớn | Trung | Phân trang con trỏ ≤ 50; chỉ mục theo chiều; không `COUNT(*)` khi đọc | `limit=1000` bị cắt về 50 hoặc 400 |
| D3 | DoS | Tab bảng tin theo dõi chậm với người theo dõi nhiều | Trung | Trần 5.000, truy vấn dùng chỉ mục; có ngưỡng nâng cấp (research quyết định 4) | Đo p95 |
| E1 | Elevation | Khách gọi API | Cao | `follow:*` yêu cầu đăng nhập; route khai báo quyền | Khách 401 |

## Việc phải làm trước khi mở

1. Kiểm thử đua cho bộ đếm (AC-06).
2. Xác nhận luật nhắn tin chỉ xét chiều "người nhận theo dõi người gửi" (T2).
