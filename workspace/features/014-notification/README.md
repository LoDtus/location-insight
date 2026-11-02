# Thông báo thời gian thực (Notification)

**Feature ID:** 014-notification
**Status:** Draft
**Last Updated:** 2026-11-02

## Tổng quan <!-- key: overview -->

Người dùng và admin có tab **Thông báo** ở sidebar trái (`/app/notification`, `/admin/notification`). Mỗi thông báo là một dòng có icon, tiêu đề, phụ đề, thời điểm, trạng thái đã đọc và một đường dẫn tới đúng đối tượng liên quan. Thông báo mới tới ngay qua WebSocket sẵn có; khi người dùng không mở ứng dụng, hệ thống gửi **Web Push** tới trình duyệt và PWA (xem `015-pwa`). Giai đoạn này chỉ làm thông báo do hệ thống phát sinh khi có hành động; thông báo admin soạn tay và hẹn giờ được thiết kế chỗ chứa nhưng chưa phát triển.

## Mục tiêu & Phạm vi <!-- key: goals_scope -->

**In scope (giai đoạn 1):**

- Hộp thông báo cá nhân: danh sách phân trang con trỏ, lọc "Tất cả / Chưa đọc", xem tiếp khi cuộn.
- Thao tác: đánh dấu đã đọc một dòng, đánh dấu đã đọc tất cả, xóa một dòng, bấm vào dòng để tới đúng mục tiêu (và tự đánh dấu đã đọc).
- Huy hiệu số chưa đọc ở sidebar, tiêu đề tab và biểu tượng ứng dụng (App Badging API khi có).
- Realtime: `notification.created`, `notification.changed` (đồng bộ nhiều tab/thiết bị), `notification.unread`.
- Web Push tới trình duyệt và PWA: đăng ký/hủy đăng ký theo từng thiết bị, gửi khi người dùng không đang hoạt động, bấm vào thông báo mở đúng đường dẫn.
- Tùy chọn của người dùng theo nhóm thông báo (trong ứng dụng, push), bật/tắt push theo thiết bị, ẩn nội dung trên màn hình khóa.
- Danh mục loại thông báo mở rộng được (`§Danh mục loại`), API nội bộ `NotificationsService.notify()` cho các module khác gọi.
- Dọn dẹp theo hạn lưu giữ; giới hạn tần suất; nhật ký giao push.

**Out of scope (chưa phát triển, nhưng thiết kế chỗ chứa):**

- Admin soạn tay, hẹn giờ, nhắm theo nhóm người dùng (`notification_campaigns`, quyền `notification:manage`, xem `postgresql.dbml` phần "Giai đoạn 2" và `research.md` bản ghi 7).
- Giờ yên tĩnh (quiet hours), tóm tắt (digest) định kỳ, thông báo đa ngôn ngữ theo `locale` của người nhận.
- Nút hành động trong thông báo hệ điều hành (`actions`), Declarative Web Push (xem `015-pwa/research.md`).
- Kênh SMS, Zalo, ứng dụng native (APNs/FCM trực tiếp). Email giữ nguyên ở `012-email`.
- Thông báo cho khách chưa đăng nhập.

## Đối tượng liên quan <!-- key: actors -->

- Người dùng đã đăng nhập (`/app/notification`): xem, đọc, xóa, cấu hình.
- Admin (`/admin/notification`): cùng hộp thư **cá nhân** của chính mình (ví dụ có báo cáo mới, phản hồi mới, lệch đối soát). Không đọc thông báo của người khác. Giai đoạn 2: soạn và hẹn giờ.
- Module nghiệp vụ (follow, discussions, billing, feedback, messaging, auth…): bên sinh sự kiện, gọi `NotificationsService.notify()`.
- Hệ thống: worker gửi push, job dọn dẹp, cổng realtime.
- Dịch vụ push của trình duyệt (FCM, Mozilla autopush, Apple, WNS): chỉ nhận bản đã mã hóa.

## Yêu cầu chức năng <!-- key: functional_requirements -->

