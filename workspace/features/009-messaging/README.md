# Nhắn tin trực tiếp thời gian thực (Messaging)

**Feature ID:** 009-messaging
**Status:** In Progress
**Last Updated:** 2026-11-02

## Tổng quan <!-- key: overview -->

Người dùng đã đăng nhập nhắn tin riêng 1-1, nhận tin ngay qua WebSocket sẵn có, thấy đã xem, gửi ảnh, trả lời trích dẫn, thả cảm xúc và chia sẻ bài `/feed`. Người lạ gửi lần đầu vào mục Requests để người nhận chấp nhận. Giao diện hai cột theo Threads và Messenger. Ghi tin qua REST, phát sự kiện qua Socket.IO và Redis Pub/Sub; dữ liệu khóa theo hội thoại để sau này chia partition mà không đổi khóa. Lộ trình mở rộng nằm ở `scaling-roadmap.md`.

## Mục tiêu & Phạm vi <!-- key: goals_scope -->

**In scope:**

- Hội thoại 1-1; Inbox và Requests; chấp nhận, từ chối, chặn, báo cáo.
- Tin chữ, ảnh (≤ 4), chia sẻ bài `/feed`, trả lời trích dẫn, cảm xúc, thu hồi, xóa phía mình.
- Realtime: tin mới, thu hồi, cảm xúc, đã đọc, đang gõ, số chưa đọc.
- Hiện diện (hoạt động gần nhất) có thể tắt; cài đặt riêng tư.
- Màn `/app/messages` và duyệt báo cáo `/admin/messaging`.

**Out of scope:**

- Nhóm chat (schema sẵn, API chưa mở), gọi thoại/video, ghi âm, video, tệp tùy ý, GIF, nhãn dán.
- Mã hóa đầu cuối, tìm kiếm toàn văn nội dung, xem trước liên kết, push và email, sửa tin, chuyển tiếp tin.
- Khách chưa đăng nhập.

## Đối tượng liên quan <!-- key: actors -->

- Người dùng đã đăng nhập: gửi, nhận, chặn, báo cáo.
- Người nhận lần đầu: chấp nhận hoặc từ chối yêu cầu.
- Admin: duyệt báo cáo, ẩn tin; không đọc hội thoại tùy ý.
- Hệ thống: job dọn tệp, hội thoại rỗng, Requests quá hạn; bộ phát sự kiện.

## Yêu cầu chức năng <!-- key: functional_requirements -->

