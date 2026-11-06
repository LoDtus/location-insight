# Diễn đàn hỏi đáp

**Feature ID:** 008-discussions
**Status:** Draft
**Last Updated:** 2026-11-01

## Tổng quan <!-- key: overview -->

Người đã đăng nhập tạo chủ đề, đăng một câu hỏi hoặc một bài ngắn, đính kèm ảnh hoặc một video, và người khác trả lời trên cùng một mạch. Danh sách xếp theo thời gian, giống một mạch trên Threads hoặc X. Admin khóa chủ đề hoặc ẩn bài. Không phát trực tiếp và không có bảng tin thuật toán.

## Mục tiêu & Phạm vi <!-- key: goals_scope -->

**In scope:**

- Chủ đề, bài gốc, trả lời, thích, xóa bài của mình, báo cáo.
- Ảnh tối đa 4 hoặc một video mp4, tải qua MinIO.
- Màn `/app/discussions` và màn duyệt `/admin/discussions`.

**Out of scope:**

- Phát trực tiếp, theo dõi, đăng lại, tin nhắn riêng, thông báo đẩy, xếp hạng bằng mô hình.
- Khách chưa đăng nhập.
- Gắn mạch bài vào tin nhà đất hoặc vào `/bai-viet`.

## Đối tượng liên quan <!-- key: actors -->

- Người dùng đã đăng nhập: tạo chủ đề, đăng, trả lời, thích, xóa bài của mình, báo cáo.
- Admin: khóa hoặc mở chủ đề, ẩn bài, xem báo cáo.
- Khách: không có quyền đọc.

## Yêu cầu chức năng <!-- key: functional_requirements -->

- **FR-01 (chủ đề):** Người dùng tạo tên, slug và một câu mô tả. Slug duy nhất. Trùng thì `409`.
- **FR-02 (bài gốc):** Bài gắn một chủ đề đang mở, loại `question` hoặc `note`, chữ thường tối đa 2.000 ký tự, không HTML.
- **FR-03 (trả lời):** Trả lời thuộc `root_id` của bài gốc và có `parent_id` là một bài còn hiện trong mạch đó. Danh sách trả lời theo thời gian tăng.
- **FR-04 (media):** Bài nhận tối đa 4 ảnh hoặc một video, không cả hai. Chỉ nhận bản ghi `ready` do chính người đăng tải.
- **FR-05 (thích):** Một người một lượt thích trên một bài. Bấm lần nữa thì bỏ.
- **FR-06 (xóa):** Tác giả xóa bài của mình. Xóa bài gốc thì cả mạch khuất. Xóa một trả lời thì chỉ trả lời đó khuất.
- **FR-07 (kiểm duyệt):** Admin khóa chủ đề hoặc ẩn bài, có lý do, ghi `admin_audit_logs`. Người dùng báo cáo một lần cho mỗi bài.
- **FR-09 (lưu bài):** Người dùng lưu/bỏ lưu bài (`PUT`/`DELETE /discussions/posts/:id/bookmark`, idempotent), lưu ở server (`discussion_bookmarks`) nên đồng bộ mọi thiết bị; mỗi bài trả `savedByMe`. Mục "Đã lưu" (`GET /discussions/bookmarks`, `?muc=da-luu` trên URL) liệt kê bài đã lưu, mới lưu trước. Danh sách cũ trong localStorage được chuyển lên server một lần rồi xóa. Lưu/bỏ lưu hiện thông báo góc trên bên phải.
- **FR-10 (báo cáo):** `POST /discussions/posts/:id/report {reason, note?}` với lý do cố định (spam, lừa đảo, quấy rối, thông tin sai, không phù hợp, khác). Không báo cáo bài của mình (`422`). Mỗi người một báo cáo cho một bài (`discussion_reports` unique `post_id + reporter_id`; báo lại thì cập nhật lý do). Admin xem ở `/admin/discussions` (`GET /admin/discussions/reports?status`), "Ẩn bài" (ẩn + đóng mọi báo cáo mở của bài, ghi nhật ký) hoặc "Bỏ qua", đều cần lý do ≥ 5 ký tự.
- **FR-11 (chặn):** Chặn tác giả từ menu ba chấm (dùng chung `user_blocks` với nhắn tin, `PUT /messaging/blocks/:userId`). Feed, mục đã lưu và trả lời trong mạch ẩn bài của người mình chặn và người chặn mình. Bỏ chặn ở Tin nhắn › Cài đặt.
- **FR-13 (trực tuyến):** Ảnh đại diện có chấm xanh khi tác giả đang trực tuyến. Dùng chung presence của nhắn tin (Redis `presence:online:{id}`, TTL 90 s, làm mới qua kết nối realtime). Hai chiều như nhắn tin: chỉ hiện khi cả người xem lẫn tác giả bật "hiện trạng thái hoạt động" (Tin nhắn › Cài đặt). Mỗi bài trả `authorOnline`; feed và mạch gọi `GET /discussions/presence?ids=` (≤ 50 uuid) mỗi phút khi tab đang mở.
- **FR-12 (giao diện):** Cột nội dung rộng tối đa 860 px, giữa màn hình, không viền hai bên; giữa các bài chỉ một đường kẻ. Thẻ bài ba cột: ảnh đại diện | tên · @username › chủ đề · thời gian (một dòng, chủ đề bấm để lọc, thời gian có tooltip ngày giờ đầy đủ) và nội dung ngay bên dưới | nút ba chấm riêng bên phải. Nút tương tác dồn trái; nút chỉ có icon tròn khi rê chuột. Thông báo "Đã sao chép liên kết" không kèm đường link. Mỗi bài có nút ba chấm: Sao chép liên kết, và Báo cáo + Chặn (bài người khác) hoặc Xóa (bài của mình). Diễn đàn không dùng đường dẫn Trang chủ › Diễn đàn › Chi tiết; trang chi tiết có thanh trên cùng với nút ←.
- **FR-08 (danh sách):** Trang chủ diễn đàn là bài gốc mới nhất. Lọc một chủ đề giữ cùng dạng. Phân trang bằng con trỏ thời gian, không tải cả bảng.

