# Thanh toán và quản lý gói

**Feature ID:** 007-billing
**Status:** Draft
**Last Updated:** 2026-10-27

## Tổng quan <!-- key: overview -->

Người dùng trả gói hoặc một lượt định giá bằng chuyển khoản SePay (QR hoặc nội dung có mã). Khi webhook xác nhận đủ tiền, hệ thống ghi `subscriptions` hoặc cộng tín dụng định giá rồi xóa cache quyền. Người dùng hủy mà vẫn dùng đến hết hạn, được nhắc trước ngày hết, và xin hoàn trong các trường hợp chính sách đã cho. Admin đối soát lệnh lệch, thu hồi và ghi nhận đã chuyển tiền trả. Không tự trừ tiền.

## Mục tiêu & Phạm vi <!-- key: goals_scope -->

**In scope:**

- Catalog lấy từ `/#bang-gia`: không giới hạn lượt 30.000/tháng hoặc 300.000/năm, có định giá 60.000/tháng hoặc 600.000/năm, định giá lẻ 10.000.
- Đơn, QR, webhook, thiếu tiền, thừa tiền, sai mã, tiền ra, trùng, đến muộn, giả mạo.
- Hủy cuối kỳ, thu hồi ngay, hoàn, nhắc 7 ngày, 1 ngày và đúng ngày hết hạn.
- UI mock trong `ui/`.

**Out of scope:**

- Trừ tiền định kỳ, thẻ, ví, hóa đơn điện tử.
- Gọi SePay ở môi trường chưa có khóa.
- Sửa quyền trong `authorization.config.ts`.

## Đối tượng liên quan <!-- key: actors -->

- Người dùng đã đăng nhập: trả, chờ, gia hạn, hủy, xin hoàn.
- Khách: xem giá, bị đưa tới đăng nhập khi bấm trả.
- SePay: gửi webhook.
- Admin: đối soát, thu hồi, duyệt hoàn, ghi đã chi.
- Job 08:00 giờ Việt Nam: tạo thông báo nhắc hạn.

## Yêu cầu chức năng <!-- key: functional_requirements -->

- **FR-01 (catalog):** `GET /billing/catalog` trả giá đang chốt. Client không được gửi giá.
- **FR-02 (tạo đơn):** Đăng nhập, chọn `subscription` + `unlimited|valued` + `month|year`, hoặc `valuation_credit`. Server tạo mã `DT` + 8 hex, hạn 30 phút, URL QR.
- **FR-03 (chờ):** Trang chờ đọc trạng thái khoảng 3 giây một lần đến khi `paid`, `expired`, `canceled` hoặc `needs_review`.
- **FR-04 (webhook):** Nhận payload SePay, xác thực, chống trùng bằng `id`, áp quy tắc tiền, trả đúng `{"success": true}`.
- **FR-05 (kích hoạt):** Đủ điều kiện thì một transaction ghi đơn `paid` và hoặc một `subscriptions` (`source = payment`, `payment_order_id` unique) hoặc một bút toán tín dụng `purchase`. Rồi xóa cache quyền.
- **FR-06 (gia hạn):** Đơn mới cùng hạng, mua khi gói cũ chưa hết, thì `period_start` của đoạn mới bằng `period_end` cũ. Mua hạng khác thì đoạn mới tính từ lúc trả. Hạng hiệu lực vẫn do `004-rbac`.
- **FR-07 (hủy):** Chủ gói chuyển `canceled`, `ended_at` để trống. Dùng đến `period_end`.
- **FR-08 (thu hồi):** Admin đặt `ended_at = now`, bắt buộc lý do, ghi audit, báo cho người dùng, xóa cache.
- **FR-09 (hoàn):** Người dùng gửi yêu cầu và tài khoản nhận. Ca 24 giờ bị chặn nếu đã dùng quyền. Admin duyệt thì thu hồi phần tương ứng. `paid_out` chỉ sau khi người vận hành đã chuyển khoản và nhập mã tham chiếu.
- **FR-10 (nhắc):** Mỗi gói một thông báo cho `renewal_7d`, `renewal_1d`, `renewal_due`. Không tạo lệnh thu.
- **FR-11 (hủy đơn chờ):** Chủ đơn xóa đơn `pending`. Tiền đến sau đó thành `needs_review`.
- **FR-12 (đối soát):** Admin `fulfill` hoặc `reject` đơn `needs_review`. `fulfill` chỉ chạy một lần.

