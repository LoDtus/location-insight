# Redis — Thanh toán (007-billing)

Đúng hay sai của một giao dịch nằm ở Postgres (`payment_transactions.sepay_id` unique và một transaction ghi đơn cùng gói). Redis không phải nguồn sự thật.

| Khóa | Việc | TTL |
| --- | --- | --- |
| `billing:lock:{sepayId}` | `SET NX` trước khi mở transaction, phòng hai request cùng `id` cùng lúc | 60 giây, xóa sau commit hoặc rollback |
| `billing:checkout:{userId}` | Đếm số đơn `pending` tạo trong một giờ | 1 giờ, tối đa 10 lần |

Không nhét payload webhook, số tài khoản người nhận hoàn, hay ảnh QR vào Redis.

Sau khi đơn `paid` ghi `subscriptions` hoặc `credit_ledger_entries`, làm đúng bước của `004-rbac`: xóa `cache:authz:{userId}` rồi `PUBLISH events:authz:changed`.
