# Theo dõi người dùng (Follow)

**Feature ID:** 011-follow
**Status:** In Progress
**Last Updated:** 2026-11-02

## Tổng quan <!-- key: overview -->

Người dùng đã đăng nhập theo dõi và bỏ theo dõi lẫn nhau. Mỗi hồ sơ hiện số người theo dõi, số người đang theo dõi, nút Theo dõi, và danh sách hai chiều. Diễn đàn có thêm tab "Đang theo dõi" chỉ gồm bài của những người mình theo dõi. Nhắn tin dùng quan hệ này để bỏ qua bước "Yêu cầu nhắn": người mình đã được theo dõi bởi người kia nhắn thẳng vào Inbox. Theo dõi là quan hệ **có hướng, công khai, không cần chấp nhận**.

## Mục tiêu & Phạm vi <!-- key: goals_scope -->

**In scope:**

- Theo dõi và bỏ theo dõi (idempotent); chặn tự theo dõi.
- Số người theo dõi / đang theo dõi trên hồ sơ, tính bằng bộ đếm trong cùng giao dịch.
- Danh sách người theo dõi và danh sách đang theo dõi, phân trang con trỏ, mới nhất trước, mỗi dòng kèm trạng thái quan hệ với người xem.
- API quan hệ theo lô cho giao diện.
- Tab "Đang theo dõi" ở diễn đàn `/feed`.
- Tích hợp chặn: chặn xóa theo dõi hai chiều và cấm theo dõi; tích hợp nhắn tin (người theo dõi mình nhắn thẳng vào Inbox).
- Giới hạn tần suất và trần số người đang theo dõi.
- Dữ liệu mẫu cho môi trường dev.

**Out of scope (để chỗ sẵn):**

- Tài khoản khóa và yêu cầu theo dõi cần duyệt (Mastodon `follow_requests`).
- Bỏ một người ra khỏi danh sách người theo dõi của mình (`remove_from_followers`), tắt tiếng, danh sách tùy chọn.
- Thông báo "A đã theo dõi bạn", gợi ý theo dõi, "người theo dõi chung".
- Ẩn danh sách theo dõi của mình; bảng tin xếp hạng thuật toán.
- Khách chưa đăng nhập xem danh sách.

## Đối tượng liên quan <!-- key: actors -->

- Người dùng đã đăng nhập (kể cả admin): theo dõi, bỏ theo dõi, xem danh sách.
- Hệ thống: dọn quan hệ khi chặn; (sau này) đối soát bộ đếm.

## Yêu cầu chức năng <!-- key: functional_requirements -->

- **FR-01 (theo dõi):** `PUT /users/{userId}/follow` tạo quan hệ. Gọi lặp trả cùng kết quả, không đổi bộ đếm. Mã `200` kèm trạng thái mới.
- **FR-02 (bỏ theo dõi):** `DELETE /users/{userId}/follow` xóa quan hệ, idempotent.
- **FR-03 (tự theo dõi):** theo dõi chính mình bị `422`.
- **FR-04 (đối tượng hợp lệ):** người bị theo dõi phải tồn tại, `active`, chưa xóa. Ngược lại `404`.
- **FR-05 (chặn):** nếu một bên chặn bên kia (hai chiều) thì theo dõi bị `403 cannot_follow_user`, cùng phản hồi cho cả hai hướng chặn. Khi A chặn B, mọi quan hệ A→B và B→A bị xóa.
- **FR-06 (trạng thái):** `GET /users/{userId}/follow` trả `followerCount`, `followingCount`, `following` (mình theo dõi họ), `followedBy` (họ theo dõi mình), `self`.
- **FR-07 (danh sách):** `GET /users/{userId}/followers` và `/following`, mới nhất trước, con trỏ `(created_at, follower_id)`, tối đa 50 mỗi trang. Mỗi dòng: `id`, `displayName`, `username`, `avatarUrl`, `followedByMe`, `followsMe`. Chỉ tài khoản `active`.
- **FR-08 (quan hệ theo lô):** `GET /follow/relationships?ids=a,b,c` (≤ 50 id) trả quan hệ của mình với từng người.
- **FR-09 (bảng tin theo dõi):** `GET /discussions/posts?scope=following` chỉ trả bài gốc `visible` của người mình theo dõi.
- **FR-10 (nhắn tin):** khi A mở hội thoại mới với B và B đang theo dõi A thì hội thoại là `active` ngay, không vào Requests của B.
- **FR-11 (giao diện):** nút Theo dõi / Đang theo dõi ở hồ sơ và trong danh sách; hai bộ đếm bấm mở danh sách; tab "Đang theo dõi" ở diễn đàn.
- **FR-12 (quyền):** `follow:read` và `follow:write` cho người dùng đã đăng nhập (admin kế thừa). Khách `401`.

