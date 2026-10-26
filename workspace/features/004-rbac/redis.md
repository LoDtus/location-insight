# Redis — hạn mức và quyền (004-rbac)

Dùng chung quy ước và cấu hình với `003-auth/redis.md`. Khóa `cache:authz:{userId}` định nghĩa ở đó; ở đây thêm khóa hạn mức.

## Khóa

| Khóa | Kiểu | Giá trị | TTL | Mục đích |
| --- | --- | --- | --- | --- |
| `quota:analysis:{userId}:{yyyymmdd}` | số | số lượt đã dùng trong ngày (giờ Việt Nam) | tới 00:00 ngày kế + 1 giờ | Bộ đếm `analysisDaily` |
| `quota:hold:{userId}:{requestId}` | string | `yyyymmdd` của ngày đã trừ | 10 phút | Giữ chỗ để hoàn lượt đúng một lần và chống trừ hai lần khi thử lại |
| `ratelimit:api:user_{userId}` | số | | 1 phút | Hạn mức chung (003) |
| `ratelimit:contact:user_{userId}` | số | | 1 giờ | Chống thu thập số liên hệ: `listing:contact:reveal` tối đa 30/giờ |
| `ratelimit:api:ip_{ip}` | số | | 1 phút | Khách |

`quota:*` là khóa mục đích riêng (không phải `cache:`); vẫn tuân quy tắc "mọi khóa có TTL". Khuyến nghị cập nhật `naming.md` thêm tiền tố `quota:`.

## Script Lua

```lua
-- reserve: KEYS[1]=quota key, KEYS[2]=hold key
-- ARGV[1]=limit, ARGV[2]=ttlSeconds, ARGV[3]=dayKey, ARGV[4]=holdTtl
if redis.call('EXISTS', KEYS[2]) == 1 then
  return {1, tonumber(redis.call('GET', KEYS[1]) or '0')}   -- thử lại cùng requestId: không trừ lần hai
end
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
if used >= tonumber(ARGV[1]) then
  return {0, used}                                          -- hết lượt
end
used = redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[4])
return {1, used}

-- release: KEYS[1]=hold key, KEYS[2]=quota key (khóa của ngày ghi trong hold)
local day = redis.call('GET', KEYS[1])
if not day then return 0 end                                -- đã hoàn hoặc đã hết hạn giữ chỗ
redis.call('DEL', KEYS[1])
local used = tonumber(redis.call('GET', KEYS[2]) or '0')
if used > 0 then redis.call('DECR', KEYS[2]) end
return 1
```

- **Không giới hạn** (`null`): bỏ qua script, không ghi khóa.
- **commit**: không cần lệnh; khóa giữ chỗ tự hết hạn sau 10 phút, coi như đã tính. Phân tích hỏng giữa chừng và tiến trình chết cũng coi là đã tính (chọn có lợi cho chi phí; hiếm).
- **Nạp lại khi thiếu khóa đếm:** nếu `GET quota:analysis:{userId}:{day}` trả `nil`, đếm số bản ghi lịch sử phân tích của người dùng từ 00:00 hôm nay và `SET … NX EX`. Chạy trước `reserve` ở lần đầu trong ngày (một truy vấn DB cho mỗi người mỗi ngày, hoặc sau khi Redis mất).
- `dayKey` tính bằng `Intl` với múi giờ `QUOTA_TIMEZONE`, không dùng giờ máy chủ.

## Hành vi khi Redis lỗi

- `reserve` lỗi: **từ chối** phân tích (`503`), vì phân tích tốn tiền; không cho đi tiếp không đếm.
- `release` lỗi: ghi log mức cảnh báo và đưa vào hàng đợi thử lại 3 lần; sau đó chấp nhận mất lượt (người dùng có thể nhờ admin `quota:reset`).
