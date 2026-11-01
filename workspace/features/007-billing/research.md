# Technical Research — Thanh toán và quản lý gói

## Bản ghi quyết định 1 — Cổng SePay, QR và webhook <!-- key: decision_record -->

**Status:** Accepted
**Category:** Integration Feasibility
**Door Type:** One-way (expensive to reverse)

### Bối cảnh <!-- key: context -->

`chinh-sach-thanh-toan.md` đã công bố thanh toán bằng chuyển khoản hoặc QR qua SePay, và chỉ ghi nhận sau khi cổng xác nhận. Chưa có thư viện SePay trong repo.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| SePay webhook + ảnh VietQR | Khớp chính sách và pháp lý đã viết | Một endpoint, không SDK | Khó đổi cổng sau khi người dùng đã quen QR | Tài liệu chính thức: developer.sepay.vn |
| Cổng thẻ (Stripe, VNPay thẻ) | Trái câu "không lưu thẻ" và trái chính sách hiện tại | Thêm PCI và hoàn thẻ | Khó | Loại |
| Tự đọc sao kê ngân hàng | Không có sẵn | Dễ gãy khi ngân hàng đổi file | Dễ bỏ | Loại |

### Quyết định <!-- key: decision -->

Dùng SePay. Ảnh QR là URL `https://vietqr.app/img` với `acc`, `bank`, `amount`, `des`. Xác nhận bằng webhook `POST` JSON. Không thêm SDK.

### Hệ quả <!-- key: consequences -->

Phải có API key webhook và, khi production, HMAC. Hoàn tiền không đi qua SePay. Threat model phải xử lý webhook giả và gửi lại.

### Khả năng đảo ngược <!-- key: reversibility -->

Đổi cổng sau này được, vì đơn và gói là bảng của mình. Mất công viết lại webhook và QR. Lời trên website phải sửa cùng lúc.

---

## Bản ghi quyết định 2 — Khi nào đơn được tính là đã trả <!-- key: decision_record -->

**Status:** Accepted
**Category:** Integration Feasibility
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

SePay gửi mọi giao dịch khớp bộ lọc, kể cả thiếu tiền, thừa tiền, tiền ra, và gửi lại cùng `id`. Checklist của SePay gợi ý so khớp số tiền trong câu `UPDATE`, không so trong bộ nhớ rồi mới ghi.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Đủ khi một giao dịch vào `>=` số tiền đơn, đúng mã, đúng tài khoản | Khớp gợi ý `amount <= transfer` của SePay | Một giao dịch SQL | Đổi ngưỡng được, đơn cũ giữ quy tắc lúc tạo | Phần thừa để người dùng xin hoàn |
| Chỉ nhận đúng bằng số tiền | Dễ giải thích | Cũng đơn giản | Dễ | Thừa 1 đồng là kẹt, hay xảy ra khi ngân hàng làm tròn phí hiển thị |
| Cộng nhiều lần chuyển đến khi đủ | Khéo với người chuyển thiếu | Phải khóa số dư dở | Khó hơn | Để sau, chưa cần |

### Quyết định <!-- key: decision -->

Một giao dịch `in`, đúng `code`, đúng `accountNumber` cấu hình, `transferAmount >= amount_vnd`, đơn còn `pending` và chưa hết hạn thì chuyển `paid` trong cùng transaction với việc ghi gói hoặc tín dụng. `sepay_id` unique. Thiếu tiền giữ `pending` và ghi số đã nhận. Hết hạn hoặc lệch tài khoản thì `needs_review`, không mở quyền.

### Hệ quả <!-- key: consequences -->

Đơn lưu `amount_vnd` tại lúc tạo. Webhook không đọc lại catalog.

### Khả năng đảo ngược <!-- key: reversibility -->

Đổi quy tắc cho đơn mới bằng một nhánh trong service. Đơn đã `paid` không tính lại.

---

## Bản ghi quyết định 3 — Không hàng đợi riêng cho webhook <!-- key: decision_record -->

**Status:** Accepted
**Category:** Cross-Service Pattern
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