## Quy tắc nghiệp vụ <!-- key: business_rules -->

- **BR-01 (một cạnh):** một cặp `(follower, followee)` tối đa một dòng (khóa chính).
- **BR-02 (bộ đếm):** `follower_count` và `following_count` đổi cùng giao dịch với dòng quan hệ; không bao giờ âm. Chỉ đổi khi dòng thật sự được thêm hoặc xóa (`ON CONFLICT DO NOTHING`, `DELETE ... RETURNING`).
- **BR-03 (trần):** mỗi người theo dõi tối đa 5.000 người (cấu hình). Vượt thì `409 limit_reached`.
- **BR-04 (tần suất):** 60 lần theo dõi/bỏ theo dõi mỗi giờ mỗi người; Redis lỗi thì từ chối ghi (`503`).
- **BR-05 (khóa):** hai hàng bộ đếm khi cập nhật luôn khóa theo thứ tự `user_id` tăng dần để tránh deadlock.
- **BR-06 (riêng tư):** danh sách công khai với người đã đăng nhập; không lộ email; chỉ `id`, tên, `username`, ảnh.
- **BR-07 (tài khoản bị khóa/xóa):** không xuất hiện trong danh sách và không theo dõi được; số đếm có thể lệch tạm thời cho tới khi đối soát (xem research, quyết định 3).
- **BR-08 (nhắn tin):** theo dõi không thay thế chặn: bị chặn vẫn bị chặn. Theo dõi chỉ bỏ bước yêu cầu cho hội thoại mới.

## Tóm tắt luồng người dùng <!-- key: user_flow_summary -->

1. Linh mở hồ sơ Hùng, thấy "120 người theo dõi · 80 đang theo dõi" và nút **Theo dõi**. Bấm: nút đổi ngay thành **Đang theo dõi** (cập nhật lạc quan), bộ đếm tăng 1.
2. Linh bấm số người theo dõi để xem danh sách, theo dõi thêm người từ chính danh sách đó.
3. Ở diễn đàn, Linh chọn tab **Đang theo dõi** để đọc bài của những người đã theo dõi.
4. Hùng đang theo dõi Linh nên khi Linh nhắn cho Hùng lần đầu, tin vào thẳng Inbox của Hùng.
5. Linh chặn Hùng: hai bên tự bỏ theo dõi nhau và không theo dõi lại được.

Sơ đồ: `diagrams/sequence-follow.mmd`, `diagrams/flow-block-interaction.mmd`.

## Bối cảnh kỹ thuật <!-- key: technical_context -->

- PostgreSQL là nguồn sự thật: bảng cạnh `user_follows` có chỉ mục theo hai chiều (xem `research.md` quyết định 1) và bảng bộ đếm `user_follow_stats` (quyết định 2). Không dùng cơ sở dữ liệu đồ thị riêng.
- Redis chỉ dùng cho giới hạn tần suất.
- Bảng tin theo dõi dùng truy vấn kéo (fan-out on read) với `EXISTS` trên `user_follows` (quyết định 4).
- Module backend `follow` xuất `FollowService` để `messaging` dùng (`isFollowing`, `removeBetween`).
- Lộ trình mở rộng trong `research.md`.

