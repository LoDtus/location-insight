# Redis — Diễn đàn hỏi đáp

Redis không giữ bài viết. Chỉ đếm tần suất, cửa sổ trượt bằng `INCR` và `EXPIRE` như đơn thanh toán.

| Khóa | Cửa sổ | Ngưỡng |
| --- | --- | --- |
| `discussion:topic:{userId}` | 24 giờ | 5 |
| `discussion:post:{userId}` | 1 giờ | 20 |
| `discussion:media:{userId}` | 1 giờ | 30 |

Vượt ngưỡng trả `429`. Lỗi Redis lúc ghi thì từ chối ghi, không mở không giới hạn.
