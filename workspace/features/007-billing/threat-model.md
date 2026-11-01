# Threat Model — Thanh toán (007-billing)

Phương pháp: STRIDE theo `02-planning-design/06-threat-modeling.md`. Mức **Cao** phải có trước khi trỏ webhook SePay ra môi trường thật.

## 1. Tài sản cần bảo vệ

- Số tiền đã vào và quyền gói hoặc tín dụng tương ứng.
- Mã đơn (`code`) và bí mật xác thực webhook.
- Số tài khoản nhận hoàn do người dùng khai.
- Nhật ký đối soát (ai duyệt, ai thu hồi).

## 2. Bề mặt tấn công

| Bề mặt | Ai gọi được | Ghi chú |
| --- | --- | --- |
| `POST /billing/sepay/webhook` | SePay, hoặc kẻ biết URL | Không có JWT |
| `POST /billing/orders` | Người đã đăng nhập | Tạo đơn ảo để dồn DB |
| `GET /billing/orders/{id}` | Chủ đơn | IDOR nếu quên lọc `user_id` |
| `/admin/billing/*` | Admin | Xem gói của một người, thu hồi và hoàn là chiều đọc dữ liệu thanh toán và ghi quyền |
| URL ảnh `vietqr.app` | Trình duyệt người trả | Chỉ là ảnh, không phải bằng chứng đã trả |
| Trang chờ | Người giữ phiên | Poll trạng thái |

## 3. Phân tích STRIDE

| # | Loại | Mối đe dọa | Mức | Biện pháp | Kiểm thử |
| --- | --- | --- | --- | --- | --- |
| S1 | Spoofing | Gửi webhook giả để tự mở gói | Cao | `Authorization: Apikey`. Production bắt HMAC-SHA256 trên raw body. So `accountNumber` với cấu hình | Thiếu khóa, sai khóa, sửa body sau khi ký |
| S2 | Spoofing | Đoán mã `DT` + số tăng để gắn tiền người khác | Cao | 8 hex từ `crypto.randomBytes`, không dùng chuỗi tăng | Mã tuần tự bị từ chối ở lúc tạo |
| T1 | Tampering | Replay cùng `id` để cộng hai lần | Cao | `sepay_id` unique, trong transaction với ghi gói | Hai request song song chỉ một dòng subscription |
| T4 | Tampering | Hai đơn cùng lúc tạo hai gói đang mở | Cao | Khóa theo `user_id` trong transaction và chỉ mục một dòng `ended_at` trống | Hai webhook song song chỉ còn một dòng đang mở |
| T2 | Tampering | Sửa `amount` trên client lúc tạo đơn | Cao | Server đọc catalog, bỏ số tiền client gửi | Body có `amountVnd: 1` vẫn ra 60000 |
| T3 | Tampering | Kích hoạt khi chuyển thiếu | Cao | `transferAmount >= amount_vnd` trong cùng câu cập nhật có `status = pending` | 59999 không thành `paid` |
| R1 | Repudiation | Admin chối đã thu hồi hoặc đã duyệt hoàn | Cao | Ghi `admin_audit_logs` của `004-rbac` với lý do bắt buộc | Thiếu reason thì 400 |
| I1 | Information disclosure | Lộ số tài khoản hoàn trong log hoặc API người khác | Cao | API chủ đơn không trả số tài khoản đầy đủ sau khi gửi. Admin mới đọc. Không log raw webhook ra stdout | Snapshot log |
| I2 | Information disclosure | Ảnh QR trên CDN bị người lạ trả hộ | Thấp | Ai cũng có thể trả vào mã nếu biết mã. Đơn gắn `user_id` lúc tạo nên tiền vào đúng người giữ mã. Không hiện mã người khác | |
| D1 | DoS | Tạo hàng loạt đơn pending | Trung | 10 đơn/giờ/user. Job hết hạn sau 30 phút | Lần thứ 11 trả 429 |
| D2 | DoS | Webhook chậm quá 30 giây khiến SePay bắn lại | Trung | Không gửi thư trong handler | Thời gian handler dưới 1 giây với DB sẵn |
| E1 | Elevation | User gọi API admin để tự thu hồi người khác hoặc tự duyệt hoàn | Cao | `admin:access` và guard sẵn có. User chỉ hủy gói của mình, và hủy không đưa `ended_at` | User gọi revoke thì 403 |
| E2 | Elevation | Đơn `needs_review` bị client tự chuyển `paid` | Cao | Chỉ webhook đủ điều kiện hoặc admin `resolve` | PATCH status từ client không có route |

## 4. Bí mật và mã hóa

- `SEPAY_WEBHOOK_API_KEY`, `SEPAY_WEBHOOK_HMAC_SECRET`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_BANK_CODE`, `SEPAY_ACCOUNT_HOLDER` chỉ ở env. Không commit.
- TLS ở cổng công khai. Webhook từ chối nếu không xác thực được, và không trả chi tiết vì sao.
- Payload gốc nằm trong `payment_transactions.raw` để đối soát. Không đưa vào thông báo cho người dùng.

## 5. Việc chấp nhận

- SePay hoặc ngân hàng báo nhầm số tiền thì chỉ sửa được bằng đối soát tay. Hệ thống không gọi ngược để kiểm tra từng giao dịch ở bản này.
- Phần thừa tiền nằm chờ yêu cầu hoàn, không tự chuyển đi.
