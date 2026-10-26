# Threat Model — Phân quyền (004-rbac)

Phương pháp: STRIDE, tập trung vào **Elevation of Privilege**, **Information Disclosure** và **lạm dụng hạn mức**. Mức: **Cao / Trung / Thấp**. Phần xác thực, phiên, token nằm ở `003-auth/threat-model.md`.

## 1. Tài sản

- Ranh giới vai trò (user không thành admin).
- Ranh giới gói (free không dùng được tính năng trả phí).
- Hạn mức phân tích (mỗi lượt tốn tiền gọi model).
- Dữ liệu riêng của người dùng (địa điểm đã lưu, ghi chú, lịch sử).
- Dữ liệu liên hệ người đăng tin.
- Nhật ký kiểm toán admin.

## 2. Phân tích

| # | Loại | Mối đe dọa | Mức | Biện pháp | Kiểm thử |
| --- | --- | --- | --- | --- | --- |
| E1 | Elevation | Route quên gắn kiểm tra quyền | Cao | Deny-by-default: thiếu metadata thì ứng dụng không khởi động; `PermissionsGuard` từ chối nếu thiếu metadata; test kiểm kê route | Test kiểm kê, bảng `(principal, route) → status` |
| E2 | Elevation | Mass assignment: client gửi `role`, `plan`, `ownerId`, `status` | Cao | DTO `whitelist` + `forbidNonWhitelisted`; `ownerId` luôn lấy từ principal, không từ body; không có trường `role` trong bất kỳ DTO nào | Test gửi trường lạ |
| E3 | Elevation | IDOR: truy cập tài nguyên người khác bằng đổi `id` | Cao | Quy tắc tài nguyên khai báo (`RESOURCE_RULES`); truy vấn có điều kiện `user_id`; ID UUID; riêng tư → `404` | Test chéo người dùng cho mỗi tài nguyên |
| E4 | Elevation | Nâng vai trò qua API | Cao | Không có API đặt `role`; chỉ CLI của người vận hành, có kiểm toán | Test: quét mọi route để không route nào ghi `users.role` |
| E5 | Elevation | Admin bị chiếm tài khoản | Cao | Step-up ≤ 10 phút cho thao tác phá hủy; tùy chọn `ADMIN_ALLOWED_CIDRS`; cảnh báo đăng nhập admin từ IP mới; giai đoạn 2: TOTP; admin không tác động admin khác | Test `reauth_required` |
| E6 | Elevation | Quyền lỗi thời sau khi hạ gói/khóa | Trung | `cache:authz` xóa khi đổi; TTL 15 phút là mức chặn cuối; gói tính lười theo `planUntil` | Test: đổi gói → request kế tiếp thấy quyền mới |
| E7 | Elevation | Kẻ tấn công lách bằng sửa đường dẫn/phương thức (`/Admin`, `//admin`, HTTP override) | Trung | Chuẩn hóa đường dẫn, tắt `X-HTTP-Method-Override`; quyền gắn vào handler chứ không vào chuỗi đường dẫn | Test biến thể đường dẫn |
| E8 | Elevation | Frontend bị sửa để hiện nút quản trị | Thấp | Chỉ UX; API vẫn từ chối | Test API trực tiếp |
| T1 | Tampering | Webhook thanh toán giả để cấp gói | Cao | Xác thực chữ ký/khóa của nhà cung cấp, đối chiếu số tiền và mã đơn, `payment_order_id` unique, idempotent | Thuộc tính năng thanh toán; test ở đó |
| T2 | Tampering | Sửa cấu hình quyền mà không ai thấy | Trung | Cấu hình trong Git, snapshot ma trận quyền bắt buộc cập nhật trong PR, CODEOWNERS; test đơn điệu | Test snapshot, đơn điệu |
| T3 | Tampering | Thử lại đồng thời để trừ tín dụng định giá hai lần hoặc âm | Trung | Sổ cái với `idempotency_key` unique; kiểm tra số dư trong cùng giao dịch (`SELECT … FOR UPDATE` theo `user_id`) | Test 20 yêu cầu song song |
| R1 | Repudiation | Admin chối hành động | Trung | `admin_audit_logs` bắt buộc (người làm, đối tượng, trước/sau, lý do, IP, phiên); bảng chỉ thêm | Test mỗi hành động admin tạo một bản ghi |
| I1 | Disclosure | Thu thập hàng loạt số liên hệ | Trung | `listing:contact:reveal` cần đăng nhập, rate limit 30/giờ, ghi sự kiện; không trả liên hệ trong danh sách | Test rate limit |
| I2 | Disclosure | Admin xem dữ liệu riêng không cần thiết | Trung | Admin chỉ thấy hồ sơ rút gọn; không có API xem ghi chú hay nội dung phân tích của người dùng; `audit:read` chỉ metadata | Review API |
| I3 | Disclosure | Phản hồi 403/404 phân biệt được tồn tại | Trung | Tài nguyên riêng tư luôn `404`; `permission_denied` không nêu quyền nào | Test so sánh phản hồi |
| I4 | Disclosure | Lộ bảng giá/hạn mức nội bộ trong lỗi | Thấp | Lỗi `plan_required` chỉ nêu gói cần; không nêu số khác | |
| D1 | DoS / lạm dụng | Cạn hạn mức tiền của nhà cung cấp model bằng nhiều tài khoản free | Cao | Hạn mức theo người dùng; đăng ký cần Google/email xác minh; `ratelimit:api` theo người dùng và IP; ngân sách tháng đặt ở nhà cung cấp model; cảnh báo khi chi tiêu bất thường; tùy chọn giảm hạn mức khi vượt ngân sách (cờ cấu hình) | Theo dõi chi phí |
| D2 | DoS / lạm dụng | Race để vượt hạn mức | Trung | Lua nguyên tử; hoàn lượt đúng một lần; idempotent theo `requestId` | Test 50 song song |
| D3 | DoS | Redis lỗi cho phép đi tiếp không đếm | Trung | `reserve` lỗi thì từ chối (503) | Test dừng Redis |
| D4 | DoS | Tạo hàng loạt tin/địa điểm để làm đầy DB | Trung | Giới hạn số lượng theo gói; kích thước body; rate limit ghi | Test `limit_reached` |