- **FR-01 (hội thoại 1-1):** `POST /messaging/conversations` tìm hoặc tạo hội thoại theo cặp người dùng (`direct_key`). Gọi lặp trả cùng một hội thoại. Không tạo với chính mình.
- **FR-02 (hộp thư):** `GET /messaging/conversations` trả hội thoại của mình, mới nhất trước, lọc `inbox` hoặc `requests`, tìm theo tên, phân trang con trỏ. Mỗi dòng có người kia, bản xem trước, thời gian, `unread`, `muted`.
- **FR-03 (gửi tin chữ):** `POST .../messages` với `clientMsgId`. Máy chủ cấp `seq`, lưu, phát sự kiện. Gửi lại cùng `clientMsgId` trả đúng tin cũ.
- **FR-04 (ảnh):** tối đa 4 ảnh jpeg/png/webp, mỗi ảnh ≤ 8 MB. Tải thẳng lên MinIO bằng URL ký, máy chủ kiểm magic byte khi `complete`.
- **FR-05 (chia sẻ bài):** `kind = post_share` tham chiếu một bài `visible` ở `/feed`; người nhận thấy thẻ bài. Bài ẩn sau đó hiện "Bài viết không còn".
- **FR-06 (trả lời trích dẫn):** `replyToSeq` trỏ một tin cùng hội thoại; hiển thị trích đoạn ≤ 120 ký tự.
- **FR-07 (cảm xúc):** một người một cảm xúc trên một tin, từ danh sách cho phép; đặt, đổi hoặc bỏ. Phát `reaction.changed`.
- **FR-08 (thu hồi):** tác giả thu hồi tin với mọi người; body bị xóa, ảnh gỡ khỏi API ngay, object bị dọn sau 7 ngày. Phát `message.updated`.
- **FR-09 (xóa phía mình):** `DELETE /conversations/{id}` đặt `cleared_before_seq` và `hidden_at`; người kia không bị ảnh hưởng.
- **FR-10 (yêu cầu nhắn):** hội thoại mới là `pending`. Người khởi tạo chỉ gửi được 1 tin chữ. Người nhận chấp nhận (`active`), từ chối (`declined`) hoặc trả lời (tự thành `active`).
- **FR-11 (chặn):** chặn là quan hệ có hướng. Người bị chặn gửi nhận `403 cannot_message_user`, cùng phản hồi với người đặt `who_can_message = nobody`. Chặn ẩn hội thoại phía người chặn.
- **FR-12 (đã đọc):** `PUT .../read { seq }` chỉ tăng. Người kia nhận `conversation.read` nếu người đọc bật báo đã đọc. Chưa đọc = `last_seq - last_read_seq`.
- **FR-13 (số chưa đọc):** `GET /messaging/unread-count` trả số hội thoại chưa đọc của Inbox và Requests (chặn ở 99). Sự kiện `unread.changed` báo cập nhật.
- **FR-14 (realtime):** sự kiện `message.created`, `message.updated`, `reaction.changed`, `conversation.read`, `conversation.updated`, `typing`, `unread.changed` tới phòng `user:{id}` trên mọi instance.
- **FR-15 (đồng bộ lại):** sau khi nối lại hoặc khi thấy lỗ hổng `seq`, client gọi `GET .../messages?afterSeq=` và tải lại hộp thư. Không phụ thuộc vào việc không mất sự kiện.
- **FR-16 (đang gõ):** client gửi `typing` tối đa mỗi 2 giây; máy chủ kiểm thành viên, giới hạn rồi chuyển cho người kia; không lưu.
- **FR-17 (hiện diện):** "Đang hoạt động" / "Hoạt động X trước" lấy từ Redis, chỉ hiện cho người có hội thoại `active` và khi cả hai bên bật. Client hỏi khi mở hội thoại, không có phát quảng bá.
- **FR-18 (cài đặt):** `GET/PATCH /messaging/preferences` cho `whoCanMessage`, `showActivityStatus`, `sendReadReceipts`.
- **FR-19 (tìm người nhận):** `GET /messaging/recipients?q=` trả tối đa 10 người theo tiền tố tên, loại người không nhận tin hoặc đã chặn mình.
- **FR-20 (báo cáo):** người dùng báo một tin một lần; hệ thống chụp tin và tối đa 10 tin ngữ cảnh. Admin chỉ thấy phần chụp, có thể bỏ qua hoặc ẩn tin, bắt buộc lý do, ghi `admin_audit_logs`.
- **FR-21 (tắt thông báo):** `PUT .../mute { until }` tắt chấm báo và âm thanh cho hội thoại; tin vẫn được lưu và hiển thị.
- **FR-22 (khóa tài khoản):** người dùng bị khóa hoặc xóa không gửi được; tin cũ của họ hiện dưới tên "Người dùng đã xóa" nếu xóa.
- **FR-23 (giao diện):** theo `ui/ui-spec.md`: danh sách + khung hội thoại, đầy đủ trạng thái tải, trống, lỗi, mất kết nối, bị chặn, yêu cầu nhắn; có dùng được trên điện thoại.

## Quy tắc nghiệp vụ <!-- key: business_rules -->

