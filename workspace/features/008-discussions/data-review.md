# Rà mô hình dữ liệu — Diễn đàn hỏi đáp

Đối chiếu `postgresql.dbml` theo `02-planning-design/04-data-modeling-review.md`.

## Trường trùng

`topic_id` có cả trên bài gốc và trên trả lời. Đây là bản sao có chủ đích để lọc theo chủ đề không cần nối lại bài gốc. Giao dịch đăng trả lời phải chép từ bài gốc, không nhận `topic_id` từ client.

`reply_count` và `like_count` là bộ đếm lệch chuẩn. Chúng nằm trong cùng giao dịch với dòng trả lời hoặc dòng thích. Đọc danh sách không đếm lại cả bảng.

## Null

`root_id` và `parent_id` trống chỉ khi dòng là bài gốc. Ràng buộc kiểm tra: bài gốc thì cả hai trống và `kind` là `question` hoặc `note`. Trả lời thì cả hai có giá trị và `kind` là `reply`.

`discussion_media.post_id` trống lúc tệp còn `pending`. Gắn bài xong thì không trống.

## Quan hệ

Một chủ đề nhiều bài gốc. Một bài gốc nhiều trả lời qua `root_id`. `parent_id` không tạo cây sâu trên giao diện. Một bài nhiều tệp. Một lượt thích là cặp `(post_id, user_id)`.

Xóa người dùng đi theo `users`. Xóa bài không xóa tệp ngay. Job dọn object sau 7 ngày.

## Truy vấn và chỉ mục

Danh sách bài gốc lọc `root_id IS NULL` và `status = visible`, sắp `created_at`. Chỉ mục `(topic_id, created_at)` phục vụ lọc chủ đề. Nên thêm chỉ mục một phần `created_at DESC WHERE root_id IS NULL AND status = 'visible'` khi viết migration, vì dbml không diễn tả đủ mệnh đề `WHERE`.

Mạch bài dùng `(root_id, created_at)`.

## Quy mô

Bản này không tách bảng theo thời gian. Khi mạch vượt vài triệu dòng, cắt theo tháng là việc sau, không đổi khóa. Elasticsearch chưa cần vì chưa có tìm toàn văn.

## Nhất quán

Đếm trả lời tăng trên bài gốc, không trên từng trả lời. Thích tăng trên đúng bài được thích. Hai request thích cùng lúc chỉ một dòng vì khóa duy nhất `(post_id, user_id)`.