- **FR-01 (danh sách):** `GET /notifications?limit=&cursor=&filter=all|unread` trả thông báo của mình, mới nhất trước, phân trang con trỏ theo `id` (UUID v7 sắp theo thời gian). `limit` mặc định 20, tối đa 50. Không có `offset`, không có `COUNT(*)` toàn bảng.
- **FR-02 (một dòng):** mỗi dòng gồm `id`, `type`, `icon` (khóa từ danh sách cho phép), `tone` (`neutral|info|success|warning|danger`), `title` (≤ 120), `subtitle` (≤ 200, có thể rỗng), `createdAt`, `readAt` (hoặc `null`), `link` (đường dẫn tương đối trong ứng dụng), `count` (số lần gộp, ≥ 1).
- **FR-03 (số chưa đọc):** `GET /notifications/unread-count` trả `{ count, capped }`, chặn ở 99 (`capped = true` khi ≥ 100). Dùng bộ đệm Redis; mất bộ đệm thì tính lại bằng truy vấn giới hạn 100 dòng.
- **FR-04 (đọc một dòng):** `PUT /notifications/{id}/read` đặt `read_at` nếu chưa có; gọi lặp không lỗi. Có `PUT /notifications/{id}/unread` để bỏ đọc.
- **FR-05 (đọc tất cả):** `POST /notifications/read-all` với `upToId` tùy chọn. Chỉ đánh dấu các dòng có `id ≤ upToId` để thông báo vừa tới trong lúc gọi không bị đọc nhầm. Không có `upToId` thì dùng `id` mới nhất lúc nhận yêu cầu.
- **FR-06 (xóa):** `DELETE /notifications/{id}` ẩn dòng của mình (xóa mềm). Gọi lặp trả 204. Xóa dòng chưa đọc làm giảm số chưa đọc.
- **FR-07 (mục tiêu):** mỗi dòng có `link`. Bấm vào dòng: điều hướng tới `link` trong cùng cửa sổ và gọi đánh dấu đã đọc. `link` luôn là đường dẫn tương đối bắt đầu bằng `/app/` hoặc `/admin/`, kiểm theo danh sách mẫu đường dẫn cho phép (`§Bảo mật`). Mục tiêu đã bị xóa hoặc không còn quyền: trang đích hiển thị trạng thái "không còn" chuẩn của ứng dụng; dòng thông báo vẫn đọc/xóa được.
- **FR-08 (sinh thông báo):** module khác gọi `notify({ userId, type, params, link, dedupeKey?, collapseKey?, push? })`. Dịch vụ kiểm tùy chọn người nhận, dựng `title`/`subtitle` từ mẫu của `type`, ghi một dòng, rồi sau khi giao dịch commit phát sự kiện và xếp hàng push.
- **FR-09 (chống trùng):** `dedupeKey` trùng với dòng đang tồn tại của cùng người nhận thì bỏ qua (idempotent khi producer chạy lại). Ràng buộc duy nhất ở DB.
- **FR-10 (gộp):** `collapseKey` trùng với dòng **chưa đọc** tạo trong 60 phút gần nhất thì cập nhật dòng đó (`count + 1`, đổi phụ đề, đưa lên đầu) thay vì chèn dòng mới. Ví dụ "3 người đã theo dõi bạn". Tránh "bão" thông báo.
- **FR-11 (realtime):** sau commit, `PUBLISH events:notification:*`; mọi instance đẩy tới phòng `user:{id}`. Sự kiện: `notification.created` (mang cả dòng), `notification.changed` (`op`, `ids`), `notification.unread` (số mới). Client coi `GET` là nguồn sự thật và đồng bộ lại khi nối lại.
- **FR-12 (đồng bộ lại):** khi socket nối lại hoặc tab được hiện lại sau > 30 giây, client gọi `GET /notifications?limit=20` và `GET /notifications/unread-count`, ghép theo `id`.
- **FR-13 (đăng ký push):** `POST /notifications/push/subscriptions` nhận `PushSubscription` của trình duyệt kèm nhãn thiết bị. Lưu đã mã hóa; tối đa 10 thiết bị mỗi người (dư thì xóa thiết bị lâu không dùng nhất). `DELETE /notifications/push/subscriptions/{id}` hủy; `GET` liệt kê (không trả khóa).
- **FR-14 (khóa công khai VAPID):** `GET /notifications/push/config` trả `{ enabled, vapidPublicKey }`. Không có khóa thì `enabled = false` và UI ẩn phần bật push.
- **FR-15 (gửi push):** worker lấy việc từ `push_outbox`, giải mã đăng ký, gửi bản mã hóa (RFC 8291) kèm VAPID (RFC 8292), `TTL`, `Urgency`, `Topic`. Phản hồi 404/410 thì xóa đăng ký. Lỗi tạm thời thì thử lại lùi theo cấp số nhân, tối đa 5 lần.
- **FR-16 (quy tắc có gửi push hay không):** xem `diagrams/flow-push-decision.mmd`. Tóm tắt: loại cho phép push, người dùng bật push cho nhóm đó, có đăng ký còn sống, **không** có tab đang hiển thị trong 30 giây gần nhất, chưa vượt trần 10 push/giờ/người (phần dư gộp vào một push "Bạn có N thông báo mới" cùng `Topic`).
- **FR-17 (tùy chọn):** `GET/PATCH /notifications/preferences` theo nhóm (`social`, `messages`, `billing`, `moderation`, `system`) cho `inApp` và `push`; nhóm `security` luôn bật trong ứng dụng và push (không tắt được, chỉ tắt riêng push theo thiết bị). `hideContentOnLockScreen` (mặc định `false`): bật thì payload push chỉ có nội dung chung "Bạn có thông báo mới".
- **FR-18 (nhắn tin):** tin nhắn mới (009) chỉ sinh **push** khi người nhận không hoạt động, không sinh dòng trong hộp thông báo (đã có huy hiệu Messages). `Topic` theo cuộc hội thoại để thay vì chồng.
- **FR-19 (dọn dẹp):** job hằng đêm xóa vĩnh viễn: dòng đã xóa mềm > 7 ngày; dòng đã đọc > 90 ngày; mọi dòng > 180 ngày; giữ tối đa 500 dòng gần nhất mỗi người. Xóa theo lô 1.000, nghỉ giữa lô.
- **FR-20 (giao diện):** theo `ui/ui-spec.md`: sidebar `Thông báo` có huy hiệu; trang danh sách dùng chung cho `/app` và `/admin`; đủ trạng thái tải, trống, lỗi, mất kết nối; dùng được trên điện thoại và trong PWA.
- **FR-21 (thiết bị và đăng xuất):** đăng ký push gắn với **thiết bị** (`device_id`), không gắn với phiên, nên PWA cài lâu dài không phải bật lại sau mỗi lần đăng nhập. Để an toàn trên thiết bị dùng chung: đăng xuất, thu hồi phiên, đổi mật khẩu hoặc khóa tài khoản **tạm ngưng** (`suspended_at`) mọi thiết bị liên quan thay vì xóa; thiết bị tạm ngưng không nhận push. Cùng người đăng nhập lại trên thiết bị đó: client đồng bộ lại đăng ký (`POST subscriptions`, cùng `deviceId`) và push tự hoạt động lại, không hỏi quyền. Người khác đăng nhập trên thiết bị: đăng ký chuyển chủ sở hữu, người trước không còn nhận. Thiết bị không thấy hoạt động quá 60 ngày bị tạm ngưng (`inactive`). Xóa tài khoản xóa vĩnh viễn. Người dùng xóa thiết bị trong Cài đặt là xóa hẳn.
- **FR-22 (quan sát):** số liệu: thông báo tạo/đọc, độ trễ tạo→socket, độ trễ tạo→push gửi, tỉ lệ 404/410, độ sâu `push_outbox`. Nhật ký không chứa nội dung thông báo hay endpoint đầy đủ.

