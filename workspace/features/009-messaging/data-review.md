# Rà mô hình dữ liệu — Nhắn tin trực tiếp

Đối chiếu `postgresql.dbml` theo `02-planning-design/04-data-modeling-review.md`.

## Trường trùng và phi chuẩn có chủ đích

| Trường | Gốc | Lý do | Giữ nhất quán bằng |
| --- | --- | --- | --- |
| `conversations.last_message_preview`, `last_message_at`, `last_sender_id` | tin có `seq = last_seq` | vẽ hộp thư không cần truy vấn bảng `messages` | cập nhật trong cùng giao dịch gửi; khi thu hồi đúng tin cuối thì tính lại từ tin `visible` gần nhất |
| `conversation_participants.last_activity_at` | `conversations.last_message_at` | một chỉ mục `(user_id, last_activity_at)` đủ sắp hộp thư | cập nhật cùng giao dịch cho từng người tham gia |
| `conversations.last_seq` | `max(messages.seq)` | cấp `seq` không cần `MAX()` + khóa bảng | `UPDATE ... RETURNING` cùng giao dịch ghi tin |

Chưa lưu bộ đếm chưa đọc. `chưa đọc = last_seq - last_read_seq`, có thể sai lệch nhẹ khi tin chưa đọc bị thu hồi. Chấp nhận (Messenger và Threads cũng vậy); không bù bằng trigger.

## Null

- `messages.reply_to_seq` trống khi không trả lời. Khi có, khóa ngoại ghép `(conversation_id, reply_to_seq)` bắt buộc (khai trong migration).
- `shared_post_id` khác trống khi và chỉ khi `kind = post_share` (CHECK).
- `message_attachments.message_seq` trống lúc `pending`; job dọn các dòng `pending` quá 24 giờ.
- `conversations.direct_key` trống với nhóm. Unique của PostgreSQL cho phép nhiều null.
- `conversation_participants.hidden_at`, `left_at`, `muted_until` trống là trạng thái bình thường.

## Quan hệ

Một hội thoại nhiều người tham gia, nhiều tin. Một tin nhiều ảnh (tối đa 4), nhiều cảm xúc (mỗi người một). Chặn là quan hệ có hướng `(blocker, blocked)`. Báo cáo chụp lại ngữ cảnh, không giữ khóa ngoại tới nhiều tin, để xóa tin hay xóa hội thoại sau này không làm mất bằng chứng (chính sách giữ báo cáo 180 ngày).

Người dùng bị xóa mềm (`users.deleted_at`): giữ nguyên `sender_id`; API trả `sender: { displayName: "Người dùng đã xóa", avatarUrl: null }`. Người đó bị đặt `left_at` ở mọi hội thoại.

## Truy vấn và chỉ mục

| Truy vấn | Chỉ mục |
| --- | --- |
| Hộp thư: hội thoại của tôi, sắp mới nhất | `idx_participants_user_activity`. Migration nên tạo chỉ mục một phần: `(user_id, last_activity_at DESC) WHERE hidden_at IS NULL AND left_at IS NULL`. Lọc Inbox / Requests dùng `conversations.state` và `initiator_id`, cần join `conversations` theo khóa chính (đủ nhanh ở vài trăm hội thoại mỗi người; theo dõi EXPLAIN) |
| Tải 30 tin mới nhất: `WHERE conversation_id = $1 AND seq < $2 ORDER BY seq DESC LIMIT 30` | khóa chính `(conversation_id, seq)`, quét ngược theo chỉ mục |
| Tin mới hơn mốc: `seq > $2 ORDER BY seq ASC LIMIT 100` | khóa chính |
| Chống gửi trùng | `uk_messages_client_msg` |
| Tìm tin theo id trong URL | `uk_messages_conversation_id_id` |
| Tìm hoặc tạo hội thoại 1-1 | `direct_key` unique; `INSERT ... ON CONFLICT (direct_key) DO NOTHING RETURNING` rồi `SELECT` |
| Số hội thoại chưa đọc | `SELECT count(*) FROM participants p JOIN conversations c ... WHERE p.user_id = $1 AND c.last_seq > p.last_read_seq AND ...` — bị chặn bởi số hội thoại của một người; cache `msg:unread` |
| Tìm người để nhắn | truy vấn trên `users` (đã có chỉ mục 003-auth), tiền tố `display_name`; giới hạn 10 dòng; chưa cần Elasticsearch |

