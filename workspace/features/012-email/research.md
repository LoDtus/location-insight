# Nghiên cứu — gửi email (012-email)

Nguồn đã tham khảo và điều rút ra cho bản đầu. Không sao chép mã; chỉ lấy ý tưởng thiết kế.

| Dự án | Điều quan sát | Áp dụng |
| --- | --- | --- |
| [Novu](https://github.com/novuhq/novu) (thông báo đa kênh) | Tách **workflow/template** khỏi **provider**; mỗi provider là một adapter; có trạng thái từng lần gửi, thử lại. Nặng (nhiều dịch vụ, Mongo/Redis/worker). | Giữ ý tách `EmailService` ↔ `MailTransport`; không dùng cả nền tảng. |
| [Listmonk](https://github.com/knadh/listmonk) (Go, Postgres) | Hàng đợi/campaign trong Postgres, worker nhiều luồng, SMTP pool, giới hạn tốc độ, xử lý bounce, mẫu Go-template có khung; hủy đăng ký một chạm. | Pool SMTP + worker nhiều luồng, bounce → suppression, `List-Unsubscribe`. |
| [Ghost](https://github.com/TryGhost/Ghost) | Email giao dịch dùng mẫu mặc định trong mã (Handlebars) + cài đặt cho phép admin đổi một số chuỗi; Mailgun/SMTP. | Mặc định trong mã + ghi đè trong DB. |
| [Discourse](https://github.com/discourse/discourse) | Email gửi qua Sidekiq (job nền), mẫu có thể sửa trong admin ("Customize → Email Templates") theo key + locale, khôi phục mặc định; digest/giới hạn tần suất; VERP/bounce. | Bảng mẫu `(key, locale)`, nút khôi phục, xếp hàng nền, preference theo loại. |
| [Medusa](https://github.com/medusajs/medusa) notification module | Provider SMTP/SendGrid/Resend là module thay được; cấu hình `channel` → provider; lưu bản ghi notification. | Giao diện provider thay được; lưu nhật ký. |
| [Laravel Mail/Notifications](https://laravel.com/docs/mail) | `queue` mặc định, `afterCommit`, Markdown mail có layout, `ShouldQueue`; thử lại backoff; "mailable" có kiểu. | Gửi qua hàng đợi, layout chung, danh mục loại có kiểu. |
| [Mailpit](https://github.com/axllent/mailpit) / MailHog | SMTP giả + UI web cho dev, có API. | Thêm Mailpit vào docker-compose dev để kiểm thử E2E. |
| [nodemailer](https://github.com/nodemailer/nodemailer) | Chuẩn de-facto cho Node: `pool`, DKIM, lỗi có `responseCode`. | Transport SMTP mặc định, phân loại lỗi tạm/vĩnh viễn theo mã phản hồi. |
| [react-email](https://github.com/resend/react-email), [MJML](https://github.com/mjmlio/mjml) | Cách dựng HTML email tương thích client (bảng, inline CSS). | Chỉ lấy khung bảng 600px + CSS inline; không kéo build step vào backend. |
| [Postal](https://github.com/postalserver/postal) | Máy chủ gửi riêng: hàng đợi, bounce, suppression, tin cậy IP. | Tham chiếu bậc 3 nếu tự vận hành MTA (không khuyến nghị sớm). |
| Mẫu **transactional outbox** (Chris Richardson, microservices.io) | Ghi sự kiện trong cùng DB rồi relay bất đồng bộ để không mất tin. | Bảng `email_messages` là outbox; worker là relay. |
| Postgres `SKIP LOCKED` queue (River, graphile-worker, pg-boss) | Hàng đợi trên Postgres đạt hàng nghìn job/giây, không cần broker. | Cách nhận việc của worker. |
| RFC 8058, RFC 2369 | `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`; Gmail/Yahoo yêu cầu cho người gửi hàng loạt (từ 2024). | Tiêu đề hủy đăng ký cho loại `notification`/`marketing`. |

## Lựa chọn và loại bỏ

| Phương án | Quyết định | Lý do |
| --- | --- | --- |
| Hàng đợi BullMQ (Redis) | Không (bản đầu) | Redis AOF vẫn có thể mất vài giây; thêm một mô hình lưu bền thứ hai; Postgres đã là nguồn sự thật. |
| Handlebars/Mustache đầy đủ | Không | Có logic/helper = bề mặt SSTI; nhu cầu chỉ là thay biến. |
| Lưu mẫu chỉ trong DB (seed khi khởi động) | Không | Mặc định trong mã dễ review, không lệch môi trường. |
| Dùng API provider ngay (SES SDK) | Không | SMTP phổ quát, đổi provider bằng cấu hình; API provider thêm ở bậc 2 sau `MailTransport`. |
| Render lúc gửi (không lưu nội dung) | Không | Mẫu có thể đổi giữa lúc xếp và gửi; thử lại sẽ ra nội dung khác; phải giữ biến nhạy cảm. |
