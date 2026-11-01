# Technical Research — Theo dõi người dùng

Nguồn tham khảo (kiểm tra 02/11/2026):

- Twitter, [FlockDB](https://github.com/twitter-archive/flockdb) và [bài giới thiệu](https://blog.x.com/engineering/en_us/a/2010/introducing-flockdb): đồ thị theo dõi là danh sách kề rất lớn, không cần duyệt đồ thị; mỗi cạnh có `source`, `destination`, trạng thái và một vị trí sắp xếp (dùng timestamp để "mới theo dõi" lên đầu); mỗi cạnh được lưu **hai lần** (xuôi và ngược) để truy vấn được từ cả hai đầu bằng một chỉ mục; phân vùng theo nút. Kho lưu này đã bị lưu trữ (archived), chỉ lấy ý tưởng.
- Mastodon, [Accounts API](https://docs.joinmastodon.org/methods/accounts/): `follow` idempotent (gọi lại chỉ cập nhật tùy chọn); theo dõi người chặn mình hoặc bị mình chặn trả `403`; `unfollow` thành công cả khi chưa theo dõi; danh sách followers/following phân trang bằng cursor (`Link` header, mặc định 40, tối đa 80) vì id cạnh không lộ ra; có API **quan hệ theo lô** (`/accounts/relationships`) cho giao diện; có `follow_requests` cho tài khoản khóa. Lược đồ cơ sở dữ liệu của Mastodon (`follows`, `follow_requests`, `account_stats`) không đọc được từ nguồn này, nên các tên bảng của ta là thiết kế riêng, chỉ cùng ý tưởng.

Không có con số công suất ở đây là số đo của dự án này.

---

## Bản ghi quyết định 1 — Bảng cạnh trong PostgreSQL, chỉ mục hai chiều <!-- key: decision_record -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Cần lưu ai theo dõi ai và trả lời ba câu hỏi rẻ: "A có theo dõi B?", "những ai theo dõi B (mới nhất trước)?", "A theo dõi những ai?".

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Bảng `user_follows(follower_id, followee_id, created_at)`, khóa chính `(follower_id, followee_id)` + chỉ mục `(followee_id, created_at, follower_id)` | Dùng PostgreSQL sẵn có | Một bảng, truy vấn đơn giản | Dễ chuyển sang kho khác, API không đổi | Cùng ý tưởng cạnh lưu hai chiều của FlockDB, nhưng dùng hai chỉ mục thay vì ghi hai dòng |
| Cơ sở dữ liệu đồ thị (Neo4j) | Chưa có | Thêm vận hành | Khó | Không cần duyệt đồ thị |
| Mảng id trong hàng người dùng | Đơn giản | Không phân trang được, cập nhật tranh chấp | Khó | Loại |

### Quyết định <!-- key: decision -->

Bảng cạnh một dòng mỗi quan hệ. Khóa chính phục vụ "A có theo dõi B" và "A theo dõi những ai" (`follower_id` ở vế đầu); chỉ mục `(followee_id, created_at DESC, follower_id DESC)` phục vụ "ai theo dõi B". Hai danh sách dùng cùng kiểu cursor `(created_at, id)`.

### Hệ quả <!-- key: consequences -->

Ghi một dòng, hai chỉ mục. Khi bảng vượt hàng trăm triệu dòng, phân vùng hash theo `followee_id` cho chỉ mục ngược cần bảng thứ hai (đúng ý tưởng ghi hai lần của FlockDB); chuyển đổi này nằm sau lớp service.

### Khả năng đảo ngược <!-- key: reversibility -->

Giao diện và API chỉ nói chuyện qua `FollowService`; thay kho lưu không đổi hợp đồng.

---

## Bản ghi quyết định 2 — Bộ đếm lệch chuẩn trong bảng riêng, cập nhật cùng giao dịch <!-- key: decision_record -->

**Status:** Accepted
**Category:** Performance & Scale
**Door Type:** Two-way

### Bối cảnh <!-- key: context -->

Hồ sơ nào cũng hiện hai con số. `COUNT(*)` trên bảng cạnh lớn là đường đọc chậm và nóng.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Bảng `user_follow_stats(user_id, follower_count, following_count)` cập nhật trong giao dịch theo dõi | Giống `reply_count`, `like_count` ở 008 | Đơn giản, đúng tức thì | Dễ | Hai hàng bị khóa mỗi lần theo dõi; khóa theo thứ tự id |
| Thêm cột vào `users` | Chạm bảng của 003-auth | Trộn mối quan tâm | Dễ | Gây khóa dòng lên hàng người dùng nóng |
| Đếm khi đọc, đệm Redis | Thêm trạng thái | Cần vô hiệu hóa đệm | Dễ | Đệm có thể sai sau lỗi Redis |

### Quyết định <!-- key: decision -->

Bảng riêng. Chỉ đổi bộ đếm khi dòng cạnh thật sự được thêm/xóa. Người nổi tiếng (nhiều người theo dõi cùng lúc) sẽ nghẽn trên một hàng; chấp nhận ở quy mô này, và có đường nâng cấp (đếm theo lô qua hàng đợi, hoặc đếm cắt phân mảnh).

### Hệ quả <!-- key: consequences -->

Cần job đối soát (đếm lại từ bảng cạnh) khi nghi ngờ lệch; chưa làm ở bản đầu, nhưng truy vấn đối soát được ghi ở `postgresql.dbml`.

### Khả năng đảo ngược <!-- key: reversibility -->

Xóa bảng và đổi `FollowService.stats()` sang `COUNT(*)` là đủ.

---

## Bản ghi quyết định 3 — Không có "yêu cầu theo dõi" ở bản đầu, tài khoản bị khóa lọc khi đọc <!-- key: decision_record -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** Two-way

### Bối cảnh <!-- key: context -->

Mastodon có tài khoản khóa và `follow_requests`. Sản phẩm là sàn bất động sản, hồ sơ vốn công khai.

### Quyết định <!-- key: decision -->

Theo dõi không cần duyệt. Nếu sau này cần tài khoản khóa thì thêm bảng `follow_requests` và cờ `is_locked`, không đổi `user_follows`. Tài khoản bị khóa hoặc xóa không bị xóa quan hệ ngay mà bị lọc ở danh sách (`status = active`); bộ đếm có thể lệch cho tới khi đối soát.

### Hệ quả <!-- key: consequences -->

Đơn giản, nhưng không có tính năng kiểm soát ai được theo dõi ngoài chặn.

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ thêm yêu cầu theo dõi.

---

## Bản ghi quyết định 4 — Bảng tin theo dõi bằng truy vấn kéo <!-- key: decision_record -->

**Status:** Accepted
**Category:** Performance & Scale
**Door Type:** Two-way

### Bối cảnh <!-- key: context -->

Tab "Đang theo dõi" cần bài của những người mình theo dõi. Hai cách kinh điển: đẩy (fan-out on write, ghi bài vào hộp thư của mọi người theo dõi) hoặc kéo (fan-out on read).

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Kéo: `WHERE EXISTS (SELECT 1 FROM user_follows WHERE follower_id = $me AND followee_id = post.author_id)` | Dùng chỉ mục sẵn có, không thêm bảng | Một truy vấn | Dễ | Đủ tốt tới khi ai đó theo dõi hàng nghìn người |
| Đẩy: bảng `timeline_entries` ghi lúc đăng bài | Cần hàng đợi/việc nền | Ghi khuếch đại với người có nhiều người theo dõi | Trung bình | Chỉ cần khi đọc quá chậm |

### Quyết định <!-- key: decision -->

Kéo. Ngưỡng chuyển sang đẩy (hoặc lai: đẩy cho người ít người theo dõi, kéo cho người nổi tiếng) khi truy vấn tab theo dõi vượt ~200 ms p95 ở tải thật.

### Hệ quả <!-- key: consequences -->

Truy vấn dùng `idx_discussion_posts_visible_roots` và khóa chính của `user_follows`; trần 5.000 người theo dõi giữ chi phí có hạn.

### Khả năng đảo ngược <!-- key: reversibility -->

Thêm bảng hộp thư và chuyển truy vấn; giao diện không đổi.

---

## Lộ trình mở rộng

| Bậc | Dấu hiệu | Thay đổi |
| --- | --- | --- |
| 1 (bản đầu) | — | Bảng cạnh + bảng đếm trong PostgreSQL, kéo bảng tin |
| 2 | `user_follows` > ~100 triệu dòng, hàng đếm nóng | Đếm theo lô bằng hàng đợi; bản sao đọc cho danh sách; job đối soát |
| 3 | Bảng tin theo dõi chậm | Hộp thư đẩy cho tác giả nhỏ, kéo cho tác giả lớn; ghi cạnh hai chiều như FlockDB, phân vùng hash theo nút |
