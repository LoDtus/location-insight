# Technical Research — Thông báo thời gian thực

Nguồn tham khảo (đọc ngày 02/11/2026). Đây là ý tưởng thiết kế rút từ các dự án tiêu biểu, **không phải số đo của dự án này**; mọi con số công suất là mục tiêu thiết kế cần đo lại.

- GitHub REST API, [Notifications](https://docs.github.com/en/rest/activity/notifications): mỗi thông báo có `unread`, `last_read_at`; thao tác "đánh dấu đã đọc" nhận mốc thời gian `last_read_at` để chỉ đọc những gì tới **trước** mốc đó. Ta dùng cùng ý với `upToId`.
- Laravel, [Notifications (database channel)](https://laravel.com/docs/notifications): bảng `notifications` mỗi người nhận một dòng, khóa UUID, cột `read_at`, `data` JSON. Là mô hình phổ biến nhất trong hệ sinh thái web (Rails `noticed`, Django `django-notifications-hq` tương tự).
- Novu ([github.com/novuhq/novu](https://github.com/novuhq/novu)) và Knock/Courier: hạ tầng thông báo có "inbox" trong ứng dụng, tùy chọn theo kênh/nhóm, gộp (digest), trạng thái đã xem/đã đọc/đã lưu trữ tách nhau. Ta lấy mô hình tùy chọn theo nhóm và tách `delivery` khỏi `notification`.
- Mastodon ([github.com/mastodon/mastodon](https://github.com/mastodon/mastodon)): thông báo theo từng tài khoản trong PostgreSQL, đẩy realtime qua streaming API, Web Push bằng VAPID, gộp nhiều lượt thích/theo dõi vào một dòng; có nhóm thông báo (grouped notifications) ở bản gần đây.
- Zulip, [Real-time push and events](https://zulip.readthedocs.io/en/latest/subsystems/events-system.html) và [mobile push](https://zulip.readthedocs.io/en/latest/subsystems/notifications.html): quy tắc "chỉ push khi người dùng không đang hoạt động", chờ ngắn trước khi gửi để tránh push trùng với bản đã hiện trong ứng dụng.
- PostgreSQL, [SELECT ... FOR UPDATE SKIP LOCKED](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE): mẫu hàng đợi công việc trong DB.
- IETF: [RFC 8030](https://www.rfc-editor.org/rfc/rfc8030) (Web Push Protocol: `TTL`, `Urgency`, `Topic`), [RFC 8291](https://www.rfc-editor.org/rfc/rfc8291) (mã hóa payload), [RFC 8292](https://www.rfc-editor.org/rfc/rfc8292) (VAPID).
- W3C [Push API](https://www.w3.org/TR/push-api/), [Notifications API](https://notifications.spec.whatwg.org/), MDN [Push API best practices](https://developer.mozilla.org/en-US/docs/Web/API/Push_API/Best_practices).
- Mẫu Chrome [Notifications API sample](https://googlechrome.github.io/samples/pwa-testing/notificationsapi/): minh họa thông báo không bền (trang tạo) và thông báo bền (qua service worker, "SW Show"), tùy chọn `badge`; icon/tiêu đề của thông báo lấy từ manifest khi ứng dụng đã cài. Bàn luận ở bản ghi 2.

---

## Bản ghi quyết định 1 — Mỗi người nhận một dòng (fan-out khi ghi), con trỏ theo UUID v7 <!-- key: decision_record -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** One-way (expensive to reverse)

### Bối cảnh <!-- key: context -->

Hộp thông báo phải đọc nhanh nhất có thể (mỗi lần mở trang, mỗi lần nối lại), trong khi ghi thì chấp nhận tốn hơn. Thông báo cần trạng thái riêng cho từng người (đã đọc, đã xóa).

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Mỗi người một dòng `notifications(user_id, id, …)` (Laravel, GitHub, Mastodon) | PostgreSQL, UUID v7 như 009/012 | Đọc = một truy vấn theo chỉ mục `(user_id, id DESC)`; trạng thái riêng đơn giản | Đổi sang mô hình khác cần di trú dữ liệu | Ghi nhân lên theo số người nhận (với thông báo cá nhân là 1) |
| Một dòng chung + bảng trạng thái đọc theo người (fan-out khi đọc) | Có | Mỗi lần đọc phải join/hợp hai nguồn, khó phân trang đúng | Trung bình | Chỉ đáng với phát sóng cho hàng trăm nghìn người |
| Lưu bên Redis (danh sách theo người) | Có Redis | Dữ liệu mất khi Redis mất, trái nguyên tắc "DB là nguồn sự thật" | Khó | Loại |
| Dịch vụ ngoài (Novu, Knock, OneSignal) | Chưa có | Phụ thuộc nhà cung cấp, dữ liệu rời hệ thống | Khó | Loại ở bản đầu; xem bản ghi 2 cho push |

### Quyết định <!-- key: decision -->

Bảng `notifications` mỗi người nhận một dòng; khóa chính `id` UUID v7 (sắp theo thời gian, dùng làm con trỏ, không cần `created_at` để sắp xếp). Chỉ mục chính `(user_id, id DESC) WHERE deleted_at IS NULL` cho danh sách và chỉ mục một phần `(user_id, id DESC) WHERE read_at IS NULL AND deleted_at IS NULL` cho "Chưa đọc" và đếm. Thông báo phát sóng (giai đoạn 2) vẫn **ghi thành dòng cho từng người nhận theo lô** (fan-out khi ghi, trong job nền), vì số người dùng còn nhỏ; khi vượt khoảng 1 triệu người nhận mỗi đợt, chuyển phát sóng sang fan-out khi đọc (xem `scaling-roadmap.md`, bậc 4). Giao diện không thay đổi giữa hai cách.

### Hệ quả <!-- key: consequences -->

- Trạng thái đọc/xóa riêng từng người, truy vấn đọc đơn giản và có chỉ mục bao phủ.
- Dung lượng tăng theo số dòng; kiểm soát bằng hạn lưu giữ, trần 500 dòng/người và phân vùng theo thời gian ở bậc 2 của roadmap.
- `title`/`subtitle` được dựng và lưu lúc tạo (không dựng lúc đọc): đọc không cần mẫu hay tra cứu, thông báo cũ không đổi khi mẫu đổi. Đổi lại, đa ngôn ngữ sau này cần lưu `params` + `locale` (cột `params` đã dành sẵn).

### Khả năng đảo ngược <!-- key: reversibility -->

Sang fan-out khi đọc cho riêng phát sóng chỉ thêm bảng và nhánh đọc; đổi toàn bộ mô hình là di trú lớn. Vì vậy chốt từ đầu.

---

## Bản ghi quyết định 2 — Kênh đẩy: Web Push chuẩn (Push API + service worker + VAPID), không dùng `new Notification()` làm đường chính <!-- key: decision_record -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** Two-way (cheap to reverse) cho cách gửi; One-way cho khóa VAPID (xem bản ghi 3)

### Bối cảnh <!-- key: context -->

Yêu cầu: thông báo đẩy trên trình duyệt và PWA, cả máy tính và điện thoại, kể cả khi đã đóng tab. Mẫu của Chrome minh họa Notifications API; cần xem đường nào tốt hơn.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| A. Notifications API từ trang (`new Notification()`, như phần "Show" của mẫu Chrome) | Không cần máy chủ | Đơn giản | Dễ | **Chỉ hoạt động khi trang đang mở**; Chrome Android không cho phép `new Notification()` (phải dùng `registration.showNotification`); không có xử lý bấm khi tab đã đóng |
| B. Notifications API qua service worker (`registration.showNotification`, "SW Show" của mẫu Chrome) nhưng kích hoạt từ trang | Có | Đơn giản | Dễ | Bền hơn (hiện ở trung tâm thông báo, có `notificationclick`) nhưng vẫn cần trang/SW đang chạy để biết khi nào hiện |
| C. **Push API + service worker + VAPID** (Web Push, RFC 8030/8291/8292), máy chủ gửi qua dịch vụ push của trình duyệt | Cần thêm worker gửi + thư viện | Chuẩn mở, không phụ thuộc vendor | Dễ đổi thư viện gửi | Hoạt động khi đã đóng tab; Chrome/Edge/Firefox/Safari (macOS 13+, iOS/iPadOS 16.4+ chỉ ứng dụng đã thêm vào Màn hình chính) |
| D. SaaS (OneSignal, FCM SDK, Pusher Beams) | Chưa có | Nhẹ lúc đầu | Khó (khóa nhà cung cấp, dữ liệu rời hệ thống, SDK phía client) | Loại |
| E. Declarative Web Push (Safari 18.4+, định dạng JSON, không cần service worker) | Bổ sung C | Giảm mã SW trên Safari | Dễ bật sau | Còn mới và hẹp; để giai đoạn 2, **kiểm lại tài liệu WebKit hiện hành** trước khi làm |

### Quyết định <!-- key: decision -->

Dùng **C** làm đường chính, kèm phần hiển thị của **B** bên trong service worker khi nhận `push`. **A** chỉ dùng phát hiện hỗ trợ và làm dự phòng (khi không có service worker, ví dụ ngữ cảnh không an toàn): không dùng.
Điểm vượt lên mẫu Chrome:

1. Thông báo tới **khi không có tab** (mẫu chỉ phát từ trang).
2. Mã hóa đầu cuối giữa máy chủ và thiết bị, định danh bằng VAPID, nên dịch vụ push của hãng không đọc được nội dung.
3. Quản lý đăng ký (hạn, 404/410, tối đa số thiết bị), `Topic` để thay vì chồng, `TTL` theo loại, `Urgency` theo loại.
4. Quy tắc "không push khi người dùng đang hoạt động" (bản ghi 9) để tránh trùng với toast và tránh phạt silent push trên Safari.
5. Icon, tiêu đề lấy từ dữ liệu thông báo; khi đã cài PWA, tên và icon ứng dụng theo manifest (đúng với lưu ý của mẫu Chrome).

### Hệ quả <!-- key: consequences -->

- Cần HTTPS (hoặc `localhost`), service worker, quyền thông báo do người dùng cấp bằng thao tác bấm (bắt buộc trên Safari).
- iOS/iPadOS chỉ nhận push khi đã thêm ứng dụng vào Màn hình chính: UI phải hướng dẫn rõ.
- Safari yêu cầu mọi push phải hiển thị thông báo; push không hiển thị liên tiếp có thể làm hủy đăng ký. Service worker **luôn gọi** `showNotification` khi nhận `push`.
- Phải kiểm thử trên Chrome (desktop + Android), Firefox, Safari macOS và iOS PWA; chưa có số liệu của dự án về độ tin cậy.

### Khả năng đảo ngược <!-- key: reversibility -->

Thay thư viện gửi hoặc thêm Declarative Web Push chỉ đổi lớp `PushSender` và payload. API REST và UI không đổi.

---

## Bản ghi quyết định 3 — Thư viện gửi `web-push`, VAPID cố định, mã hóa `aes128gcm` <!-- key: decision_record -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** One-way cho khóa VAPID; Two-way cho thư viện

### Bối cảnh <!-- key: context -->

Cần gửi Web Push từ NestJS. Tự cài RFC 8291 dễ sai về mật mã.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| `web-push` ([web-push-libs/web-push](https://github.com/web-push-libs/web-push)) | Node, phổ biến nhất | Ít mã; phát hành gần nhất 3.6.7, **tốc độ cập nhật chậm**: phải kiểm ngày phát hành trước khi chốt (quy tắc "không dùng thư viện bỏ hoang") | Dễ (bọc sau giao diện) | `aes128gcm` mặc định, VAPID, `TTL`, `urgency`, `topic` |
| Tự cài bằng `node:crypto` (HKDF, ECDH, AES-128-GCM) | Không thêm phụ thuộc | Rủi ro mật mã, nhiều kiểm thử | Trung bình | Chỉ khi `web-push` bị bỏ hoang |
| Thư viện nhỏ dựa trên WebCrypto | Có | Ít người dùng | Dễ | Dự phòng |

### Quyết định <!-- key: decision -->

Dùng `web-push` đằng sau giao diện nội bộ `PushSender.send(subscription, payload, options)`; kiểm `npm audit`, ngày phát hành, số cảnh báo bảo mật trước khi cài; ghim phiên bản chính xác. Một cặp khóa VAPID cho mỗi môi trường, `VAPID_SUBJECT` là `mailto:` của đội. Khóa riêng chỉ ở biến môi trường. Sinh khóa bằng lệnh `npx web-push generate-vapid-keys` (một lần, bên ngoài repo).

### Hệ quả <!-- key: consequences -->

- **Đổi khóa VAPID làm mọi đăng ký hiện có mất hiệu lực** (đăng ký gắn với `applicationServerKey`). Chỉ xoay khóa khi lộ; kế hoạch xoay: gỡ đăng ký cũ, client tự đăng ký lại khi thấy `vapidPublicKey` đổi (client so sánh với giá trị đã dùng).
- Dev, staging và production có khóa riêng để đăng ký dev không bị gửi nhầm từ production.
- Apple yêu cầu `sub` là `mailto:` hoặc `https:` hợp lệ (không dùng `localhost`).

### Khả năng đảo ngược <!-- key: reversibility -->

Đổi thư viện: sửa một lớp. Đổi khóa VAPID: người dùng phải bật lại push.

---

## Bản ghi quyết định 4 — Realtime tới ứng dụng đang mở: dùng lại Socket.IO + Redis Pub/Sub <!-- key: decision_record -->

**Status:** Accepted
**Category:** Cross-Service Pattern
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Đã có `RealtimeGateway` (Socket.IO, vé một lần, phòng `user:{id}`, tối đa 5 socket mỗi người) và quyết định ở `009-messaging/research.md` bản ghi 3.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Dùng lại Socket.IO + Pub/Sub, đồng bộ lại bằng GET khi nối lại | Có sẵn | Không thêm thành phần | Dễ | Pub/Sub "nhiều nhất một lần" nên GET luôn là nguồn sự thật |
| Server-Sent Events riêng cho thông báo | Chưa có | Hai kênh realtime | Dễ | Thêm kết nối thứ hai mỗi tab; loại |
| Thăm dò định kỳ (polling) | Có | Đơn giản | Dễ | Tốn tài nguyên, trễ; chỉ làm dự phòng khi socket không nối được (mỗi 60 giây khi tab hiển thị) |

### Quyết định <!-- key: decision -->

Dùng lại. Kênh `events:notification:*` (xem `redis.md`). Sự kiện nhỏ; client lấy lại dữ liệu đầy đủ bằng GET khi cần. Dự phòng polling 60 giây (chỉ khi socket mất > 30 giây và tab hiển thị, có jitter).

### Hệ quả <!-- key: consequences -->

Mọi sự kiện mang `id`/`v`/`at` để bỏ trùng; client bỏ qua sự kiện cũ hơn trạng thái đã biết. Khi `RealtimeGateway` chuyển sang module `realtime`, chỉ đổi nơi đăng ký.

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ: đổi lớp phát, hợp đồng sự kiện giữ nguyên.

---

## Bản ghi quyết định 5 — Hàng đợi push: bảng `push_outbox` trong PostgreSQL, worker `SKIP LOCKED` <!-- key: decision_record -->

**Status:** Accepted
**Category:** New Architecture Pattern
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Gửi push phải không chặn yêu cầu tạo thông báo, phải thử lại, và không mất khi tiến trình khởi động lại. `012-email` đã có hàng đợi trong DB.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Bảng `push_outbox` + worker `FOR UPDATE SKIP LOCKED` (như email) | Có mẫu | Một mẫu duy nhất cho email và push | Dễ | Ghi cùng giao dịch với dòng thông báo ⇒ không mất, không gửi khi rollback |
| BullMQ trên Redis | Có Redis | Thêm phụ thuộc, hai nguồn sự thật | Trung bình | Dành cho bậc 3 của roadmap |
| Kafka/NATS/SQS | Chưa có | Thêm vận hành | Khó | Ngoài phạm vi |

### Quyết định <!-- key: decision -->

`push_outbox(id, notification_id, user_id, status, attempts, next_attempt_at, …)` ghi **cùng giao dịch** với `notifications`. Worker lấy lô 50 dòng đến hạn, chạy song song tối đa 10 yêu cầu ra ngoài, hết thời gian 10 giây mỗi yêu cầu. Tại thời điểm xử lý (không phải lúc tạo) mới đánh giá "người dùng còn hoạt động không" (`flow-push-decision.mmd`), giống độ trễ ngắn của Zulip: dòng có `not_before = now + 8s` để toast/socket tới trước, nếu người dùng đã đọc dòng trong 8 giây đó thì bỏ gửi.

### Hệ quả <!-- key: consequences -->

- Giao push trễ tối thiểu ~8 giây (đổi lấy ít push thừa). Loại `urgency = high` (bảo mật, thanh toán lỗi) đặt `not_before = now`.
- Bảng `push_outbox` ghi/xóa nhiều: dọn dòng `sent` > 1 ngày, `dead` > 7 ngày; chỉ mục một phần theo `status IN ('queued')`.

### Khả năng đảo ngược <!-- key: reversibility -->

Thay bằng BullMQ chỉ đổi lớp lấy việc; bảng giữ làm nhật ký.

---

## Bản ghi quyết định 6 — Số chưa đọc: truy vấn chặn trên chỉ mục một phần + bộ đệm Redis, không dùng bộ đếm tăng/giảm <!-- key: decision_record -->

**Status:** Accepted
**Category:** Performance & Scale
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Số chưa đọc nằm trên mọi trang (sidebar). Đếm toàn bảng là không thể; bộ đếm tăng/giảm dễ lệch.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| `SELECT count(*) FROM (SELECT 1 … WHERE read_at IS NULL AND deleted_at IS NULL LIMIT 100)` + bộ đệm Redis 5 phút, xóa khi đổi | Cùng cách `msg:unread` của 009 | Không lệch vì luôn có thể tính lại | Dễ | Quét tối đa 100 mục trong chỉ mục một phần ⇒ ổn định theo thời gian |
| Cột `unread_count` trên `users` cập nhật mỗi lần | Có | Hai ghi mỗi thao tác, nóng dòng `users`, dễ lệch | Trung bình | Loại |
| `INCR/DECR` trong Redis | Có | Lệch khi Redis mất/thao tác song song | Trung bình | Loại |

### Quyết định <!-- key: decision -->

Chọn phương án đầu. Khi tạo thông báo: `DEL notif:unread:{userId}` rồi phát `notification.unread` (kèm `count` nếu vừa tính). Hiển thị "99+" khi ≥ 100, nên không cần số chính xác lớn hơn.

### Hệ quả <!-- key: consequences -->

Trần 99 là quyết định hiển thị, ghi vào hợp đồng API (`capped`).

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ: chỉ đổi hàm đếm.

---

## Bản ghi quyết định 7 — Thông báo admin soạn tay/hẹn giờ: chỉ dành chỗ, chưa làm <!-- key: decision_record -->

**Status:** Accepted
**Category:** New Architecture Pattern
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Yêu cầu giai đoạn sau: admin soạn và hẹn giờ. Cần chắc chắn thiết kế hôm nay không chặn tính năng đó.

### Quyết định <!-- key: decision -->

- Giai đoạn 2 thêm `notification_campaigns(id, title, subtitle, link, audience jsonb, scheduled_at, status, created_by, …)` và `notification_campaign_runs`; job quét `scheduled_at <= now()` bằng `SKIP LOCKED`, tạo `notifications` theo lô 1.000 người và ghi `push_outbox`; khóa `dedupe_key = campaign:{id}` bảo đảm chạy lại không trùng. Mọi thao tác ghi `admin_audit_logs`.
- Quyền riêng `notification:manage`; mọi nội dung HTML/Markdown bị cấm; `link` kiểm theo danh sách mẫu như thông báo hệ thống.
- Loại `system.announcement` đã có trong danh mục; `notifications.campaign_id` đã dành trong lược đồ (cột nullable, ghi chú giai đoạn 2).
- Hiệu năng của phát sóng nằm ở `scaling-roadmap.md`.

### Hệ quả <!-- key: consequences -->

Giai đoạn 1 không có UI hay endpoint admin soạn; cột `campaign_id` không có khóa ngoại cho tới khi bảng được tạo.

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ: chưa có mã.

---

## Bản ghi quyết định 8 — Lưu đăng ký push: mã hóa tại chỗ, kiểm endpoint chống SSRF <!-- key: decision_record -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

`endpoint` là một URL do máy khách cung cấp mà **máy chủ sẽ gọi** (SSRF), đồng thời là "thông tin cho phép" gửi push tới người dùng; `p256dh` và `auth` là khóa mã hóa.

### Quyết định <!-- key: decision -->

- Chỉ chấp nhận `https:`; host phải thuộc danh sách hậu tố cho phép của dịch vụ push (cấu hình, mặc định: `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `push.services.mozilla.com`, `web.push.apple.com`, `*.notify.windows.com`); cổng 443; không theo chuyển hướng; phân giải DNS rồi chặn IP riêng/loopback/link-local; thời gian chờ 10 giây.
- Lưu `endpoint_hash = sha256(endpoint)` (duy nhất, để tra cứu) và `endpoint_enc`, `keys_enc` bằng AES-256-GCM với khóa `NOTIFICATION_PUSH_ENC_KEY` (theo `.cursor/rules/security.md`). Khóa không đi vào log.
- **Gắn với thiết bị (đã chốt với chủ dự án):** `device_id` do client sinh một lần. Đăng xuất/thu hồi phiên/đổi mật khẩu **tạm ngưng** (không xóa) để thiết bị dùng chung không lộ thông báo, còn thiết bị cá nhân bật lại ngay khi đăng nhập lại. `last_seen_at` quá 60 ngày thì tạm ngưng. Lý do: PWA cài lâu dài không bị bắt bật push lại sau mỗi đăng nhập; mất an toàn thiết bị dùng chung được giảm bằng tạm ngưng + chuyển chủ sở hữu.
- Một thiết bị đăng ký lại cùng `endpoint` cập nhật dòng cũ, không tạo thêm. Endpoint đã thuộc người dùng khác (thiết bị dùng chung) chuyển quyền sở hữu sang người vừa đăng ký và xóa liên kết cũ.

### Hệ quả <!-- key: consequences -->

Thêm một bước giải mã mỗi lần gửi (rẻ). Xoay `NOTIFICATION_PUSH_ENC_KEY` cần dữ liệu mang `key_version`.

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ.

---

## Bản ghi quyết định 9 — Khi nào gửi push: chỉ khi không có tab đang hoạt động <!-- key: decision_record -->

**Status:** Accepted
**Category:** Cross-Service Pattern
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Gửi push khi người dùng đang xem ứng dụng gây trùng (toast + hệ điều hành). Không thể "nuốt" push ở service worker một cách an toàn trên Safari (phạt push không hiển thị); trên Chrome được phép nếu có cửa sổ đang hiển thị.

### Quyết định <!-- key: decision -->

Quyết định ở **máy chủ**: client gửi tín hiệu `presence.visible {visible}` qua socket khi `visibilitychange`/`focus` và mỗi 25 giây cùng `ping` khi hiển thị. Gateway ghi `notif:active:{userId}` (TTL 45 giây). Worker bỏ gửi nếu khóa còn tại thời điểm xử lý. Service worker **luôn hiển thị** thông báo khi nhận push (không có nhánh nuốt). Hạn chế: người dùng vừa đóng tab có thể nhận một push dù đã thấy toast; chấp nhận được.

### Hệ quả <!-- key: consequences -->

Cần giữ khóa mỗi người dùng đang hiển thị, nhỏ (xem `redis.md`). Không dựa vào tín hiệu của service worker `clients.matchAll` (đáng tin cậy kém hơn và không thể dùng trên Safari).

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ.

---

## Hiệu năng — phân tích bắt buộc <!-- key: performance -->

**Đường nóng và chi phí mỗi thao tác (mục tiêu thiết kế):**

| Thao tác | Truy vấn | Chỉ mục | Ghi chú |
| --- | --- | --- | --- |
| Mở trang / tải lại | 1 × `SELECT … WHERE user_id=$1 AND deleted_at IS NULL AND id < $cursor ORDER BY id DESC LIMIT 21` | `(user_id, id DESC) WHERE deleted_at IS NULL` | Không `OFFSET`, không `COUNT`, lấy 21 để biết còn trang sau |
| Số chưa đọc | 1 × quét ≤ 100 mục (hoặc đọc Redis) | chỉ mục một phần "chưa đọc" | Bộ đệm 5 phút, xóa khi đổi |
| Đọc một dòng | 1 × `UPDATE … WHERE id=$1 AND user_id=$2 AND read_at IS NULL` | khóa chính | Idempotent |
| Đọc tất cả | 1 × `UPDATE … WHERE user_id=$1 AND read_at IS NULL AND id <= $2` | chỉ mục "chưa đọc" | ≤ 500 dòng/người nhờ trần |
| Tạo thông báo | 1 × `INSERT` (+1 `INSERT push_outbox` nếu có push) cùng giao dịch | khóa chính, `(user_id, dedupe_key)` | Gộp bằng `UPDATE` theo `(user_id, collapse_key)` chỉ mục một phần |
| Phát realtime | 1 × `PUBLISH` Redis | — | Sau commit |

**Nguyên tắc:** payload sự kiện nhỏ (≤ 1 KB), danh sách chỉ lấy cột cần dùng, không `SELECT *`; client giữ lạc quan (cập nhật UI trước, hoàn tác khi lỗi); gộp (debounce) nhiều lần "đọc" liên tiếp thành một lô `POST /notifications/read-batch` (≤ 50 id) mỗi 500 ms; danh sách cuộn vô hạn **cắt** (virtualize/giới hạn 200 mục trong DOM) để không phình bộ nhớ; không tải lại danh sách khi có sự kiện, chỉ ghép dòng mới.

**Kích thước và dung lượng (ước lượng thô, cần đo lại):** một dòng ≈ 400–600 byte kể cả chỉ mục ⇒ 50 triệu dòng ≈ 25 GB. Hạn lưu giữ và trần 500 dòng/người là điều kiện để con số này không tăng vô hạn.

**Điều cần đo trước khi coi là đạt:** p95 `GET /notifications` < 50 ms với 500 dòng/người trên bảng 10 triệu dòng; thời gian tạo→socket < 1 giây p95; thông lượng worker push ≥ 200 push/giây/instance; độ sâu `push_outbox` không tăng khi tải ổn định. Kiểm bằng `EXPLAIN (ANALYZE, BUFFERS)` và kịch bản k6.