- **BR-01 (cặp duy nhất):** hai người có tối đa một hội thoại direct. `direct_key = min(userId):max(userId)`; tạo trùng trả hội thoại có sẵn.
- **BR-02 (chữ):** máy chủ cắt khoảng trắng đầu/cuối, bỏ thẻ HTML, chuẩn hóa NFC, loại ký tự điều khiển (trừ xuống dòng). Rỗng sau khi làm sạch thì `422`. Tối đa 2.000 ký tự.
- **BR-03 (thứ tự):** `seq` do máy chủ cấp trong giao dịch có khóa dòng hội thoại, tăng liên tục từ 1. Client không tự đặt `seq`.
- **BR-04 (yêu cầu nhắn):** hội thoại `pending` do A khởi tạo: A chỉ gửi 1 tin, chỉ chữ, không ảnh, không chia sẻ bài; gửi thêm trả `409 request_pending`. Người kia nhắn lại hoặc chấp nhận thì `active`. Người khởi tạo không thấy khác biệt giữa `pending` và `declined`.
- **BR-05 (giới hạn khởi tạo):** tối đa 30 hội thoại `pending` do cùng một người khởi tạo và tối đa 20 hội thoại mới mỗi ngày; vượt thì `409 limit_reached` hoặc `429`.
- **BR-06 (chặn):** A chặn B thì B không gửi, không thấy hiện diện của A, không tìm thấy A ở `/messaging/recipients`. Phản hồi không nêu lý do.
- **BR-07 (thành viên):** mọi route theo hội thoại kiểm người gọi là thành viên đang tham gia, trong cùng truy vấn. Không phải thành viên (kể cả admin) thì `404`.
- **BR-08 (gửi lại):** `(conversation_id, sender_id, client_msg_id)` duy nhất. Gửi lại với nội dung khác vẫn trả tin cũ.
- **BR-09 (thu hồi):** chỉ tác giả; không giới hạn thời gian; thu hồi lần hai cũng `204`. Nếu đó là tin cuối của hội thoại, xem trước đổi thành "Tin nhắn đã thu hồi".
- **BR-10 (xóa phía mình):** không đổi dữ liệu của người kia. Tin mới đến hiện lại hội thoại, chỉ từ `seq` sau mốc xóa.
- **BR-11 (đã đọc):** `last_read_seq` chỉ tăng; `seq` vượt `last_seq` bị cắt về `last_seq`. Tin của chính mình không tính là chưa đọc.
- **BR-12 (ảnh):** chỉ nhận tệp `ready`, do chính người gửi tải, đúng hội thoại, chưa gắn tin nào. Hội thoại `pending` chưa được nhận ảnh. Quá 24 giờ chưa gắn thì bị dọn.
- **BR-13 (chia sẻ bài):** bài phải `visible` ở thời điểm gửi và người gửi có quyền đọc `/feed`. Người nhận không cần quyền riêng để xem trích đoạn trong thẻ; nhấp mở bài tuân theo quyền `discussion:read`.
- **BR-14 (tần suất):** 60 tin mỗi phút mỗi người; 15 tin mỗi 10 giây mỗi hội thoại; 30 tệp mỗi giờ; 60 cảm xúc mỗi phút; 20 báo cáo mỗi ngày; 30 lần tìm người mỗi phút. Redis lỗi thì từ chối ghi. Giá trị chỉnh bằng cấu hình.
- **BR-15 (socket):** tối đa 5 socket mỗi người; 10 sự kiện mỗi giây mỗi socket; gói tối đa 16 KB; client không chọn phòng.
- **BR-16 (email):** tài khoản phải xác minh email mới tạo hội thoại hoặc gửi tin (giả định, xem Câu hỏi mở). Đọc thì không cần.
- **BR-17 (kiểm duyệt):** admin không có API đọc hội thoại. Chỉ đọc phần chụp trong báo cáo. Ẩn tin: người dùng thấy như tin đã thu hồi.
- **BR-18 (lưu giữ):** tin giữ đến khi cả hai phía xóa hội thoại, sau đó xóa cứng sau 30 ngày; báo cáo giữ 180 ngày; object ảnh của tin thu hồi xóa sau 7 ngày (giả định; xem Câu hỏi mở).
- **BR-19 (không sửa tin):** tin đã gửi không đổi nội dung; không có sửa tin.

## Tóm tắt luồng người dùng <!-- key: user_flow_summary -->

