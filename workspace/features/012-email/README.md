# 012 — Gửi email cho người dùng

Trạng thái: đặc tả + triển khai bản đầu (02/11/2026). Phụ thuộc: `003-auth` (token xác minh/đặt lại), `004-rbac`, `010-feedback`, `011-follow`.

## 1. Mục tiêu và phạm vi

Cho hệ thống gửi email tới người dùng một cách **bền, không chặn request, có thể tùy biến nội dung**, với nhiều loại email (xác minh, đặt lại mật khẩu, thông báo bảo mật, chào mừng, trả lời góp ý, có người theo dõi…).

Trong phạm vi bản đầu:

| # | Yêu cầu |
| --- | --- |
| R1 | **Danh mục loại email** định nghĩa trong mã (`key`, danh mục, biến cho phép, mặc định tiếng Việt). Thêm loại mới = thêm một mục trong mã, không cần migration. |
| R2 | **Tùy biến**: admin sửa tiêu đề, nội dung HTML, bản văn bản thuần, bật/tắt từng loại theo ngôn ngữ; xem trước, gửi thử cho chính mình, khôi phục mặc định. |
| R3 | **Gửi qua hàng đợi trong PostgreSQL** (outbox): ghi dòng trong cùng luồng nghiệp vụ, worker gửi nền, thử lại có backoff, khóa bằng `FOR UPDATE SKIP LOCKED` nên chạy nhiều instance an toàn. |
| R4 | **Nhà cung cấp thay được**: giao diện `MailTransport`; bản đầu dùng SMTP (nodemailer) — dùng được với SES, Postmark, SendGrid, Mailgun, Mailpit (dev) chỉ bằng cấu hình. |
| R5 | **Danh mục & tùy chọn**: `security`/`transactional` luôn gửi; `notification` người dùng tắt được; `marketing` mặc định tắt (chưa có loại nào, chừa chỗ). Có liên kết hủy đăng ký ký HMAC + `List-Unsubscribe` một chạm (RFC 8058). |
| R6 | **Danh sách chặn (suppression)**: địa chỉ bị bounce cứng hoặc admin chặn thì không gửi nữa. |
| R7 | **Nhật ký & quan sát**: admin xem trạng thái từng email, thử lại email lỗi, xem số liệu hàng đợi. |
| R8 | **Bảo mật**: không có logic/mã trong mẫu, biến luôn được escape, HTML mẫu được lọc, chặn chèn header, không lưu lâu nội dung nhạy cảm (liên kết đặt lại mật khẩu). |

Ngoài phạm vi (cố ý, xem §8): chiến dịch/gửi hàng loạt, trình soạn thảo kéo-thả, theo dõi mở/click, webhook bounce của nhà cung cấp, email nhận (inbound), nhiều nhà cung cấp song song.

## 2. Kiến trúc

```
Nghiệp vụ (auth, feedback, follow…)
   │  email.send({ template, to, vars, dedupeKey })     ← không bao giờ ném lỗi, không chờ SMTP
   ▼
EmailService.enqueue
   ├─ tra danh mục (mã) → ngôn ngữ → mẫu hiệu lực (DB ghi đè, rơi về mặc định)
   ├─ kiểm: suppression → preference → giới hạn tần suất (Redis)
   ├─ render (thay biến + escape) + layout chung + lọc HTML
   └─ INSERT email_messages (status=queued, dedupe_key unique)
                         │
   EmailWorker (mọi instance, 2 giây/lần + kick ngay sau enqueue)
      claim ≤ N dòng: UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)
      → MailTransport.send → sent | retry(backoff) | dead (+ suppression nếu bounce cứng)
      → xóa nội dung email nhạy cảm sau khi gửi/chết
```

Quyết định chính (chi tiết và nguồn tham khảo ở `research.md`):

1. **Hàng đợi = bảng PostgreSQL**, không thêm BullMQ/Kafka. Cùng giao dịch dữ liệu, không mất email khi tiến trình chết, `SKIP LOCKED` đủ cho hàng trăm email/giây. Chuyển sang hàng đợi riêng ở bậc 3 mà không đổi giao diện `EmailService.send`.
2. **Render lúc xếp hàng**, lưu `subject/body` đã render: nội dung gửi đúng với thứ người dùng thấy ở thời điểm sự kiện; admin sửa mẫu không làm đổi email đã xếp. Nội dung nhạy cảm bị xóa ngay khi xong (xem §6).
3. **Mẫu = chuỗi có biến `{{ten}}` thuần**, không điều kiện/vòng lặp. Đủ cho thông báo giao dịch, loại bỏ nguy cơ SSTI. Khung (header/footer/nút hủy đăng ký) nằm trong mã; admin chỉ sửa phần nội dung.
4. **Mẫu mặc định trong mã, ghi đè trong DB** (như Ghost/Discourse): triển khai mới chạy được ngay, admin chỉ ghi dòng khi tùy biến; "khôi phục mặc định" = xóa dòng.
5. **Không bao giờ làm hỏng nghiệp vụ**: `send()` nuốt và ghi log mọi lỗi; đăng ký/quên mật khẩu không phụ thuộc SMTP sống.

