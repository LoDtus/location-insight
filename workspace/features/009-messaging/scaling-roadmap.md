# Lộ trình mở rộng — Nhắn tin (009-messaging)

Mục đích: bản đầu chạy gọn (PostgreSQL + Redis + MinIO + backend NestJS), nhưng mỗi bậc sau có sẵn chỗ nối mà không đổi API công khai, không đổi khóa chính bảng tin, không đổi hợp đồng sự kiện.

Các con số trong tài liệu này là **mục tiêu thiết kế và ước lượng**, chưa đo trên hệ thống này. Mỗi lần chuyển bậc phải dựa trên số đo (mục "Dấu hiệu chuyển bậc") và kiểm bằng load test.

Tham khảo: [Discord](https://discord.com/blog/how-discord-stores-trillions-of-messages) (khóa theo kênh, partition nóng), [Zulip](https://zulip.readthedocs.io/en/latest/subsystems/events-system.html) (hàng đợi sự kiện theo client, `last_event_id`, tách máy chủ giữ kết nối dài), [Mattermost](https://docs.mattermost.com/administration-guide/scale/server-architecture.html) (node không giữ trạng thái, DB ghi/đọc tách), [Socket.IO Redis adapter](https://socket.io/docs/v4/redis-adapter/) (sharded Pub/Sub).

## Bước 0 — Việc phải làm ngay trước khi mở tính năng

Đã có trong hạ tầng realtime của 003-auth nhưng không chịu được tải nhắn tin:

| Việc | Lý do |
| --- | --- |
| `recheck` 60 giây: gom socket theo `sid`, kiểm bằng một `pipeline` Redis | Hiện gọi `EXISTS` tuần tự cho từng socket; 5.000 socket = 5.000 vòng mạng mỗi phút trong một vòng lặp |
| Đặt `transports: ['websocket']`, `maxHttpBufferSize: 16 * 1024`, `pingInterval`/`pingTimeout` có chủ ý | Không cần sticky session; chặn gói lớn |
| Siết `cors.origin` thành danh sách và kiểm `Origin` | Xem threat model E4 |
| Giới hạn socket mỗi người (5) và sự kiện mỗi giây mỗi socket | D3, D4 |
| Phòng `user:{id}` chỉ do máy chủ gán | Đã đúng; giữ |
| Số liệu: số socket đang mở, độ trễ phát (thời điểm commit → thời điểm emit), số sự kiện bỏ qua, thời gian recheck | Không có số đo thì không biết lúc nào lên bậc |

## Bậc 1 — Bản đầu (mục tiêu: ~5.000 kết nối đồng thời, ~50 tin/giây)

```
Client ──HTTPS──▶ Nginx/Proxy ──▶ Backend (2+ instance, NestJS)
Client ◀─WSS────┘                    │  REST + Socket.IO trong cùng tiến trình
                                     ├──▶ PostgreSQL (1 primary)
                                     ├──▶ Redis (Pub/Sub + giới hạn + hiện diện)
                                     └──▶ MinIO (ảnh)
```

- REST ghi → commit → `PUBLISH` → mọi instance phát cho socket mình giữ.
- Không sticky session (chỉ websocket).
- Một Redis đủ; theo dõi CPU và băng thông Pub/Sub (mỗi sự kiện được gửi tới **mọi** instance, kể cả instance không có người nhận; ở số instance nhỏ thì chấp nhận).
- Hội thoại 1-1, `messages` một bảng.

**Dấu hiệu chuyển lên bậc 2** (một trong):

- CPU của tiến trình API bị chi phối bởi việc phát socket (không phải truy vấn).
- Số socket mỗi instance vượt ~60% mức đã load-test.
- Deploy API làm rớt nhiều kết nối cùng lúc gây bão kết nối lại.
- Băng thông Pub/Sub trên Redis > ~30% giới hạn mạng của máy Redis.

## Bậc 2 — Tách lớp kết nối, giảm khuếch tán sự kiện (~50.000 kết nối, ~500 tin/giây)

Thay đổi:

1. **Tiến trình realtime riêng**: cùng mã nguồn, chạy với `APP_ROLE=realtime` (chỉ nạp gateway và bộ đăng ký sự kiện), tách khỏi `APP_ROLE=api`. Lý do giống Zulip tách Tornado giữ kết nối dài khỏi Django: vòng đời kết nối dài và vòng đời request ngắn khác nhau, deploy API không làm rớt socket.
2. **Redis sharded Pub/Sub** (Redis 7+, `@socket.io/redis-adapter` `createShardedAdapter`, ioredis `shardedSubscribers: true`): tài liệu Socket.IO khuyến nghị cho dự án mới. Định tuyến theo `userId` để mỗi người thuộc một slot.
3. **Đọc từ bản sao** (read replica) cho `GET messages` và hộp thư với độ trễ chấp nhận được; ghi và `last_seq` luôn trên primary. Cần xử lý "đọc ngay sau khi ghi": phản hồi `POST` đã chứa tin; `GET after_seq` sau reconnect có thể đọc replica với `after_seq` khớp `lastSeq` từ primary hoặc fallback.
4. **Outbox giao dịch**: ghi một dòng `message_outbox` trong cùng giao dịch gửi tin, một worker đọc và `PUBLISH`. Sửa lỗi hiếm "commit xong, tiến trình chết trước khi PUBLISH" thay vì dựa vào client đồng bộ lại. Dùng chung cho thông báo đẩy ở bậc này.
5. **Thông báo ngoài ứng dụng** (push, email khi chưa đọc 15 phút) chạy từ outbox; tôn trọng `muted_until`.
6. **Hàng đợi** (Redis Streams hoặc BullMQ nếu đã dùng ở nơi khác) cho job dọn tệp, đối soát, gửi thông báo. Không bắt buộc thêm Kafka/NATS.
7. **Redis Streams theo người dùng** thay Pub/Sub nếu cần đảm bảo giao: mỗi người một stream ngắn (giữ ~100 sự kiện hoặc 5 phút), client gửi `lastEventId` khi nối lại như Zulip. Chỉ làm khi số đo cho thấy việc đồng bộ lại bằng REST gây tải đáng kể.

Hợp đồng sự kiện (`socket-api.yml`) và API REST giữ nguyên; `v` cho phép thêm trường.

**Dấu hiệu chuyển lên bậc 3**:

- `messages` vượt ~200 triệu dòng hoặc chỉ mục không còn nằm trong RAM của primary.
- Ghi tin chạm trần IOPS hoặc độ trễ giao dịch gửi p95 > 150 ms kéo dài.
- Cần nhóm lớn (hàng trăm người) hoặc kênh phát cho số đông.

## Bậc 3 — Dữ liệu lớn và nhóm lớn (hàng trăm nghìn kết nối, nghìn tin/giây)

Thay đổi:

1. **Hash partition `messages`, `message_attachments`, `message_reactions` theo `conversation_id`** (16–64 partition). Khóa chính và truy vấn không đổi (xem `data-review.md`). Cách này khớp Discord: dữ liệu khóa theo kênh. Phân vùng theo thời gian chỉ dùng cho kho lưu trữ lạnh.
2. **Lưu trữ lạnh**: tin cũ hơn N tháng chuyển sang bảng/phân vùng rẻ hơn; API vẫn cùng `before_seq`.
3. **Con trỏ đã đọc kiểu "tính theo yêu cầu" cho nhóm lớn**: bỏ cập nhật mỗi người mỗi tin; chỉ cập nhật `last_read_seq` khi người đọc, tính chưa đọc bằng so với `last_seq` khi hiển thị; phát sự kiện nhóm theo phòng hội thoại thay vì từng người.
4. **Cấp `seq` không dùng khóa dòng** cho hội thoại rất sôi động: bộ đếm trong Redis (`INCR`) có ghi nhật ký, hoặc khối `seq` cấp phát theo lô. Chỉ áp dụng cho nhóm lớn; 1-1 giữ nguyên.
5. **Cơ sở dữ liệu tách theo hàng (Citus) hoặc kho cột rộng** (Cassandra/ScyllaDB) cho `messages`, nếu một primary PostgreSQL không còn đủ. Discord khóa theo `(channel_id, bucket)` và chuyển Cassandra sang ScyllaDB vì partition nóng; ta tránh được một phần nhờ giới hạn kích thước hội thoại. Quyết định này là một chiều: cần một bản ghi quyết định mới trong `research.md` và load test trước.
6. **Dịch vụ hiện diện riêng** (Redis cụm riêng hoặc dịch vụ) và **tìm kiếm tin** bằng Elasticsearch (đã có trong stack) với chỉ mục theo thành viên; cân nhắc quyền riêng tư (chỉ chỉ mục tin của chính người tìm).
7. **Nhiều vùng**: Mattermost xác nhận HA nhiều trung tâm dữ liệu không được hỗ trợ trong cụm của họ; với ta, nhiều vùng là bài toán dữ liệu riêng, chỉ làm khi có yêu cầu độ trễ thực.

## Những thứ cố ý không làm ở bản đầu (và lý do)

| Không làm | Lý do | Khi nào xét lại |
| --- | --- | --- |
| Kafka, NATS, RabbitMQ | Thêm dịch vụ vận hành; Redis Pub/Sub + đồng bộ REST đủ | Bậc 3, hoặc khi cần xử lý sự kiện nhiều bên tiêu thụ |
| Microservice tin nhắn riêng | Một người vận hành, cùng mô hình dữ liệu người dùng | Bậc 3 nếu có đội riêng |
| Cassandra/ScyllaDB | PostgreSQL đủ cho vài trăm triệu dòng nếu khóa theo hội thoại | Bậc 3, có số đo |
| E2EE | Mâu thuẫn kiểm duyệt, tìm kiếm, đa thiết bị | Nếu pháp lý hoặc thị trường yêu cầu |
| Socket ghi tin | Một đường ghi là đủ | Khi độ trễ gửi trở thành vấn đề đo được |
| Phát hiện diện qua socket tới mọi người | Bão sự kiện; client hỏi theo hội thoại đang mở | Chỉ khi có nhu cầu sản phẩm và đã có dịch vụ hiện diện |

## Kiểm tra tải trước mỗi bậc

- Công cụ: k6 hoặc Artillery với kịch bản WebSocket + REST.
- Kịch bản: (1) N socket nghỉ, (2) 1% người gửi 1 tin/10 giây, (3) bão kết nối lại sau khi restart một instance, (4) một hội thoại bị gửi dồn, (5) Redis chậm 200 ms.
- Chỉ số chấp nhận: độ trễ commit → emit p95 < 500 ms; không mất tin sau khi đồng bộ lại; không tăng lỗi 5xx ở route khác.
