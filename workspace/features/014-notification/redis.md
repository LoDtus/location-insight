# Redis — khóa và kênh của thông báo (014-notification)

Theo quy ước `003-auth/redis.md`: chữ thường, ngăn bằng `:`, mọi khóa có TTL.

## Nguyên tắc

- PostgreSQL là nguồn sự thật. Redis chỉ giữ: bộ đệm số chưa đọc, giới hạn tần suất, tín hiệu "đang hoạt động", cờ khóa worker, và kênh sự kiện. Mất toàn bộ Redis chỉ làm mất bộ đệm và tín hiệu hoạt động (ứng dụng vẫn đúng, có thể gửi thừa vài push).
- Giới hạn tần suất khi **ghi**: Redis lỗi thì **từ chối (503)**, không mở không giới hạn (cùng nguyên tắc `008`/`009`). Đọc bộ đệm lỗi: rơi về DB. `notif:active:*` lỗi: coi như không hoạt động (gửi push), có log.

## Khóa

| Khóa | Kiểu | Giá trị | TTL | Ghi bởi | Mục đích |
| --- | --- | --- | --- | --- | --- |
| `notif:unread:{userId}` | string | số chưa đọc (đã chặn ở 100) | 5 phút | `GET unread-count` | Bộ đệm; `DEL` khi tạo/đọc/xóa |
| `notif:active:{userId}` | string `1` | | 45 giây, gia hạn mỗi 25 giây khi tab hiển thị | gateway (`presence.visible`) | Có tab đang xem ⇒ không push |
| `ratelimit:notif:list:user_{userId}` | số đếm | | 60 giây | `GET /notifications` | 120 lần/phút |
| `ratelimit:notif:write:user_{userId}` | số đếm | | 60 giây | đọc, bỏ đọc, xóa, đọc-tất-cả | 120 lần/phút (client gom lô) |
| `ratelimit:notif:sub:user_{userId}` | số đếm | | 1 giờ | đăng ký/hủy push | 20 lần/giờ |
| `ratelimit:notif:sub:ip_{ip}` | số đếm | | 1 giờ | đăng ký push | 60 lần/giờ |
| `ratelimit:notif:create:user_{userId}:{type}` | số đếm | | 1 giờ | `notify()` | 30 dòng/giờ/loại; trừ `security.*` |
| `ratelimit:notif:push:user_{userId}` | số đếm | | 1 giờ | worker push | 10 push/giờ; dư thì gộp vào một push chung |
| `lock:notif:purge` | string | instanceId | 15 phút | job dọn | Chỉ một instance chạy |
| `lock:notif:push-worker:{shard}` | string | instanceId | 30 giây, gia hạn | worker | Tùy chọn: giới hạn đồng thời; chủ đạo vẫn là `SKIP LOCKED` |

`{userId}` là UUID v7 viết thường có gạch ngang. Giới hạn tần suất dùng script Lua `INCR` + `EXPIRE` nguyên tử như `009`.

## Kênh Pub/Sub

Mỗi sự kiện là JSON có `v`, `at` (ms) và `to` (danh sách userId). Mọi instance đăng ký; instance giữ socket của người nhận thì phát tới phòng `user:{id}`.

| Kênh | Nội dung | Phát thành |
| --- | --- | --- |
| `events:notification:created` | `{ v, at, to:[userId], item: {...như API}, unread?: number }` | `notification.created` |
| `events:notification:changed` | `{ v, at, to, op: "read"\|"unread"\|"read_all"\|"deleted"\|"updated", ids?: [id], upToId?, unread?: number }` | `notification.changed` |
| `events:notification:unread` | `{ v, at, to, unread: number }` | `notification.unread` |

Sự kiện luôn phát **sau** khi giao dịch commit. Pub/Sub không đảm bảo giao: client đồng bộ lại bằng `GET` (FR-12). `unread` chỉ có khi giá trị đã nằm trong bộ đệm; thiếu thì client gọi `GET /notifications/unread-count` (có debounce 300 ms).

## Lệnh trên đường nóng (tạo một thông báo)

1. `INCR` + `EXPIRE` cho `ratelimit:notif:create:*` (một script Lua).
2. Giao dịch DB: `INSERT notifications` (+ `INSERT push_outbox`).
3. Sau commit: `DEL notif:unread:{userId}` và `PUBLISH events:notification:created` (cùng pipeline).

Không dùng `KEYS` hay `SCAN` trên đường nóng.

## Ước lượng bộ nhớ (kiểm lại bằng số đo)

- `notif:unread` và `notif:active`: ~100 byte mỗi khóa; 100.000 người hoạt động ≈ 20 MB.
- Giới hạn tần suất: vài khóa nhỏ mỗi người đang hoạt động, TTL ngắn.