## Quy tắc nghiệp vụ <!-- key: business_rules -->

- **BR-01 (đủ tiền):** `transferType = in`, `code` khớp đơn `pending`, `accountNumber` khớp cấu hình, `transferAmount >= amount_vnd`, `now < expires_at`.
- **BR-02 (thiếu):** Ghi `received_vnd`, đơn vẫn `pending`, thông báo số còn thiếu. Không mở quyền.
- **BR-03 (thừa):** Vẫn `paid` nếu BR-01 đúng. `received_vnd - amount_vnd` là phần được xin hoàn lý do `overpay`.
- **BR-04 (tiền ra):** Lưu giao dịch, `apply_result = ignored`, không đổi đơn.
- **BR-05 (không mã):** Lưu `unmatched`, trả 200 để SePay khỏi gửi lại, không ghép tay trong webhook.
- **BR-06 (muộn):** Đơn đã `expired` hoặc `canceled` mà tiền tới thì `needs_review`.
- **BR-07 (giá):** `amount_vnd` copy từ catalog lúc tạo. Sửa catalog không sửa đơn cũ.
- **BR-08 (thời hạn):** Tháng 30 ngày, năm 365 ngày, tính từ `paid_at` hoặc nối vào `period_end` khi gia hạn cùng hạng.
- **BR-09 (một gói một đơn):** `payment_order_id` unique nên một đơn không tạo hai subscription.
- **BR-10 (hoàn 24 giờ):** Chỉ khi `paid_at` trong 24 giờ và `benefit_used_at` trống. Hoàn cả đơn thì `ended_at = now` hoặc trừ đúng một tín dụng nếu sổ còn đủ.
- **BR-11 (không tự gia hạn):** Không có bản ghi lịch trừ. Hết hạn thì `004-rbac` coi như miễn phí.
- **BR-12 (chồng hạng):** Đang unlimited mà mua valued thì valued có hiệu lực ngay, unlimited cũ không bị xóa.
- **BR-13 (admin):** Không thu hồi chính mình và không thu hồi admin khác, cùng luật `004-rbac`.

## Tóm tắt luồng người dùng <!-- key: user_flow_summary -->

1. Ở `/#bang-gia` chọn kỳ và gói, hoặc chọn một lượt định giá. Chưa đăng nhập thì qua đăng nhập rồi trở lại.
2. Hệ thống tạo đơn, hiện QR, số tiền, số tài khoản và nội dung đúng bằng mã. Người dùng chuyển khoản trong 30 phút.
3. Webhook đủ tiền thì trang chờ thành biên lai, gói hoặc lượt xuất hiện trong Gói của tôi.
4. Thiếu tiền thì trang nói còn thiếu bao nhiêu và giữ nguyên nội dung. Hết giờ thì đơn hết hạn, tiền tới sau đi vào hàng đối soát.
5. Trước ngày hết hạn 7 ngày, 1 ngày và sáng ngày hết hạn có một thông báo. Bấm Gia hạn tạo đơn mới. Hủy thì dùng đến ngày đã trả.
6. Xin hoàn điền ngân hàng nhận. Admin duyệt, tự chuyển khoản ngoài hệ thống, rồi ghi mã tham chiếu.

Sơ đồ: `diagrams/sequence-checkout.mmd`, `diagrams/sequence-webhook.mmd`, `diagrams/state-order.mmd`, `diagrams/state-subscription.mmd`, `diagrams/flow-refund.mmd`, `diagrams/flow-renewal.mmd`.

## Bối cảnh kỹ thuật <!-- key: technical_context -->

