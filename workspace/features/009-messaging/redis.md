# Redis — khóa và kênh của nhắn tin (009-messaging)

Theo quy ước `003-auth/redis.md`: chữ thường, ngăn bằng `:`, mọi khóa có TTL.

## Nguyên tắc

- PostgreSQL là nguồn sự thật. Redis chỉ giữ: giới hạn tần suất, hiện diện, bộ đệm thành viên hội thoại, và kênh sự kiện. Mất toàn bộ Redis chỉ làm: mất trạng thái hoạt động, mất một số sự kiện đang bay (client đồng bộ lại), reset bộ đếm giới hạn.
- Tin nhắn không bao giờ chỉ nằm trong Redis.
- Giới hạn tần suất khi ghi: Redis lỗi thì **từ chối** (503), không mở không giới hạn (cùng nguyên tắc `008-discussions`). Đọc hiện diện và bộ đệm thành viên: Redis lỗi thì bỏ qua bộ đệm và hỏi DB.
- Cấu hình Redis dùng chung với `003-auth` (`volatile-lru`). Kiểm tra dung lượng bộ nhớ khi bật hiện diện (xem ước lượng cuối file).

## Khóa

| Khóa | Kiểu | Giá trị | TTL | Ghi bởi | Mục đích |
| --- | --- | --- | --- | --- | --- |
| `ratelimit:msg:send:user_{userId}` | số đếm | | cửa sổ 60 giây | gửi tin | 60 tin mỗi phút mỗi người |
| `ratelimit:msg:send:conv_{conversationId}:user_{userId}` | số đếm | | 10 giây | gửi tin | 15 tin trong 10 giây trong một hội thoại (chống dồn tin) |
| `ratelimit:msg:newconv:user_{userId}` | số đếm | | 24 giờ | tạo hội thoại mới | 20 hội thoại mới mỗi ngày |
| `ratelimit:msg:attach:user_{userId}` | số đếm | | 1 giờ | tạo tệp đính kèm | 30 tệp mỗi giờ |
| `ratelimit:msg:react:user_{userId}` | số đếm | | 60 giây | thả cảm xúc | 60 lần mỗi phút |
| `ratelimit:msg:report:user_{userId}` | số đếm | | 24 giờ | báo cáo | 20 báo cáo mỗi ngày |
| `ratelimit:msg:search:user_{userId}` | số đếm | | 60 giây | tìm người nhận | 30 lần mỗi phút |
| `ratelimit:msg:read:user_{userId}` | số đếm | | 10 giây | đánh dấu đã đọc | 30 lần mỗi 10 giây (client đã debounce) |
| `ratelimit:msg:typing:conv_{conversationId}:user_{userId}` | chuỗi | | 2 giây | sự kiện typing | một tín hiệu mỗi 2 giây, vượt thì bỏ im lặng |
| `msg:members:{conversationId}` | set | `userId` còn tham gia | 10 phút | gửi tin, typing, nạp từ DB | Kiểm tra thành viên nhanh cho socket; xóa khi đổi thành viên hoặc `declined` |
| `msg:ws:sockets:{userId}` | zset | member = socketId, score = lần ping gần nhất (ms) | 180 giây, gia hạn khi nối | gateway connect/ping/disconnect | Tối đa 5 socket mỗi người; dư thì phát `events:realtime:evict` để các instance đóng socket cũ nhất (4403); mục quá 90 giây không ping bị dọn lúc có socket mới |
| `presence:online:{userId}` | string `1` | | 90 giây, gia hạn mỗi `ping` (25 giây) | gateway | "Đang hoạt động" nếu khóa còn |
| `presence:last:{userId}` | string (ms) | thời điểm gần nhất thấy hoạt động | 30 ngày | gateway (ping, disconnect) | "Hoạt động 9 giờ trước" |
| `msg:unread:{userId}` | hash `inbox`, `requests` | số hội thoại chưa đọc | 5 phút | tính từ DB khi thiếu | Bộ đệm cho `GET /messaging/unread-count`; xóa khi gửi tin tới người đó hoặc khi đọc |

`{userId}`, `{conversationId}` là UUID v7 viết thường, có gạch ngang.

Giới hạn theo người dùng nằm ở khóa riêng, không gộp bằng tiền tố `ratelimit:api:user_` của `003-auth`, vì các ngưỡng khác nhau và để tắt từng cái khi sự cố.

## Kênh Pub/Sub

Mỗi sự kiện là JSON, có `v` (phiên bản), `at` (ms), và danh sách `to` (userId nhận). Mọi instance backend đều đăng ký; instance nào đang giữ socket của người nhận thì phát. Không gửi nội dung vượt 8 KB; tin dài tối đa 2.000 ký tự nên luôn nằm trong giới hạn.

| Kênh | Nội dung | Người nhận |
| --- | --- | --- |
| `events:messaging:message.created` | `{ v, at, to: [userId], conversationId, message: { ...như API } }` | mọi instance; phát `message.created` tới `user:{id}` |
| `events:messaging:message.updated` | `{ v, at, to, conversationId, seq, change: "deleted" \| "hidden" }` | phát `message.updated` |
| `events:messaging:reaction.changed` | `{ v, at, to, conversationId, seq, userId, emoji \| null }` | phát `reaction.changed` |
| `events:messaging:conversation.read` | `{ v, at, to, conversationId, userId, lastReadSeq }` | phát `conversation.read` cho người kia nếu người đọc bật báo đã đọc |
| `events:messaging:conversation.updated` | `{ v, at, to, conversationId, state, reason }` | chấp nhận, từ chối, chặn |
| `events:messaging:typing` | `{ v, at, to, conversationId, userId, active }` | phát `typing`; không lưu |
| `events:messaging:unread` | `{ v, at, to: [userId] }` | phát `unread.changed` để client lấy lại số chưa đọc (khi thiếu bộ đệm thì tính lại) |

Có thêm kênh `events:realtime:evict` (`{ socketIds }`) do gateway dùng chung, không thuộc nhắn tin.

Tên khóa giới hạn thực tế: `ratelimit:msg:{send|sendConversation|newConversation|attach|react|report|search|read}:{phạm vi}`, một script Lua `INCR` + `EXPIRE` nguyên tử.

Pub/Sub không đảm bảo giao: client bù bằng `GET` khi nối lại hoặc khi thấy lỗ hổng `seq`. Sự kiện luôn phát **sau khi** giao dịch DB commit; thứ tự lỗi (đã phát nhưng rollback) bị loại trừ vì phát nằm sau commit; thứ tự ngược (commit rồi mất sự kiện) được bù như trên.

## Ước lượng bộ nhớ (để kiểm lại bằng số đo)

- Hiện diện: hai khóa mỗi người, khoảng 100 byte mỗi khóa kể cả overhead. 100.000 người dùng hoạt động trong 30 ngày ≈ 20 MB. Không đáng lo.
- Bộ đệm thành viên: một set nhỏ mỗi hội thoại có hoạt động trong 10 phút.
- Giới hạn tần suất: vài khóa nhỏ mỗi người đang hoạt động.

## Lệnh trên đường nóng (gửi một tin)

1. `INCR` + `EXPIRE` (một script Lua hoặc `SET NX EX` rồi `INCR`) cho `ratelimit:msg:send:user_*` và `...conv_*`.
2. Sau commit: một `PUBLISH`.
3. Có người nhận: `DEL msg:unread:{userId}` (chạy cùng pipeline với `PUBLISH`).

Không dùng `KEYS` hay `SCAN` trên đường nóng.