Không có truy vấn nào cần quét cả bảng `messages`. Mọi truy vấn trên `messages` có `conversation_id` ở vế đầu (điều kiện cần để partition sau này).

## Giao dịch gửi tin (thứ tự để tránh deadlock)

1. Đọc ngoài khóa: hội thoại, trạng thái, chặn, cài đặt người nhận.
2. `BEGIN`.
3. `UPDATE conversations SET last_seq = last_seq + 1, ... WHERE id = $1 RETURNING last_seq, state` (khóa dòng hội thoại đầu tiên, luôn theo thứ tự hội thoại → participants).
4. Kiểm lại `state` và điều kiện BR (đọc từ kết quả bước 3).
5. `INSERT messages ... ON CONFLICT (conversation_id, sender_id, client_msg_id) DO NOTHING RETURNING`. Nếu không trả dòng: `ROLLBACK`, đọc tin cũ, trả lại (200).
6. Gắn ảnh: `UPDATE message_attachments SET message_seq = $seq WHERE id = ANY($ids) AND uploader_id = $me AND status = 'ready' AND message_seq IS NULL AND conversation_id = $1`; số dòng phải bằng số ảnh, không thì `ROLLBACK`.
7. `UPDATE conversation_participants` cho mọi người: `last_activity_at`, `hidden_at = NULL`; người gửi: `last_read_seq = seq`.
8. `COMMIT`; sau đó mới `PUBLISH`.

Chỉ một khóa dòng hội thoại được giữ; participants cập nhật theo thứ tự `user_id` tăng dần để tránh deadlock khi hai giao dịch khác nhau cùng cập nhật (nhóm sau này).

## Quy mô

Ước lượng thô (kiểm lại bằng số đo): một tin ≈ 300–600 byte dòng + chỉ mục (khóa chính, `uk_conversation_id_id`, `uk_client_msg`) ≈ 1 KB. 1 triệu tin mỗi ngày ≈ 1 GB mỗi ngày ≈ 365 GB mỗi năm. Dấu hiệu chuyển bậc (xem `scaling-roadmap.md`): bảng `messages` vượt khoảng 200 triệu dòng hoặc bộ chỉ mục không còn nằm trong RAM.

Bản đầu không partition. Khi cần: `PARTITION BY HASH (conversation_id)` thành 16–64 partition; không đổi khóa chính, không đổi truy vấn. `uk_messages_conversation_id_id` hợp lệ vì chứa khóa partition. `idx_messages_sender_created` không chứa khóa partition nên mất tính duy nhất toàn cục nhưng vẫn dùng được mỗi partition; có thể bỏ và điều tra theo người gửi bằng job riêng.

## Nhất quán

- `seq` liên tục trong hội thoại vì cấp trong giao dịch có khóa; giao dịch rollback hoàn trả `last_seq` (nằm trong cùng giao dịch). Client vẫn không được cho rằng `seq` luôn liên tục tuyệt đối (một thay đổi tương lai có thể bỏ số); lỗ hổng chỉ là tín hiệu "hãy tải lại".
- Hai request gửi cùng `clientMsgId`: một dòng nhờ khóa duy nhất.
- Hai người cùng tạo hội thoại: một dòng nhờ `direct_key`.
- `last_read_seq` chỉ tăng (`GREATEST`), thiết bị chậm không kéo lùi.
