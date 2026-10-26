# Redis — khóa và kênh của xác thực (003-auth)

Quy ước theo `naming.md`: chữ thường, ngăn bằng `:`, tên trường hash camelCase, **mọi khóa có TTL**.

## Nguyên tắc

- PostgreSQL là nguồn sự thật. Redis chỉ tăng tốc và là điểm thu hồi tức thời. Mất toàn bộ Redis chỉ làm client gọi `/auth/refresh` một lần (không ai mất phiên).
- Khóa phiên hoạt động là **danh sách trắng**: không có khóa = không hợp lệ.
- Cấu hình Redis: `maxmemory-policy volatile-lru`, AOF `everysec` (tùy chọn), không dùng chung database với dữ liệu không có TTL.
- Redis lỗi hoặc quá hạn (timeout 150 ms) ở route cần đăng nhập: trả `503` (đóng an toàn). Route công khai không đọc Redis nên không bị ảnh hưởng, trừ rate limit (mở có kiểm soát: xem mục Rate limit).

## Khóa

| Khóa | Kiểu | Trường / giá trị | TTL | Ghi bởi | Mục đích |
| --- | --- | --- | --- | --- | --- |
| `session:active:{sid}` | hash | `userId`, `authTime` (ms), `clientType`, `createdAt` (ms) | 20 phút (hạn access + 5 phút), ghi lại mỗi lần refresh | login, refresh | Phiên đang hợp lệ |
| `session:revoked:{sid}` | string `reason` | lý do thu hồi | 20 phút | thu hồi | Dấu mộ để API trả ngay `session_revoked` thay vì `session_inactive` |
| `cache:authz:{userId}` | hash | `role`, `status`, `plan`, `planUntil` (ms, `0` = không hạn), `minIat` (giây), `authzVersion` | 15 phút | resolver khi nạp, xóa khi đổi | Danh tính và quyền hiện tại, đọc cùng lượt với phiên |
| `oauth:state:{state}` | hash | `codeVerifier`, `nonce`, `redirectTo`, `createdAt` | 10 phút | `/auth/google/start` | Dùng một lần (`GETDEL`) ở callback |
| `ticket:ws:{ticket}` | string `userId:sid` | | 30 giây | `/realtime/ticket` | Vé WebSocket dùng một lần (`GETDEL`) |
| `ratelimit:login:ip_{ip}` | số đếm | | cửa sổ 15 phút | guard | Giới hạn theo IP |
| `ratelimit:login:acct_{sha256(email)}` | hash `count`, `until` | | 15 phút sau lần sai cuối | guard | Độ trễ tăng dần theo tài khoản; email băm để không lộ trong key |
| `ratelimit:register:ip_{ip}` | số đếm | | 1 giờ | guard | |
| `ratelimit:reset:ip_{ip}` / `ratelimit:reset:acct_{hash}` | số đếm | | 1 giờ | guard | |
| `ratelimit:refresh:sid_{sid}` | số đếm | | 1 phút | guard | |
| `ratelimit:google:ip_{ip}` | số đếm | | 10 phút | guard | |
| `ratelimit:api:user_{userId}` | số đếm | | 1 phút | guard | Hạn mức chung cho người dùng đã đăng nhập |

`{sid}`, `{userId}` là UUID v7 viết thường, có gạch ngang.

## Kênh Pub/Sub

| Kênh | Nội dung (JSON) | Người nhận |
| --- | --- | --- |
| `events:session:revoked` | `{ "sid": "...", "userId": "...", "reason": "logout_other", "at": 1790000000000 }` | mọi instance backend; đóng socket của `sid`, gửi `session.revoked` |
| `events:authz:changed` | `{ "userId": "...", "authzVersion": 7 }` | mọi instance; báo socket của user tải lại quyền (đổi gói, đổi vai trò) |

Pub/Sub không đảm bảo giao hàng: socket còn tự kiểm tra `session:active:{sid}` mỗi 60 giây.

## Lệnh trên đường nóng (mỗi request cần đăng nhập)

Một pipeline, một vòng mạng:

```
HMGET session:active:{sid} userId authTime
HMGET cache:authz:{userId} role status plan planUntil minIat
```

- `session:active` thiếu: `GET session:revoked:{sid}` (đường hiếm) để chọn mã lỗi.
- `cache:authz` thiếu: nạp từ PostgreSQL, ghi `HSET` + `EXPIRE`, gộp lời gọi đồng thời (single-flight theo `userId`) để tránh bão cache.

Ước lượng bộ nhớ: ~300 byte cho một phiên + ~200 byte cho một người dùng. 100.000 phiên hoạt động ≈ 30 MB.

## Thu hồi (Lua, nguyên tử)

Thu hồi một phiên, sau khi PostgreSQL đã `COMMIT`:

```
DEL session:active:{sid}
SET session:revoked:{sid} {reason} EX 1200
PUBLISH events:session:revoked {payload}
```

Đăng xuất tất cả hoặc khóa tài khoản: đọc danh sách `sid` từ PostgreSQL (`WHERE user_id = ? AND revoked_at IS NULL`), chạy khối trên cho từng `sid` trong một script Lua; đồng thời `HSET cache:authz:{userId} minIat {now}` hoặc `status locked`.

## Đối soát

Job mỗi 60 giây: tìm `auth_sessions` có `revoked_at` trong 20 phút gần nhất và đảm bảo `session:active:{sid}` không tồn tại (xóa nếu còn). Bảo đảm mọi lệnh thu hồi bị rớt do Redis chập chờn vẫn có hiệu lực trong ~60 giây, và tối đa 15 phút (hạn access token) trong trường hợp xấu nhất.

## Rate limit khi Redis lỗi

- Route đăng nhập, đăng ký, quên mật khẩu: **đóng** (trả `503`), vì đây là điểm bị dò.
- Rate limit chung cho các route công khai khác: **mở** kèm cảnh báo, tránh sập toàn bộ khi Redis gián đoạn.
