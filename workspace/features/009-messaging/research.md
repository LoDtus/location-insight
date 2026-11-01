# Technical Research — Nhắn tin trực tiếp thời gian thực

Nguồn tham khảo đã đọc (kiểm tra ngày 02/11/2026):

- Discord, [How Discord Stores Trillions of Messages](https://discord.com/blog/how-discord-stores-trillions-of-messages): tin nhắn khóa theo kênh cộng một "bucket" thời gian để giới hạn cỡ partition; `message_id` sắp theo thời gian làm khóa sắp xếp; partition nóng trên một kênh làm chậm cả cụm; chuyển Cassandra (177 node) sang ScyllaDB (72 node).
- Zulip, [Real-time push and events](https://zulip.readthedocs.io/en/latest/subsystems/events-system.html): mỗi client có một hàng đợi sự kiện; client báo `last_event_id` để máy chủ xóa sự kiện đã nhận; heartbeat khoảng 45 giây; hàng đợi mất thì client tải lại; máy chủ giữ kết nối dài tách khỏi ứng dụng chính.
- Mattermost, [Deployment Architecture at Scale](https://docs.mattermost.com/administration-guide/scale/server-architecture.html): node ứng dụng gần như không giữ trạng thái, nhiều node sau load balancer, đồng bộ trạng thái giữa node qua giao thức cụm, một DB ghi và nhiều DB đọc, Elasticsearch cho tìm kiếm.
- Socket.IO, [Redis adapter](https://socket.io/docs/v4/redis-adapter/) và [Connection state recovery](https://socket.io/docs/v4/connection-state-recovery): có `createShardedAdapter` (Redis 7+, khuyến nghị cho dự án mới); cần sticky session nếu còn dùng long-polling; Redis adapter **không** hỗ trợ khôi phục trạng thái kết nối; tài liệu khuyên không dựa vào khôi phục kết nối mà phải có đường đồng bộ lại.

Không có nguồn nào ở đây là số đo của dự án này. Mọi con số công suất trong bộ tài liệu là mục tiêu thiết kế.

---

## Bản ghi quyết định 1 — Ghi qua REST, phát qua WebSocket <!-- key: decision_record -->

**Status:** Accepted
**Category:** Cross-Service Pattern
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Gửi tin có thể đi qua socket (`socket.emit('send')`) hoặc qua HTTP. Dự án đã có Socket.IO nhưng mọi kiểm tra quyền, giới hạn tần suất, ghi đĩa đều đã nằm ở REST (guard, throttle, validation).

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Ghi qua REST `POST`, máy chủ phát sự kiện sau khi commit | Dùng lại guard, DTO, throttler, lỗi chuẩn, OpenAPI | Một đường ghi, dễ kiểm thử bằng supertest | Dễ thêm đường ghi qua socket sau | Giống Zulip và Mattermost: ghi bằng REST, nhận bằng sự kiện |
| Ghi qua `socket.emit` có ack | Phải làm lại validation, quyền, giới hạn cho socket | Hai đường vào dễ lệch | Trung bình | Lợi ích độ trễ nhỏ, không đáng ở bản đầu |
| Ghi qua hàng đợi, trả 202 | Chưa có hàng đợi | Thêm vận hành | Khó | Dành cho giai đoạn sau |

### Quyết định <!-- key: decision -->

`POST /messaging/conversations/{id}/messages` là đường ghi duy nhất, có `clientMsgId` để idempotent. Sau khi giao dịch commit, backend `PUBLISH` sự kiện, mọi instance đẩy tới phòng `user:{id}` của người tham gia. Tín hiệu tạm (đang gõ) đi qua socket vì không cần lưu.

### Hệ quả <!-- key: consequences -->

Một lần gửi tốn thêm một vòng HTTP so với socket (vài ms trong cùng khu vực). Đổi lại, tin không bao giờ vào DB mà không qua guard. Client phải xử lý hai kênh: phản hồi HTTP của chính mình và sự kiện của socket (dedupe theo `clientMsgId` và `seq`).

### Khả năng đảo ngược <!-- key: reversibility -->

Thêm đường gửi qua socket chỉ cần gọi cùng service. Không đổi schema.

---

## Bản ghi quyết định 2 — Thứ tự tin bằng `seq` theo hội thoại, khóa chính theo hội thoại <!-- key: decision_record -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** One-way (expensive to reverse)

### Bối cảnh <!-- key: context -->

Cần thứ tự ổn định, phân trang không lệch, phát hiện mất tin sau khi rớt mạng, và khóa dữ liệu không phải đổi khi bảng lớn. Discord khóa theo kênh và dùng id sắp theo thời gian; Zulip dùng `last_event_id` để biết đã nhận tới đâu.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| `seq` bigint tăng dần trong từng hội thoại, khóa chính `(conversation_id, seq)`, `id` UUID v7 để công khai | Quy ước UUID v7 vẫn giữ cho id công khai | Phân trang `beforeSeq` / `afterSeq` đơn giản; phát hiện lỗ hổng bằng so số | Đổi khóa chính bảng lớn sau này rất tốn | Khớp hash partition theo `conversation_id`; tăng `seq` trong giao dịch tuần tự hóa theo hội thoại, đủ cho 1-1 |
| Chỉ UUID v7 làm khóa chính, sắp theo id | Giống các bảng khác | Không phát hiện được lỗ hổng; cursor theo thời gian dễ lệch khi hai tin cùng mili giây | Dễ | Không có thứ tự toàn phần trong một hội thoại |
| Snowflake 64 bit toàn cục như Discord | Cần dịch vụ cấp id hoặc bố trí worker id | Thêm khái niệm vận hành | Khó | Không cần ở quy mô này |

### Quyết định <!-- key: decision -->

`conversations.last_seq` tăng bằng `UPDATE ... SET last_seq = last_seq + 1 RETURNING` trong cùng giao dịch với dòng tin. Khóa dòng này tuần tự hóa các tin cùng hội thoại, không ảnh hưởng hội thoại khác. Khóa chính bảng `messages` là `(conversation_id, seq)`. Tin có thêm `id` UUID v7 duy nhất trong hội thoại để dùng ở URL và tham chiếu. Mọi truy vấn tin luôn kèm `conversation_id`.

### Hệ quả <!-- key: consequences -->

- Một hội thoại rất sôi nổi (nhóm lớn sau này) sẽ nghẽn trên khóa dòng này; 1-1 thì không. Khi mở nhóm lớn phải đổi cách cấp `seq` (xem roadmap, bậc 3).
- Client lưu `lastSeq` mỗi hội thoại và biết khi nào có lỗ hổng (`seq` nhảy cách).
- Hash partition theo `conversation_id` sau này không cần đổi khóa.

### Khả năng đảo ngược <!-- key: reversibility -->

Đổi khóa chính bảng đã có hàng trăm triệu dòng cần di trú ngoài giờ cao điểm. Vì vậy quyết định là một chiều và được chốt ngay từ đầu.

---

## Bản ghi quyết định 3 — Dùng lại Socket.IO và Redis Pub/Sub, đồng bộ lại bằng REST thay vì khôi phục kết nối <!-- key: decision_record -->

**Status:** Accepted
**Category:** New Architecture Pattern
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Redis Pub/Sub chỉ giao "nhiều nhất một lần". Redis adapter của Socket.IO không khôi phục gói bị lỡ. Zulip giải bằng hàng đợi sự kiện theo client; Mattermost giữ trạng thái ở DB và để client tải lại.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Sự kiện qua Pub/Sub, client đồng bộ lại bằng `GET` khi nối lại hoặc thấy lỗ hổng `seq` | Đã có Pub/Sub và Socket.IO trong `RealtimeGateway` | Không thêm thành phần; DB là nguồn sự thật | Dễ thêm Streams sau | Mất tối đa vài sự kiện rồi tự lành |
| Redis Streams làm nhật ký sự kiện theo người dùng, client gửi `lastEventId` như Zulip | Cần thêm adapter hoặc tự cài | Thêm trạng thái trong Redis, hạn bộ nhớ | Trung bình | Chọn khi lượng kết nối lớn hoặc cần đảm bảo giao |
| Dịch vụ hàng đợi (NATS, Kafka) | Chưa có | Thêm vận hành | Khó | Ngoài phạm vi bản đầu |

### Quyết định <!-- key: decision -->

Giữ mô hình hiện có: kênh `events:messaging:*`, mỗi instance tự phát tới phòng `user:{id}` của mình. Mọi sự kiện mang `conversationId` và `seq`. Khi socket nối lại hoặc client thấy lỗ hổng: tải `GET /messaging/conversations` và `GET .../messages?afterSeq=`. Không bật `connectionStateRecovery`.

Phát bằng `emit` tới phòng thay vì dùng Redis adapter, vì mỗi instance đã tự đăng ký kênh. Chuyển sang `@socket.io/redis-adapter` (sharded) khi cần hoặc khi nhiều module cùng phát (xem roadmap).

### Hệ quả <!-- key: consequences -->

Sự kiện không phải nguồn sự thật. Client luôn coi `GET` là đúng. Cần tải kiểm thử mô phỏng mất sự kiện. Sticky session chỉ bắt buộc nếu cho phép long-polling; ta đặt `transports: ['websocket']` để không cần.

### Khả năng đảo ngược <!-- key: reversibility -->

Thay Pub/Sub bằng Streams chỉ đổi lớp phát; hợp đồng sự kiện và API giữ nguyên.

---

## Bản ghi quyết định 4 — Hội thoại tổng quát (`conversations` + `participants`) nhưng chỉ mở 1-1 <!-- key: decision_record -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** One-way (expensive to reverse)

### Bối cảnh <!-- key: context -->

Chỉ cần 1-1 ngay. Nhưng nếu lưu hai cột `user_a`, `user_b` trên hội thoại thì thêm nhóm sau phải viết lại bảng tin, chỉ mục và truy vấn đọc của hộp thư.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| `conversations` + `conversation_participants`, `type` direct/group, chỉ API 1-1 | Quan hệ nhiều-nhiều chuẩn | Thêm một bảng; đọc hộp thư qua participants | Thêm nhóm không đổi schema | Con trỏ đã đọc, tắt thông báo, xóa phía mình nằm ở participants |
| Hai cột `user_a`, `user_b` | Đơn giản nhất | Ít bảng nhất | Phải viết lại khi thêm nhóm | Đọc hộp thư cần `OR` hai cột, khó dùng chỉ mục |

### Quyết định <!-- key: decision -->

Dùng participants. Hội thoại 1-1 có `direct_key = min(userId):max(userId)` duy nhất để tránh trùng khi hai người cùng tạo một lúc.

### Hệ quả <!-- key: consequences -->

Mỗi tin cập nhật một dòng participants cho mỗi người nhận (hai dòng với 1-1). Với nhóm lớn (hàng trăm người) phải bỏ cách cập nhật từng dòng: dùng con trỏ tính theo yêu cầu (xem roadmap, bậc 3).

### Khả năng đảo ngược <!-- key: reversibility -->

Gộp về hai cột là có thể nhưng không có lý do.

---

## Bản ghi quyết định 5 — Mã hóa: TLS và mã hóa đĩa, chưa mã hóa đầu cuối <!-- key: decision_record -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** Two-way (cheap to reverse) cho mã hóa cột; One-way cho E2EE

### Bối cảnh <!-- key: context -->

Tin riêng tư là dữ liệu cá nhân. Mã hóa đầu cuối chặn được admin và máy chủ đọc tin, nhưng cũng chặn kiểm duyệt, tìm kiếm, đồng bộ nhiều thiết bị và phải có quản lý khóa phức tạp. Sản phẩm là sàn bất động sản, cần xử lý lừa đảo.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| TLS + mã hóa đĩa/volume DB, admin chỉ xem tin bị báo cáo | Khớp `security.md` | Thấp chi phí | Thêm mã hóa cột AES-256-GCM sau được | Chọn |
| Mã hóa cột AES-256-GCM ở tầng ứng dụng ngay | Cần quản lý khóa, xoay khóa | Thêm độ phức tạp, không chặn được người có quyền chạy ứng dụng | Dễ bật sau | Để giai đoạn 2 nếu pháp lý yêu cầu |
| E2EE (Signal protocol) | Không | Rất cao | Rất khó | Ngoài phạm vi |

### Quyết định <!-- key: decision -->

TLS khi truyền, mã hóa đĩa ở tầng hạ tầng. Truy cập của admin giới hạn ở tin bị báo cáo: tại thời điểm báo cáo, hệ thống chụp tin đó và tối đa 10 tin quanh nó vào bản ghi báo cáo; admin không có API đọc hội thoại tùy ý.

### Hệ quả <!-- key: consequences -->

Phải nói rõ trong điều khoản và giao diện: tin không mã hóa đầu cuối; tin bị báo cáo có thể được người vận hành xem. Cần cập nhật `005-legal`.

### Khả năng đảo ngược <!-- key: reversibility -->

Bật mã hóa cột: thêm cột `body_enc` và di trú. E2EE: thiết kế lại toàn bộ.