## Quy tắc nghiệp vụ <!-- key: business_rules -->

- **Chủ sở hữu duy nhất:** mọi truy vấn có `user_id = :me`. Dòng của người khác trả `404`, không phân biệt "không tồn tại" và "của người khác".
- **Xóa là ẩn:** xóa không ảnh hưởng người khác (vì mỗi người một dòng riêng). Không có "thu hồi thông báo đã gửi" ở giai đoạn 1.
- **Đọc chỉ đi một chiều theo thời gian của hành động:** `read_at` ghi lần đầu; "bỏ đọc" đặt lại `null` (người dùng chủ động).
- **Danh mục loại:** mỗi `type` có nhóm, icon, tone, mẫu tiêu đề/phụ đề, mẫu `link`, cờ `pushAllowed`, mức `urgency` push và TTL. Thêm loại là thêm một dòng vào `notification.catalog.ts`, không đổi schema. Loại ngoài danh mục bị từ chối khi gọi `notify()` (lỗi lập trình, không phải lỗi người dùng).
- **Danh mục ban đầu** (nguồn → loại; bảng đầy đủ ở `notification.catalog.ts` khi triển khai):

| Nhóm | Loại | Nguồn | Icon / tone | Link | Push |
| --- | --- | --- | --- | --- | --- |
| social | `follow.new` | 011-follow | `user-plus` / info | `/app/profile/{actorId}` | có |
| social | `discussion.reply` | 008-discussions | `message-circle` / info | `/app/discussions/{threadId}#c-{commentId}` | có |
| social | `discussion.mention` | 008-discussions | `at-sign` / info | như trên | có |
| messages | `message.new` | 009-messaging | `messages-square` / info | `/app/messages/{conversationId}` | chỉ push |
| billing | `payment.succeeded` | 007-billing | `badge-check` / success | `/app/payments/{paymentId}` | có |
| billing | `payment.failed` | 007-billing | `triangle-alert` / danger | `/app/payments/{paymentId}` | có |
| billing | `plan.expiring` | 007-billing | `clock` / warning | `/app/plans` | có |
| moderation | `listing.approved` / `listing.rejected` | 006-buying | `circle-check` / success, `circle-x` / danger | `/app/properties/{id}` | có |
| moderation | `feedback.replied` | 010-feedback | `message-square-heart` / info | `/app/feedback/{id}` | có |
| security | `security.new_login` | 003-auth | `shield-alert` / warning | `/app/profile#sessions` | có (bắt buộc) |
| security | `security.password_changed` | 003-auth | `key-round` / warning | `/app/profile#security` | có (bắt buộc) |
| admin | `admin.report.new` | 009 / 008 | `flag` / warning | `/admin/messaging` hoặc `/admin/discussions` | có |
| admin | `admin.feedback.new` | 010-feedback | `inbox` / info | `/admin/feedback` | không |
| admin | `admin.reconciliation.mismatch` | 007-billing | `scale` / danger | `/admin/reconciliation` | có |
| system | `system.announcement` | giai đoạn 2 | `megaphone` / info | tùy | tùy |