1. Linh mở hồ sơ Hùng và bấm "Nhắn tin". Khung nháp mở; Linh gõ rồi gửi. Client gọi tìm-hoặc-tạo hội thoại (`pending`) rồi gửi tin đầu.
2. Hùng thấy chấm ở Requests, mở ra đọc tin. Hùng bấm Chấp nhận (hội thoại sang Inbox, Linh gửi tự do) hoặc từ chối, hoặc chặn.
3. Hai người nhắn qua lại. Mỗi tin: `POST` → commit → `PUBLISH` → socket tới mọi tab của cả hai. Khi đang xem, người nhận đánh dấu đã đọc, người gửi thấy "Đã xem".
4. Mất mạng: client nối lại bằng vé mới, tải lại hộp thư và tin mới sau `lastSeq`, hợp nhất theo `seq`.
5. Hùng báo cáo một tin lừa đảo: hệ thống chụp ngữ cảnh. Admin xem phần chụp, ẩn tin và ghi lý do.

Sơ đồ: `diagrams/sequence-send-message.mmd`, `diagrams/sequence-reconnect-sync.mmd`, `diagrams/sequence-attachment.mmd`, `diagrams/flow-first-message-request.mmd`, `diagrams/state-conversation.mmd`, `diagrams/state-message.mmd`.

## Bối cảnh kỹ thuật <!-- key: technical_context -->

- **Giao thức:** ghi qua REST (kiểm tra, giới hạn, idempotent), nhận qua Socket.IO sẵn có (`RealtimeGateway`, vé một lần, phòng `user:{id}`). Chỉ transport `websocket`; không cần sticky session. Lý do: `research.md` quyết định 1 và 3.
- **Thứ tự và đồng bộ:** `seq` theo hội thoại; khóa chính `(conversation_id, seq)`; sự kiện là gợi ý, REST là nguồn sự thật. Lý do: `research.md` quyết định 2.
- **Dữ liệu:** `conversations` + `conversation_participants` (hỗ trợ nhóm sau này), `messages`, `message_attachments`, `message_reactions`, `user_blocks`, `messaging_preferences`, `message_reports`. Chi tiết: `postgresql.dbml`, `data-review.md`.
- **Redis:** giới hạn tần suất, hiện diện, bộ đệm thành viên và số chưa đọc, kênh `events:messaging:*`. Không giữ tin. Chi tiết: `redis.md`.
- **Phát sự kiện:** sau commit, một `PUBLISH`; mỗi instance phát cho socket mình giữ. Pub/Sub giao tối đa một lần nên có đồng bộ lại. Outbox giao dịch để bậc 2.
- **Ảnh:** dùng lại MinIO và `StorageService` của 008-discussions; URL đọc ký hạn 1 giờ.
- **Mã hóa:** TLS khi truyền, mã hóa đĩa ở hạ tầng; chưa E2EE (`research.md` quyết định 5).
- **Quy mô mục tiêu (chưa đo):** bản đầu ~5.000 kết nối đồng thời, ~50 tin/giây. Cách tăng ở `scaling-roadmap.md`.
- **Điều kiện trước khi mở:** các việc ở `scaling-roadmap.md` mục Bước 0 và `threat-model.md` mục 6.
- **Phần mở rộng lên hệ thống hiện tại:** thêm quyền `message:read`, `message:write`, `message:moderate` vào `004-rbac/policy-config.md`; module `messaging` ở backend nhận `Server` từ `RealtimeGateway` (đặt gateway thành module dùng chung là việc dọn dẹp sau).

## Phụ thuộc <!-- key: dependencies -->

- `003-auth`: phiên, vé WebSocket, hồ sơ (`display_name`, `avatar_url`), `RealtimeGateway`. Cần siết CORS và recheck trước khi mở.
- `004-rbac`: ba quyền mới, `admin_audit_logs`; thêm hàng vào ma trận quyền và bài kiểm kê route.
- `008-discussions`: `discussion_posts` cho `post_share`; mẫu tệp ảnh.
- `005-legal`: bổ sung điều khoản nhắn tin và thông báo không mã hóa đầu cuối.
- `001-ui`: token màu và chữ.

## Ràng buộc <!-- key: constraints -->

