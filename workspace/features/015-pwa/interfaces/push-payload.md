# Hợp đồng payload push và thông điệp trang ↔ service worker

## Payload Web Push (máy chủ → service worker)

JSON UTF-8, mã hóa `aes128gcm` (RFC 8291), tối đa **3.000 byte** (giới hạn giao thức 4.078). Nội dung chỉ là văn bản thuần.

```json
{
  "v": 1,
  "id": "0192f3a8-7c5e-7a41-b0c7-3f6a1a9d2e10",
  "type": "follow.new",
  "title": "Nguyễn An đã theo dõi bạn",
  "body": "Xem hồ sơ của Nguyễn An",
  "url": "/app/profile/0192f3a8-…",
  "tag": "follow.new",
  "icon": "/icons/icon-192.png",
  "badge": "/icons/badge-96.png",
  "ts": 1793577600000,
  "unread": 3,
  "renotify": false,
  "generic": false
}
```

| Trường | Bắt buộc | Quy tắc |
| --- | --- | --- |
| `v` | có | Số nguyên; SW bỏ qua trường lạ, nếu `v` lớn hơn mức đã biết vẫn hiển thị `title`/`body`/`url` |
| `id` | không | Id thông báo; thiếu với push gộp ("Bạn có N thông báo mới") |
| `type` | có | Khóa loại (chỉ để phân tích) |
| `title` | có | ≤ 120 ký tự |
| `body` | không | ≤ 200 ký tự |
| `url` | có | Đường dẫn tương đối `/app/...` hoặc `/admin/...`; SW kiểm lại, sai thì dùng `/app/notification` |
| `tag` | không | Nhóm thay thế thông báo cũ cùng `tag` trên thiết bị; mặc định theo `Topic` |
| `icon`, `badge` | không | Đường dẫn trong `/icons/`; ngoài đó bị thay bằng icon mặc định |
| `ts` | không | Mili giây; đưa vào `timestamp` của thông báo |
| `unread` | không | Dùng cho huy hiệu ứng dụng |
| `renotify` | không | Mặc định `false` để không rung/phát âm với mỗi cập nhật cùng `tag` |
| `generic` | không | `true` khi người dùng chọn ẩn nội dung hoặc push gộp |

SW tạo `showNotification(title, { body, icon, badge, tag, timestamp, renotify, data: { id, url }, requireInteraction: false, silent: false })`. Không đặt `requireInteraction` (làm phiền), không dùng `actions` ở giai đoạn 1 (iOS không hỗ trợ).

Tiêu đề HTTP khi gửi (RFC 8030): `TTL` theo loại (bảo mật 24 giờ… tin xã hội 1 giờ), `Urgency` (`high` cho bảo mật/thanh toán lỗi, `normal` còn lại, `low` cho tin xã hội gộp), `Topic` ≤ 32 ký tự cho thông báo thay thế được.

## Thông điệp trang → SW

| `type` | Dữ liệu | Tác dụng |
| --- | --- | --- |
| `SKIP_WAITING` | — | Kích hoạt SW mới (sau khi người dùng đồng ý) |
| `LOGOUT` | — | Đóng thông báo hiển thị, xóa huy hiệu, xóa bộ nhớ đệm riêng tư |
| `BADGE` | `{ count }` | Đặt/xóa huy hiệu (SW cũng có quyền gọi `setAppBadge`) |

## Thông điệp SW → trang

| `type` | Dữ liệu | Tác dụng |
| --- | --- | --- |
| `navigate` | `{ url, id? }` | Trang gọi `router.push(url)` (sau khi kiểm `url` cùng origin) và đánh dấu đã đọc |
| `resubscribe` | — | Trang đăng ký push lại và gọi API cập nhật |
| `push-received` | `{ id, type }` | (tùy chọn) trang đồng bộ danh sách khi đang mở |

Trang chỉ chấp nhận thông điệp từ `navigator.serviceWorker` (không từ `window.postMessage` lạ) và kiểm `event.origin`/`source`.