## Phụ thuộc <!-- key: dependencies -->

- `003-auth`: người dùng và hồ sơ (`username`, `display_name`, `avatar_url`).
- `004-rbac`: quyền `follow:read`, `follow:write`.
- `008-discussions`: tab Đang theo dõi.
- `009-messaging`: chặn (`user_blocks`) và luật Requests.

## Ràng buộc <!-- key: constraints -->

- Không thêm dịch vụ hạ tầng mới.
- Không tính số đếm bằng `COUNT(*)` trên đường đọc hồ sơ.
- Danh sách luôn phân trang theo con trỏ, không offset.

## Tài liệu liên quan (Artifacts) <!-- key: artifacts -->

- Nghiên cứu: `research.md`
- Dữ liệu: `postgresql.dbml`
- API: `interfaces/rest-api.yml`
- Bảo mật: `threat-model.md`
- Giao diện: `ui/ui-spec.md`
- Sơ đồ: `diagrams/`
- Mã nguồn: `backend/src/modules/follow/`, `website/src/features/follow/`

## Tiêu chí nghiệm thu (Acceptance Criteria) <!-- key: acceptance_criteria -->

- [ ] **AC-01:** Given A chưa theo dõi B, When A gọi `PUT /users/B/follow` hai lần, Then cả hai `200`, B có `followerCount` tăng đúng 1 và A có `followingCount` tăng đúng 1.
- [ ] **AC-02:** Given A theo dõi B, When `DELETE` hai lần, Then bộ đếm giảm đúng 1 và không âm.
- [ ] **AC-03:** Given A tự theo dõi A, Then `422`.
- [ ] **AC-04:** Given B đã chặn A (hoặc ngược lại), When A theo dõi B, Then `403 cannot_follow_user`.
- [ ] **AC-05:** Given A và B theo dõi nhau, When A chặn B, Then cả hai quan hệ bị xóa và bộ đếm của cả hai giảm đúng.
- [ ] **AC-06:** Given 10 người theo dõi B cùng lúc, When đọc `followerCount` của B, Then bằng đúng 10.
- [ ] **AC-07:** Given B có 120 người theo dõi, When gọi `/followers?limit=50` ba lần theo con trỏ, Then nhận 50, 50, 20 dòng, không trùng, mới nhất trước.
- [ ] **AC-08:** Given tài khoản bị khóa theo dõi B, When xem danh sách người theo dõi của B, Then tài khoản đó không xuất hiện.
- [ ] **AC-09:** Given A theo dõi B, C không theo dõi ai, When A gọi `/discussions/posts?scope=following`, Then chỉ có bài của B; C gọi thì rỗng.
- [ ] **AC-10:** Given B theo dõi A, When A mở hội thoại mới với B và gửi tin, Then B thấy ở Inbox, không ở Requests; nếu B không theo dõi A thì vào Requests.
- [ ] **AC-11:** Given khách chưa đăng nhập, When gọi bất kỳ route follow, Then `401`.
- [ ] **AC-12:** Given 61 lần theo dõi/bỏ theo dõi trong một giờ, When lần thứ 61, Then `429` có `error.details.retryAfter`.
- [ ] **AC-13:** Given trang hồ sơ, When bấm Theo dõi, Then nút đổi trong dưới 100 ms (lạc quan), và quay lại trạng thái cũ kèm thông báo nếu API lỗi.

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

- Có cần tài khoản khóa (duyệt yêu cầu theo dõi) ở giai đoạn sau? Đề xuất: thêm bảng `follow_requests` như Mastodon, không đổi `user_follows`.
- Có hiện thông báo "đã theo dõi bạn" khi tính năng notification sẵn sàng? Đã có loại `follow.new` (gộp theo `collapseKey`) trong danh mục của `014-notification`; nối producer ở bước triển khai.

## Nhật ký cập nhật <!-- key: update_log -->

- 2026-11-02: Đặc tả đầu và triển khai bản đầu (theo dõi, danh sách, bảng tin theo dõi, tích hợp chặn và nhắn tin).