- **Không lặp kênh:** việc nào đã có email `security`/`transactional` (012) vẫn gửi email như cũ; thông báo trong ứng dụng/push là kênh bổ sung, không thay thế.
- **Giới hạn chống bão:** tối đa 30 dòng mới/giờ/người cho mỗi `type` (vượt thì gộp theo `collapseKey` hoặc bỏ, có đếm số liệu); tối đa 10 push/giờ/người; `security.*` không bị cắt.
- **Hạn lưu giữ và trần số dòng** theo FR-19; dòng `security.*` giữ 365 ngày để người dùng còn xem lại.
- **Chỉ văn bản thuần:** `title` và `subtitle` không chứa HTML hay markdown; client hiển thị như text. Tên người dùng chèn vào mẫu được cắt, bỏ ký tự điều khiển và định hướng (bidi).
- **Quyền:** xem/đọc/xóa/đăng ký push dùng `notification:read` (đã có trong `USER_PERMISSIONS`) và quyền mới `notification:update` cho thao tác ghi; `admin:access` đã đủ để vào `/admin/notification`. `notification:manage` dành riêng giai đoạn 2.

## Tóm tắt luồng người dùng <!-- key: user_flow_summary -->

1. **Nhận (đang mở ứng dụng):** hành động ở nơi khác → `notify()` → ghi DB → socket → huy hiệu tăng, toast ngắn (≤ 1 toast/3 giây), dòng chèn vào đầu danh sách nếu đang mở trang.
2. **Nhận (đã đóng tab/PWA):** như trên, không có tab hiển thị → worker gửi Web Push → hệ điều hành hiện thông báo → bấm vào → mở/focus cửa sổ ở đúng `link` → ứng dụng đánh dấu đã đọc.
3. **Đọc:** mở `/app/notification`; bấm một dòng để tới mục tiêu; hoặc dùng "⋯" để đánh dấu đã đọc/xóa; "Đánh dấu tất cả đã đọc" ở đầu trang.
4. **Bật push lần đầu:** thẻ gợi ý ở đầu trang thông báo (không hỏi quyền khi vừa vào trang) → người dùng bấm "Bật thông báo đẩy" → trình duyệt hỏi quyền → đăng ký → thiết bị xuất hiện trong "Thiết bị nhận thông báo". Trên iPhone/iPad, trước đó thẻ hướng dẫn "Thêm vào Màn hình chính".
5. **Tắt:** tắt theo nhóm hoặc theo thiết bị; từ chối ở cấp trình duyệt thì thẻ hiển thị hướng dẫn mở lại quyền.

## Bối cảnh kỹ thuật <!-- key: technical_context -->