- Không thêm dịch vụ hạ tầng mới ở bản đầu.
- Mọi ghi dữ liệu qua REST; socket chỉ phát sự kiện và tín hiệu tạm.
- Không HTML, không link preview do máy chủ, không E2EE, không sửa tin.
- Mọi truy vấn trên `messages` kèm `conversation_id`.
- Không ghi nội dung tin, URL ký, vé, token vào log.
- Không giữ nội dung tin ở `localStorage` hoặc `redux-persist`.

## Tài liệu liên quan (Artifacts) <!-- key: artifacts -->

- Idea: `messaging-idea.md`
- Diagrams: `diagrams/sequence-send-message.mmd`, `diagrams/sequence-reconnect-sync.mmd`, `diagrams/sequence-attachment.mmd`, `diagrams/flow-first-message-request.mmd`, `diagrams/state-conversation.mmd`, `diagrams/state-message.mmd`
- API Contracts: `interfaces/rest-api.yml`, `interfaces/socket-api.yml`
- Database Schemas: `postgresql.dbml`, `redis.md`, `data-review.md`
- Technical Research: `research.md`
- Scaling: `scaling-roadmap.md`
- Threat model: `threat-model.md`
- UI: `ui/ui-spec.md`
- Mã nguồn backend: `backend/src/modules/messaging/` (module), `backend/src/modules/auth/realtime.gateway.ts` và `realtime.registry.ts` (kênh realtime dùng chung)
- Mã nguồn website: `website/src/features/messaging/` (store, socket, màn hình), `website/src/app/app/messages/`, `website/src/app/admin/messaging/`

## Tiêu chí nghiệm thu (Acceptance Criteria) <!-- key: acceptance_criteria -->

- [ ] **AC-01:** Given A và B chưa có hội thoại, When A gọi `POST /messaging/conversations` hai lần cho B, Then cả hai trả cùng `id` (201 rồi 200) và DB có một dòng.
- [ ] **AC-02:** Given hội thoại `pending` do A khởi tạo, When A gửi tin thứ hai, Then `409 request_pending` và không có tin mới.
- [ ] **AC-03:** Given hội thoại `pending`, When A gửi ảnh, Then `422`. Given B chấp nhận, When A gửi ảnh, Then `201`.
- [ ] **AC-04:** Given A và B ở hai trình duyệt đang mở socket, When A gửi tin, Then B thấy tin trong < 1 giây mà không tải lại, và tab thứ hai của A cũng thấy.
- [ ] **AC-05:** Given hai instance backend, When A nối instance 1 và B nối instance 2, Then tin của A vẫn tới B.
- [ ] **AC-06:** Given A gửi tin nhưng mất mạng trước khi nhận phản hồi, When A gửi lại cùng `clientMsgId`, Then chỉ một tin tồn tại và phản hồi là tin đó.
- [ ] **AC-07:** Given B mất kết nối 30 giây trong lúc A gửi 5 tin, When B nối lại, Then B thấy đủ 5 tin theo thứ tự `seq`, không trùng.
- [ ] **AC-08:** Given hai request gửi cùng lúc vào một hội thoại, When cả hai thành công, Then `seq` khác nhau và liên tục, không có hai tin cùng `seq`.
- [ ] **AC-09:** Given C không phải thành viên, When C gọi bất kỳ route nào với `conversationId` của A và B, Then luôn `404`; admin cũng vậy.
- [ ] **AC-10:** Given B chặn A, When A gửi tin cho B, Then `403 cannot_message_user`, cùng phản hồi khi B đặt `whoCanMessage = nobody`.
- [ ] **AC-11:** Given tin có chuỗi `<img src=x onerror=alert(1)>`, When người nhận mở hội thoại, Then hiện nguyên chuỗi như chữ và không chạy script.
- [ ] **AC-12:** Given tệp `.png` thật ra là một tệp khác, When `complete`, Then `422 attachment_rejected` và object bị xóa.
- [ ] **AC-13:** Given A thu hồi một tin, When B tải lại, Then thấy "Tin nhắn đã thu hồi", API không còn body hay URL ảnh, và B nhận `message.updated` nếu đang mở.
- [ ] **AC-14:** Given A xóa hội thoại phía mình, When B gửi tin mới, Then A thấy hội thoại lại, chỉ từ tin mới, và lịch sử của B không đổi.
- [ ] **AC-15:** Given B đang xem hội thoại, When tin của A đến, Then B gửi `PUT read` trong < 1 giây và A thấy "Đã xem" nếu B bật báo đã đọc; tắt thì A không thấy.
- [ ] **AC-16:** Given A gửi 61 tin trong 60 giây, When gửi tin thứ 61, Then `429` có `Retry-After`; Given Redis lỗi, Then `503` và không có tin.
- [ ] **AC-17:** Given người dùng mở socket thứ 6, When nối, Then socket cũ nhất bị đóng mã 4403.
- [ ] **AC-18:** Given A báo cáo tin của B, When admin mở báo cáo, Then chỉ thấy phần chụp (≤ 11 tin), không có route đọc cả hội thoại; Given thiếu lý do khi xử lý, Then `400`.
- [ ] **AC-19:** Given phiên của A bị thu hồi, When A đang mở socket, Then socket đóng 4401 và API trả `401`; sau khi đăng nhập lại A không thấy tin ở trạng thái trước.
- [ ] **AC-20:** Given bài `/feed` bị admin ẩn sau khi được chia sẻ, When B mở hội thoại, Then thẻ hiện "Bài viết không còn" và không chứa trích đoạn.
- [ ] **AC-21:** Given tải thử 5.000 socket nghỉ và 50 tin/giây trong 10 phút, When đo, Then độ trễ commit → emit p95 < 500 ms và `recheck` hoàn tất < 1 giây (kiểm mục tiêu, ghi số đo vào `research.md`).
- [ ] **AC-22:** Given màn hình 390 px, When dùng danh sách → hội thoại → quay lại, Then không cuộn ngang, bàn phím ảo không che ô soạn.

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