SePay và quy tắc đủ tiền nằm trong `research.md`. Ảnh QR là URL công khai, không lưu file. Webhook đứng ngoài envelope JSON của API thường. Idempotency là unique `sepay_id` cộng khóa Redis ngắn. Nhắc hạn là job trong process, cùng kiểu lịch đã dùng cho dọn phiên, chạy 08:00 `Asia/Ho_Chi_Minh`. Catalog là hằng trong code thanh toán, không phải biến môi trường. Bí mật ngân hàng và khóa webhook là env.

## Phụ thuộc <!-- key: dependencies -->

- `003-auth` cho phiên người mua và vai trò admin.
- `004-rbac` cho `subscriptions`, `credit_ledger_entries`, cache và audit.
- `005-legal` cho lời hủy và hoàn trên UI.

## Ràng buộc <!-- key: constraints -->

- HTTP 200 hoặc 201 và body đúng `{"success": true}` trong 30 giây.
- Không lưu thẻ, OTP, mật khẩu ngân hàng.
- Không tự trừ tiền.
- Hoàn tiền là chuyển khoản tay của người vận hành.
- Giá và lời trên UI không được trái chính sách thanh toán đã đăng.

## Tài liệu liên quan (Artifacts) <!-- key: artifacts -->

- Diagrams: `diagrams/sequence-checkout.mmd`, `diagrams/sequence-webhook.mmd`, `diagrams/state-order.mmd`, `diagrams/state-subscription.mmd`, `diagrams/flow-refund.mmd`, `diagrams/flow-renewal.mmd`
- API Contracts: `interfaces/rest-api.yml`
- Database Schemas: `postgresql.dbml`, `redis.md`
- Technical Research: `research.md`
- Threat model: `threat-model.md`
- UI: `ui/thanh-toan.html`, `ui/cho-thanh-toan.html`, `ui/goi.html`, `ui/hoan-tien.html`, `ui/admin.html`

## Tiêu chí nghiệm thu (Acceptance Criteria) <!-- key: acceptance_criteria -->

- [ ] **AC-01:** Given người dùng chọn gói có định giá theo năm, When tạo đơn, Then `amount_vnd` là 600000, mã bắt đầu bằng `DT`, QR có cùng số tiền và cùng nội dung.
- [ ] **AC-02:** Given đơn pending, When webhook `in` đúng mã, đúng tài khoản, số tiền bằng đơn, Then một subscription `valued`, cache quyền mất, lần webhook cùng `id` không thêm dòng thứ hai.
- [ ] **AC-03:** Given số tiền webhook nhỏ hơn đơn, When xử lý, Then đơn vẫn pending, `received_vnd` đúng số đã nhận, không có subscription.
- [ ] **AC-04:** Given webhook không có Apikey đúng, When gửi, Then 401 và không có dòng giao dịch.
- [ ] **AC-05:** Given chủ gói bấm hủy, When tới trước `period_end`, Then quyền còn. Given admin thu hồi, When xong, Then `ended_at` là hiện tại và quyền hết.
- [ ] **AC-06:** Given đã phân tích một lần sau khi trả, When xin hoàn trong 24 giờ, Then bị từ chối. Given chưa dùng và chưa quá 24 giờ, Then tạo được yêu cầu.
- [ ] **AC-07:** Given gói còn 7 ngày, When job sáng chạy, Then đúng một thông báo `renewal_7d`, không có đơn tự tạo.
- [ ] **AC-08:** Given đơn đã hết hạn, When tiền tới, Then `needs_review` và admin `fulfill` mới mở quyền.

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

- Thời hạn năm là 365 ngày (đang giả định) hay 10 tháng sử dụng.
- Ngân hàng ký với SePay có bắt buộc tài khoản ảo hay không.

## Nhật ký cập nhật <!-- key: update_log -->

- 2026-10-27: Đặc tả đầu tiên từ `/#bang-gia`, chính sách thanh toán và tài liệu webhook SePay. UI mock nằm trong `ui/`.