- **Tái sử dụng, không thêm thành phần hạ tầng mới:** PostgreSQL (nguồn sự thật), Redis (bộ đệm, giới hạn, Pub/Sub), `RealtimeGateway` Socket.IO với vé một lần (`003-auth/interfaces/socket-api.yml`), mô hình "ghi qua REST/service, phát sau commit, đồng bộ lại bằng GET" của `009-messaging/research.md` bản ghi 1 và 3, hàng đợi trong DB kiểu `012-email` (`FOR UPDATE SKIP LOCKED`, `next_attempt_at`).
- **Đặt vị trí:** module backend `notification` (`backend/src/modules/notification`) sở hữu dữ liệu, API và worker push; `RealtimeGateway` hiện nằm trong module `auth` và sẽ được chuyển vào module `realtime` dùng chung (câu hỏi mở của 009). Trong lúc chưa chuyển, `notification` đăng ký kênh Pub/Sub riêng và phát qua registry hiện có (`realtime.registry.ts`).
- **Hợp đồng sự kiện** nằm ở `interfaces/socket-api.yml`; REST ở `interfaces/rest-api.yml`; lược đồ ở `postgresql.dbml`; khóa Redis ở `redis.md`.
- **Web Push:** thư viện phía máy chủ `web-push` (web-push-libs), VAPID, mã hóa `aes128gcm`. Quyết định và lý do ở `research.md` bản ghi 2 và 3. Phía trình duyệt, service worker và PWA ở `015-pwa`.
- **Hiệu năng là ràng buộc hàng đầu:** đường nóng (tạo + đọc danh sách + số chưa đọc) mỗi thao tác là **một** truy vấn có chỉ mục bao phủ; chi tiết ở §Hiệu năng của `research.md` và `scaling-roadmap.md`.

## Phụ thuộc <!-- key: dependencies -->

- `003-auth`: phiên, vé realtime, thu hồi phiên (xóa đăng ký push).
- `004-rbac`: quyền `notification:read`, `notification:update`; chỗ cho `notification:manage`.
- `009-messaging`: sự kiện tin mới (push-only); mô hình realtime.
- `011-follow`, `008-discussions`, `007-billing`, `010-feedback`, `006-buying`: các producer (nối từng cái, mỗi cái một commit riêng).
- `012-email`: tùy chọn email giữ nguyên; dùng lại mẫu hàng đợi.
- `015-pwa`: manifest, service worker, cài đặt, huy hiệu ứng dụng.
- Thư viện mới: `web-push` (và `@types/web-push`) ở backend. Không thêm thư viện phía client.

## Ràng buộc <!-- key: constraints -->

- Không `any`; DTO có `class-validator` (whitelist, forbidNonWhitelisted); đặt tên theo `.cursor/rules/naming.md` (tệp NestJS kiểu `notification.service.ts`, tệp thường kebab-case).
- Không bí mật trong repo: `VAPID_PRIVATE_KEY`, `NOTIFICATION_PUSH_ENC_KEY` chỉ ở `.env.*` (gitignored); `.env.example` chỉ chứa tên biến. Biến cấu hình chỉ sửa ở `.env` gốc theo `.cursor/rules/env-docker.md`.
- Ghi (tạo, đọc, xóa, đăng ký) khi Redis lỗi: giới hạn tần suất **từ chối 503**; đọc bộ đệm lỗi thì rơi về DB.
- Giờ lưu UTC (`timestamptz`); hiển thị theo múi giờ người dùng.
- Kích thước payload push ≤ 3.000 byte (giới hạn giao thức 4.078).
- Giả định quy mô thiết kế (mục tiêu, **không phải số đo**): 100.000 người dùng, 20 thông báo/người/ngày ≈ 2 triệu dòng/ngày ghi tối đa, giữ ≤ 500 dòng/người ⇒ ≤ 50 triệu dòng hoạt động.

## Tài liệu liên quan (Artifacts) <!-- key: artifacts -->

- [research.md](research.md) — bản ghi quyết định, nguồn tham khảo, tính toán hiệu năng.
- [postgresql.dbml](postgresql.dbml) — lược đồ `notifications`, `notification_preferences`, `push_subscriptions`, `push_outbox` và chỗ cho giai đoạn 2.
- [redis.md](redis.md) — khóa, giới hạn, kênh Pub/Sub.
- [interfaces/rest-api.yml](interfaces/rest-api.yml), [interfaces/socket-api.yml](interfaces/socket-api.yml).
- [threat-model.md](threat-model.md), [scaling-roadmap.md](scaling-roadmap.md).
- [ui/ui-spec.md](ui/ui-spec.md).
- [diagrams/](diagrams/) — `sequence-create-deliver.mmd`, `sequence-subscribe-push.mmd`, `sequence-open-from-push.mmd`, `flow-push-decision.mmd`, `state-notification.mmd`.
- Liên quan: [../015-pwa/README.md](../015-pwa/README.md).