## 3. Danh mục loại email (bản đầu)

| key | Danh mục | Kích hoạt | Biến | Nhạy cảm |
| --- | --- | --- | --- | --- |
| `verify_email` | security | đăng ký (password) | `display_name`, `verify_url`, `expires_minutes` | có |
| `reset_password` | security | quên mật khẩu | `display_name`, `reset_url`, `expires_minutes` | có |
| `password_changed` | security | đặt lại mật khẩu thành công | `display_name`, `changed_at` | không |
| `welcome` | transactional | xác minh email thành công | `display_name`, `app_url` | không |
| `feedback_reply` | transactional | admin trả lời góp ý | `display_name`, `feedback_excerpt`, `reply_excerpt`, `feedback_url` | không |
| `new_follower` | notification | có người theo dõi (mỗi cặp một lần) | `display_name`, `follower_name`, `profile_url` | không |

Biến luôn có sẵn: `app_name`, `app_url`, `support_email`.

Quy tắc ngôn ngữ: `users.locale` → `vi` → mặc định trong mã. Mặc định trong mã chỉ có tiếng Việt; admin có thể thêm bản `en` cho từng loại.

## 4. Mô hình dữ liệu

Xem `postgresql.dbml`. Bốn bảng: `email_templates` (ghi đè), `email_messages` (hàng đợi + nhật ký), `email_suppressions`, `email_preferences`.

Trạng thái `email_messages`:

```
queued ──claim──▶ sending ──ok──▶ sent
   ▲                 │ lỗi tạm, còn lượt → queued (next_attempt_at = backoff)
   │                 └ lỗi vĩnh viễn / hết lượt → dead
   └─ admin "thử lại" (chỉ khi còn nội dung)
suppressed (địa chỉ trong danh sách chặn) · skipped (người dùng tắt loại này, hoặc mẫu bị tắt)
```

Backoff: 1 phút, 5 phút, 30 phút, 2 giờ, 6 giờ (tối đa 5 lần gửi). Khóa thuê (lease) 2 phút: worker chết thì dòng `sending` quá hạn được nhận lại.

## 5. API

Xem `interfaces/rest-api.yml`. Tóm tắt:

- Admin (`email:manage`): danh mục + mẫu (xem, sửa, khôi phục, xem trước, gửi thử), nhật ký + thử lại + số liệu, danh sách chặn.
- Người dùng (`email:self`): `GET/PUT /email/preferences`.
- Công khai: `POST /email/unsubscribe?u&c&t` (một chạm, token HMAC, không cần đăng nhập).

## 6. Hiệu năng, ổn định, mở rộng

- **Không chặn request**: enqueue là một `INSERT`; SMTP chỉ chạy ở worker. Worker dùng kết nối SMTP gộp (pool 5 kết nối, 100 thư/kết nối) và gửi song song tối đa 5.
- **Chỉ mục một phần** `(next_attempt_at) WHERE status IN ('queued','sending')`: truy vấn nhận việc không quét lịch sử.
- **Idempotent**: `dedupe_key` duy nhất (ví dụ `new_follower:{a}:{b}`); chạy lại sự kiện không gửi trùng.
- **Giới hạn tần suất** (Redis): tối đa 20 email/giờ/người nhận và 5 email/giờ cho mỗi (người nhận, loại) với `notification`; email `security` đã bị chặn ở tầng auth (3 yêu cầu/giờ/email). Redis lỗi thì bỏ qua giới hạn (không làm mất email bảo mật), có log.
- **Quan sát**: `GET /admin/email/stats` — số theo trạng thái 24 giờ, độ sâu hàng đợi, tuổi email cũ nhất đang chờ (cảnh báo khi > 5 phút).
- **Dọn dẹp** (mỗi giờ): xóa nội dung email đã gửi sau 7 ngày, xóa dòng `sent/skipped/suppressed` sau 90 ngày, giữ `dead` 90 ngày.
- **Bậc mở rộng** (`§9`): từ một worker trong tiến trình API → tiến trình worker riêng → provider API + webhook → hàng đợi riêng.