## Quy tắc nghiệp vụ <!-- key: business_rules -->

- **BR-01 (một chủ đề):** Bài gốc có đúng một `topic_id`. Trả lời chép `topic_id` từ bài gốc và không đổi.
- **BR-02 (chủ đề khóa):** Chủ đề `locked` hoặc `hidden` không nhận bài mới và không nhận trả lời.
- **BR-03 (chữ):** Máy chủ bỏ thẻ HTML. Chuỗi rỗng sau khi cắt khoảng trắng thì `422`.
- **BR-04 (tệp):** Ảnh `image/jpeg`, `image/png`, `image/webp`, mỗi tệp tối đa 8 MB. Video `video/mp4` tối đa 50 MB. MIME khai báo phải khớp nội dung đã tải.
- **BR-05 (một mạch):** `parent_id` phải cùng `root_id`. Không trả lời một bài đã ẩn hoặc đã xóa.
- **BR-06 (đếm):** `reply_count` và `like_count` đổi trong cùng giao dịch với việc ghi hoặc xóa.
- **BR-07 (tần suất):** 5 chủ đề một ngày, 20 bài hoặc trả lời một giờ, 30 tệp một giờ, cho mỗi người dùng.
- **BR-08 (admin):** Admin không cần là tác giả để ẩn bài. Ẩn không xóa tệp ngay. Job dọn tệp của bài đã xóa sau 7 ngày.

## Tóm tắt luồng người dùng <!-- key: user_flow_summary -->

1. Ở `/app/discussions`, người dùng thấy ô đăng và các chủ đề. Bài gốc mới nằm bên dưới.
2. Họ chọn hoặc tạo chủ đề, viết câu hỏi, gắn ảnh hoặc một video, rồi đăng.
3. Người khác mở mạch, viết trả lời. Trả lời hiện theo giờ, kèm tên người được đáp.
4. Admin mở `/admin/discussions`, thấy báo cáo chưa xử lý, khóa chủ đề hoặc ẩn bài.

Sơ đồ: `diagrams/flow-feed.mmd`, `diagrams/sequence-media.mmd`, `diagrams/state-post.mmd`.