## Tiêu chí nghiệm thu (Acceptance Criteria) <!-- key: acceptance_criteria -->

| ID | Tiêu chí |
| --- | --- |
| AC1 | Sidebar `/app` và `/admin` có mục "Thông báo" trỏ `/app/notification` và `/admin/notification`, hiện huy hiệu số chưa đọc (99+). |
| AC2 | Mỗi dòng hiển thị icon, tiêu đề, phụ đề, thời điểm (tương đối, có thời điểm tuyệt đối khi rê/focus) và trạng thái đọc (chấm + đậm chữ), không dựa vào màu đơn thuần. |
| AC3 | Đánh dấu đã đọc một dòng, đọc tất cả, xóa một dòng hoạt động; huy hiệu cập nhật ngay (lạc quan) và khớp máy chủ sau đó. |
| AC4 | Bấm một dòng tới đúng `link`, dòng thành đã đọc; `link` ngoài danh sách cho phép không bao giờ được lưu hay mở. |
| AC5 | Hai tab/thiết bị cùng tài khoản: đọc/xóa ở tab này phản ánh sang tab kia trong < 2 giây khi socket đang nối. |
| AC6 | Thông báo mới hiện ở trang đang mở trong < 1 giây (p95, một instance) mà không tải lại. |
| AC7 | Đóng tab, tạo sự kiện → Web Push tới trình duyệt (desktop + Android) và PWA đã cài (iOS ≥ 16.4); bấm vào mở đúng `link`. |
| AC8 | Người dùng đang xem ứng dụng (tab hiển thị trong 30 giây) không nhận push trùng với toast. |
| AC9 | Đăng xuất tạm ngưng push của thiết bị; sự kiện sau đó không hiện thông báo hệ điều hành trên thiết bị. Đăng nhập lại cùng tài khoản trên thiết bị đó thì push hoạt động lại không cần cấp quyền lại; tài khoản khác đăng nhập thì tài khoản cũ không nhận được. |
| AC10 | Truy cập `id` của người khác trả 404 với mọi thao tác (đọc, xóa, bỏ đọc). |
| AC11 | `GET /notifications?limit=20` với 500 dòng/người dùng một truy vấn, quét chỉ mục, không sắp xếp bộ nhớ (kiểm bằng `EXPLAIN`). |
| AC12 | Gọi `notify()` hai lần cùng `dedupeKey` chỉ tạo một dòng; 5 sự kiện cùng `collapseKey` trong 60 phút chỉ tạo một dòng chưa đọc có `count = 5`. |
| AC13 | Từ chối quyền thông báo ở trình duyệt: UI hiển thị trạng thái và hướng dẫn, không hỏi lại liên tục. |
| AC14 | Điều hướng bàn phím và trình đọc màn hình dùng được toàn bộ thao tác; `prefers-reduced-motion` tắt hiệu ứng chèn dòng. |
| AC15 | Redis dừng: ghi bị giới hạn trả 503, danh sách vẫn đọc được từ DB; phục hồi không cần thao tác tay. |

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

- Tin nhắn mới (009) có nên sinh dòng trong hộp thông báo khi người nhận chưa đọc quá 24 giờ? Đề xuất: không ở giai đoạn 1.
- Thông báo `security.new_login` dựa trên dấu vết thiết bị nào (IP tổng quát, user-agent)? Cần thống nhất với `003-auth`.
- Gom admin: có cần nhóm thông báo admin theo vai trò (mọi admin cùng nhận) hay chỉ người được chỉ định? Mặc định: mọi người có quyền liên quan nhận bản riêng.
- Nơi đặt `RealtimeGateway` lâu dài (đã nêu ở 009): chuyển vào module `realtime` trước hay sau khi làm 014?

## Nhật ký cập nhật <!-- key: update_log -->

| Ngày | Thay đổi |
| --- | --- |
| 2026-11-02 | Tạo đặc tả ban đầu (chưa triển khai). |
| 2026-11-02 | Chốt: đăng ký push gắn với thiết bị (`device_id`), đăng xuất chỉ tạm ngưng; icon thông báo lấy từ `lucide-react`. |