## 7. Bảo mật (tóm tắt, chi tiết ở `threat-model.md`)

- Biến được escape HTML; biến `*_url` chỉ chấp nhận `http(s)://` và được dựng ở máy chủ, không nhận từ client.
- HTML mẫu của admin qua `sanitize-html` (danh sách cho phép thẻ/thuộc tính/style); script, form, iframe, `on*=`, `javascript:` bị loại.
- Tiêu đề bị bỏ `\r\n` (chèn header); người nhận lấy từ DB, không từ input người dùng.
- Email nhạy cảm (`verify_email`, `reset_password`): sau khi `sent`/`dead`, `body_html`, `body_text` được đặt `NULL`; token gốc chưa bao giờ lưu riêng.
- Liên kết hủy đăng ký ký HMAC-SHA256 bằng `EMAIL_LINK_SECRET`, so sánh hằng thời gian, không lộ user tồn tại.
- Khuyến nghị hạ tầng: SPF + DKIM + DMARC cho domain gửi, `From` riêng cho giao dịch, TLS tới SMTP.

## 8. Cố ý chưa làm

| Không làm | Lý do | Khi nào xét lại |
| --- | --- | --- |
| Chiến dịch/gửi hàng loạt, phân đoạn | Cần thêm danh sách, tốc độ, theo dõi hủy; bản đầu chỉ giao dịch | Khi có nhu cầu marketing |
| Trình soạn thảo kéo-thả, MJML | Phụ thuộc nặng; mẫu HTML có khung chung đủ dùng | Khi biên tập viên không kỹ thuật cần thiết kế riêng |
| Theo dõi mở/click | Quyền riêng tư; không cần cho giao dịch | Marketing |
| Webhook bounce/complaint của provider | Cần endpoint ký chữ ký theo provider; bounce cứng đồng bộ (SMTP 5xx) đã được bắt | Khi chuyển sang API provider |
| Hàng đợi riêng (BullMQ/SQS) | Thêm thành phần vận hành | Bậc 3 |
| Nhiều bản nháp/lịch sử phiên bản mẫu | `version` + audit log + khôi phục mặc định đủ | Khi nhiều người cùng sửa mẫu |

## 9. Lộ trình mở rộng

| Bậc | Dấu hiệu | Thay đổi |
| --- | --- | --- |
| 1 (bản đầu) | < ~50 email/giây | Worker trong tiến trình API, SMTP pool |
| 2 | tuổi email cũ nhất > 5 phút thường xuyên, hoặc deploy API làm gián đoạn gửi | `MAIL_WORKER_ENABLED=false` trên API, chạy tiến trình worker riêng (cùng mã); provider API (SES/Postmark) + webhook bounce/complaint → `email_suppressions`; tăng batch/đồng thời |
| 3 | > ~500 email/giây hoặc bảng `email_messages` > ~50 triệu dòng | Phân vùng theo tháng, hàng đợi riêng (SQS/BullMQ) giữ nguyên `EmailService.send`; IP/domain gửi riêng cho marketing |

## 10. Tiêu chí nghiệm thu

| # | Tiêu chí |
| --- | --- |
| AC1 | Đăng ký bằng mật khẩu → trong ≤ 10 giây có email `verify_email` ở hộp thư dev (Mailpit) chứa liên kết hợp lệ; request đăng ký không đợi SMTP. |
| AC2 | Tắt SMTP → đăng ký vẫn thành công; email ở `queued` rồi `sent` sau khi SMTP trở lại; sau 5 lần thất bại là `dead`. |
| AC3 | Admin sửa tiêu đề/nội dung `welcome` → email tiếp theo dùng bản sửa; khôi phục → dùng mặc định. |
| AC4 | Biến chứa `<script>` (tên hiển thị) được escape trong HTML; HTML mẫu chứa `<script>`/`onclick` bị loại khi lưu. |
| AC5 | Người dùng tắt `notification` → `new_follower` ghi `skipped`, không gửi; email `security` vẫn gửi. |
| AC6 | Hủy đăng ký bằng token đúng → tắt loại đó; token sai/sửa đổi → 400, không đổi dữ liệu. |
| AC7 | Hai instance cùng chạy worker không gửi trùng một email (kiểm bằng 200 email, 2 worker). |
| AC8 | Cùng `dedupe_key` gọi hai lần → một dòng. |
| AC9 | Email `reset_password` đã `sent` → `body_html`/`body_text` = NULL. |
| AC10 | Địa chỉ trong `email_suppressions` → `suppressed`, không gọi transport. |
| AC11 | Người không có `email:manage` gọi API admin → 403. |