## Bối cảnh kỹ thuật <!-- key: technical_context -->

Hình mạch bài và chỗ lưu tệp nằm trong `research.md`. Chữ và quan hệ nằm ở PostgreSQL. Tệp nằm ở MinIO, bucket riêng tư, URL đọc có hạn. Redis chỉ giữ bộ đếm tần suất. Không dùng Elasticsearch cho bản này. Không phát sự kiện trực tiếp khi có trả lời mới. Người xem tải lại mạch.

## Phụ thuộc <!-- key: dependencies -->

- `003-auth` cho phiên và tên hồ sơ trên mỗi bài.
- `004-rbac` cho `discussion:read`, `discussion:write`, `discussion:moderate` và `admin_audit_logs`.
- MinIO qua `StorageService` đã có.

## Ràng buộc <!-- key: constraints -->

- Không HTML, không phát trực tiếp, không chuyển mã video.
- Không để tệp người dùng ở URL công khai vĩnh viễn.
- Không đổi `/bai-viet`.

## Tài liệu liên quan (Artifacts) <!-- key: artifacts -->

- Diagrams: `diagrams/flow-feed.mmd`, `diagrams/sequence-media.mmd`, `diagrams/state-post.mmd`
- API Contracts: `interfaces/rest-api.yml`
- Database Schemas: `postgresql.dbml`, `redis.md`
- Technical Research: `research.md`
- Threat model: `threat-model.md`
- Data review: `data-review.md`
- UI: `ui/bang-tin.html`, `ui/mach-bai.html`, `ui/admin.html`

## Tiêu chí nghiệm thu (Acceptance Criteria) <!-- key: acceptance_criteria -->

- [ ] **AC-01:** Given người dùng tạo chủ đề slug `ho-tay`, When tạo lần nữa cùng slug, Then `409` và vẫn một dòng.
- [ ] **AC-02:** Given chủ đề đang mở, When đăng câu hỏi 2.001 ký tự, Then `422` và không có bài.
- [ ] **AC-03:** Given bài gốc đã có 4 ảnh `ready`, When gắn thêm một video, Then `422`.
- [ ] **AC-04:** Given hai người trả lời cùng mạch, When mở mạch, Then trả lời xếp theo thời gian và `reply_count` đúng.
- [ ] **AC-05:** Given tác giả xóa bài gốc, When người khác mở id đó, Then `404`.
- [ ] **AC-06:** Given admin ẩn một trả lời, When chủ mạch tải lại, Then trả lời đó không còn trong danh sách.
- [ ] **AC-07:** Given khách chưa có phiên, When gọi `GET /discussions/posts`, Then `401`.
- [ ] **AC-08:** Given A lưu một bài trên máy này, When A mở diễn đàn ở máy khác, Then bài có `savedByMe = true` và nằm trong mục "Đã lưu".
- [ ] **AC-09:** Given B chặn A, When B tải feed, Then không còn bài của A; bỏ chặn thì hiện lại.
- [ ] **AC-11:** Given tác giả đang trực tuyến và cả hai bật trạng thái hoạt động, When mở feed, Then ảnh đại diện có chấm xanh; người xem tắt thì không thấy chấm của ai.
- [ ] **AC-10:** Given B báo cáo bài của A với lý do không hợp lệ, Then `400`; người thường gọi `/admin/discussions/reports`, Then `403`; admin "Ẩn bài" thì bài khuất và báo cáo chuyển "Đã ẩn bài".

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

- Khách chưa đăng nhập có được đọc mạch bài trên trang công khai sau này không? Bản này không cho.

## Nhật ký cập nhật <!-- key: update_log -->

- 2026-11-06: Chấm trực tuyến (riêng tư hai chiều), thẻ bài ba cột kiểu Threads, bỏ viền hai bên.
- 2026-11-06: Lưu bài ở server + mục "Đã lưu", báo cáo bài + màn kiểm duyệt, chặn tác giả, menu ba chấm, bố cục cột giữa, nút ← thay đường dẫn.
- 2026-11-01: Đặc tả đầu từ yêu cầu diễn đàn kiểu Threads hoặc X, dừng ở chủ đề, bài đăng và media.