- Có yêu cầu email đã xác minh để gửi tin không (BR-16)? Đã có cờ `MESSAGING_REQUIRE_VERIFIED_EMAIL=true` để bật; mặc định tắt vì môi trường hiện chưa có luồng xác minh email.
- Chính sách lưu giữ cụ thể (BR-18) và cách xử lý tin của tài khoản đã xóa: cần xác nhận pháp lý theo Nghị định 13/2023/NĐ-CP.
- Danh sách emoji cho phép: đề xuất 6 emoji nhanh (👍 ❤️ 😂 😮 😢 🙏) ở bản đầu, mở bảng đầy đủ sau.
- Có cần email nhắc khi chưa đọc quá 15 phút ở bản đầu không? Đề xuất: không, làm ở bậc 2.
- Nút "Nhắn người đăng" ở chi tiết nhà đất (`006-buying`) có đi kèm ngữ cảnh tin không? Đề xuất: giai đoạn 2, thêm `context_listing_id`.
- Vị trí đặt `RealtimeGateway` lâu dài (module `realtime` dùng chung với `notification`)?

## Nhật ký cập nhật <!-- key: update_log -->

- 2026-11-02 (triển khai): hoàn thiện backend (REST, WebSocket, đồng bộ, giới hạn, báo cáo, dọn dẹp) và website (hộp thư, hội thoại, yêu cầu nhắn, ảnh, cảm xúc, chia sẻ bài, cài đặt, màn admin). Đổi đường dẫn Socket.IO sang `/api/v1/ws` vì `/api/v1/realtime` trùng tiền tố với `POST /realtime/ticket` (engine.io chặn mất route). Tham số phân trang đổi thành `beforeSeq`/`afterSeq`; mã lỗi nghiệp vụ nằm ở `error.details.code`; `429` trả `error.details.retryAfter`. Chọn người nhắn thì tạo hội thoại ngay (không có khung nháp). Cờ `MESSAGING_REQUIRE_VERIFIED_EMAIL` (mặc định tắt) cho BR-16.
- 2026-11-02: Đặc tả đầu cho nhắn tin 1-1 thời gian thực, tham khảo giao diện Threads/Messenger và kiến trúc Discord, Zulip, Mattermost, Socket.IO (`research.md`). Nhóm chat để chỗ sẵn trong schema, chưa mở.