SePay đòi trả `{"success": true}` trong 30 giây. Repo chưa có hàng đợi. Việc ghi đơn và gói là một transaction Postgres ngắn, rồi một lần xóa cache quyền như `004-rbac`.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Ghi DB rồi trả 200 trong cùng request | Đúng pattern service hiện tại | Không thêm hạ tầng | Sau này tách worker được | Phải giữ handler ngắn, không gửi thư trong request |
| Trả 200 trước, xử lý bằng Redis list | An toàn hơn nếu việc nặng | Thêm worker cần canh | Dễ | Chưa có việc nặng |
| Bỏ qua idempotency, chỉ tin HTTP | Nguy hiểm khi SePay replay | Không chấp nhận | | Loại |

### Quyết định <!-- key: decision -->

Xử lý trong request, trong một transaction, rồi mới trả `{"success": true}`. Thông báo trong ứng dụng ghi cùng transaction. Không gửi email trong handler. Nếu đã có `sepay_id` thì trả thành công ngay, không ghi gói lần hai.

### Hệ quả <!-- key: consequences -->

Endpoint webhook không đi qua envelope `ApiResponseDto`. Giống health: body đúng hợp đồng của SePay.

### Khả năng đảo ngược <!-- key: reversibility -->

Khi có thư hoặc việc chậm, đẩy phần đó ra sau commit mà không đổi hợp đồng với SePay.

---

## Bản ghi quyết định 4 — Một gói đang mở cho mỗi người <!-- key: decision_record -->

**Status:** Accepted
**Category:** Data Migration
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Sản phẩm không có tenant. Mỗi người chỉ đăng ký một gói cho chính mình. Giả định cũ của `billing-idea.md` cho hai hạng chạy cùng lúc và lấy hạng cao hơn, đúng câu hỏi Q4 còn mở của `004-rbac`. Stripe, với mô hình một khách một subscription, đưa người đã có gói về trang quản lý gói thay vì tạo subscription thứ hai. Cổng khách của Stripe cho đổi gói, hủy cuối kỳ và dùng tiếp đến hết kỳ. Sản phẩm này không prorate và không tự trừ tiền.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Một dòng đang mở. Cùng hạng thì nối `period_end`. Lên hạng thì đóng dòng cũ lúc dòng mới bắt đầu. Xuống hạng khi còn hạn thì từ chối | Khớp "một người, một gói" và luật không prorate | Một transaction theo `user_id` | Đổi được, vì lịch sử vẫn là nhiều dòng đã đóng | Giống giới hạn một subscription của Stripe, bỏ prorate và bỏ ghế |
| Hai hạng chồng, hạng cao thắng | Đã viết trong `004-rbac` | Dễ tính nhầm ngày đã trả | Dễ | Trái yêu cầu một gói. Bỏ |
| Hoàn phần ngày chưa dùng khi đổi hạng | Công bằng hơn | Phải tính tiền lẻ và hoàn tay | Khó giải thích trên chính sách hiện tại | Trái "không prorate" |

### Quyết định <!-- key: decision -->

Mỗi người có tối đa một dòng `subscriptions` chưa kết thúc (`ended_at` trống và trạng thái còn `active` hoặc `canceled`). Hết hạn thì dòng đó chuyển `expired` trong cùng transaction trước khi ghi dòng mới. Mua cùng hạng khi chưa hết hạn thì nối `period_end`, không tạo dòng thứ hai. Mua hạng cao hơn thì đóng dòng cũ tại thời điểm trả và mở dòng mới từ lúc đó, không hoàn phần ngày còn lại. Mua hạng thấp hơn khi dòng cao hơn chưa hết hạn thì từ chối. Lượt định giá lẻ không chiếm chỗ gói. Admin chỉ cấp gói khi không còn dòng trả phí đang mở. Người dùng hủy thì dùng đến `period_end` và được rút lại lệnh hủy trước ngày đó.

### Hệ quả <!-- key: consequences -->

`004-rbac` vẫn có thể lấy hạng cao nhất nếu dữ liệu cũ bẩn, nhưng thanh toán không tạo thêm dòng đang mở. Q4 của `004-rbac` được chốt tại đây. Cấp gói đè và mua hạ hạng khi còn hạn trả `409`.

### Khả năng đảo ngược <!-- key: reversibility -->

Bỏ ràng buộc một dòng đang mở là sửa transaction và chỉ mục. Các dòng đã đóng không cần viết lại.