## 3. Nguyên tắc tối thiểu quyền cho admin

- Một admin chỉ có quyền liệt kê ở `ADMIN_PERMISSIONS`; không có quyền xem nội dung riêng, không có quyền đặt vai trò.
- Thao tác ảnh hưởng nhiều người (khóa, cấp gói) có lý do bắt buộc và step-up.
- Tạo/gỡ admin chỉ qua CLI, có ghi nhận. Bắt buộc luôn còn ít nhất một admin.
- Admin dùng tài khoản riêng cho việc quản trị, không dùng tài khoản đăng tin cá nhân (khuyến nghị vận hành).

## 4. Rủi ro còn lại được chấp nhận

- Mất Redis có thể cho người dùng thêm lượt trong ngày (giảm bằng nạp lại từ lịch sử).
- Quyền thay đổi cần triển khai lại: chấp nhận vì đã chọn không phân quyền động.
- Một admin duy nhất là điểm rủi ro; chấp nhận ở giai đoạn đầu với step-up và kiểm toán.

## 5. Việc bắt buộc trước khi mở tính năng trả phí

1. Test kiểm kê route và ma trận quyền xanh.
2. Webhook thanh toán có xác thực chữ ký và idempotent.
3. Đặt ngân sách chi tiêu tối đa ở nhà cung cấp model.
4. `admin_audit_logs` hoạt động và đã thử tạo admin bằng CLI.
5. Điều khoản gói và hoàn tiền (`005-legal`) khớp với hạn mức thực tế trong cấu hình.
