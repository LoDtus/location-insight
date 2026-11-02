# Giao diện — thông báo (014-notification)

Dùng chung component cho `/app/notification` (root `/app`) và `/admin/notification` (root `/admin`); giữ token hiện có (`green/cream/charcoal`, nền trắng, bo `rounded-lg`, bóng nhẹ) và cấu trúc `AppSidebar surface="app|admin"`.

## Sidebar

- Thêm mục **Thông báo** (icon `Bell`) vào `AppSidebar` cho cả hai bề mặt, đặt dưới "Tin nhắn", trước nhóm quản trị. `href` = `${root}/notification`. Active theo `isItemActive`.
- Huy hiệu số chưa đọc bên phải nhãn (hoặc góc trên phải icon khi sidebar thu gọn): `1`…`99`, `99+` khi `capped`. Ẩn khi 0. Nền `danger` hoặc `green` đậm, chữ trắng, tương phản ≥ 4.5:1. `aria-label="Thông báo, 3 chưa đọc"`.
- Số lấy từ `NotificationProvider` (đặt cạnh `MessagingProvider` trong `app/layout.tsx` và `admin/layout.tsx`): một lần `GET unread-count` khi vào, sau đó nhận `notification.unread/created/changed` qua socket; không polling khi socket đang nối.
- Cập nhật `document.title` thành `(3) Thông báo · Địa Thế` khi có chưa đọc và tab bị ẩn; gọi `navigator.setAppBadge(n)` khi đã cài PWA và có hỗ trợ (`clearAppBadge` khi 0).

## Bố cục trang (desktop)

```
┌─────────┬───────────────────────────────────────────────────────────┐
│ Sidebar │  Thông báo                       [Đánh dấu tất cả đã đọc] │
│  …      │  [Tất cả] [Chưa đọc 3]                         [⚙ Cài đặt] │
│ ● Thông │  ┌─ Thẻ gợi ý bật thông báo đẩy (khi chưa bật) ─────────┐ │
│   báo 3 │  └─────────────────────────────────────────────────────┘ │
│         │  ● (icon)  Nguyễn An đã theo dõi bạn          2 phút ⋯   │
│         │            Xem hồ sơ của Nguyễn An                       │
│         │    (icon)  Thanh toán thành công              Hôm qua ⋯  │
│         │            Gói Nâng cao – 12/11/2026                      │
│         │  …  (cuộn vô hạn)                                         │
└─────────┴───────────────────────────────────────────────────────────┘
```

Nội dung tối đa `max-w-3xl` căn giữa trong vùng chính; trên điện thoại (< 1024 px) sidebar ẩn như các trang khác, danh sách chiếm toàn bề rộng, tiêu đề dính trên cùng.

## Một dòng thông báo (`notification-item`)

| Phần | Quy tắc |
| --- | --- |
| Icon đại diện | Hình tròn 40 px, nền theo `tone` (neutral/info/success/warning/danger, dùng token có sẵn, tương phản chữ ≥ 4.5:1), icon lucide từ bảng ánh xạ `icon` → component; khóa lạ rơi về `Bell`. Không tải ảnh từ ngoài. |
| Tiêu đề | `title`, 1 dòng, cắt `…`; **đậm** khi chưa đọc, thường khi đã đọc. Khi `count > 1` hiển thị đã gộp theo mẫu của máy chủ (không ghép chuỗi ở client). |
| Phụ đề | `subtitle`, tối đa 2 dòng (`line-clamp-2`), màu phụ. Ẩn khi rỗng. |
| Thời điểm | `<time dateTime=…>` hiển thị tương đối bằng `Intl.RelativeTimeFormat('vi')` ("2 phút trước", "Hôm qua"); quá 7 ngày hiển thị ngày; `title`/tooltip và `aria-label` có thời điểm đầy đủ theo múi giờ người dùng. Làm mới nhãn mỗi 60 giây chỉ cho các dòng đang hiển thị (một bộ hẹn giờ dùng chung). |
| Trạng thái đọc | Chưa đọc: chấm tròn `green` 8 px bên trái + nền nhạt + chữ đậm. Đã đọc: không chấm, nền trắng. Không chỉ dựa vào màu (có chấm và độ đậm); trình đọc màn hình đọc "Chưa đọc" bằng chữ ẩn trực quan. |
| Nhấn vào dòng | Toàn bộ vùng nội dung là một `<a>` (`next/link`) tới `link`; nhấn → điều hướng và `PUT read` (lạc quan, bỏ qua khi đã đọc). Nhấn giữa/Ctrl+nhấn mở tab mới như liên kết thường. |
| Menu "⋯" | Nút riêng, không lồng trong `<a>`: "Đánh dấu đã đọc" / "Đánh dấu chưa đọc", "Xóa". Trên thiết bị không có hover luôn hiển thị; trên desktop hiện khi hover/focus. Vùng chạm ≥ 44 px (điện thoại). `aria-haspopup="menu"`, Esc đóng, trả focus. |
| Xóa | Lạc quan: dòng thu gọn trong 150 ms và hiện thanh "Đã xóa · Hoàn tác" 5 giây. Máy chủ chỉ nhận `DELETE` sau 5 giây nếu người dùng không hoàn tác (hoãn phía client); đóng tab trong lúc chờ thì gửi ngay bằng `sendBeacon`/`keepalive`. |

## Hành vi danh sách

- **Tải:** 20 dòng đầu; khung xương (5 dòng) khi tải. Cuộn vô hạn bằng `IntersectionObserver` cách đáy ~400 px, tải trang tiếp bằng `cursor`; nút "Tải thêm" dự phòng cho người dùng bàn phím/trình đọc màn hình. Tối đa 200 dòng trong DOM; vượt thì ảo hóa phần phía trên đã cuộn qua (hoặc cắt và giữ nút "Về đầu danh sách").
- **Lọc:** tab "Tất cả" / "Chưa đọc (n)"; đổi tab giữ vị trí cuộn riêng; chọn "Chưa đọc" rồi đọc một dòng thì dòng vẫn ở đó (mờ đi) tới khi rời tab hoặc tải lại, để tránh nhảy bố cục.
- **Đánh dấu tất cả đã đọc:** nút ở tiêu đề, vô hiệu khi 0 chưa đọc; gọi `POST read-all {upToId = id dòng mới nhất đang biết}`; huy hiệu về 0 lạc quan; lỗi thì khôi phục và báo.
- **Gom lô đọc:** các lần đọc liên tiếp (vd mở nhiều dòng) gom 500 ms vào `read-batch`.
- **Realtime:** `notification.created` chèn dòng vào đầu. Nếu `scrollTop > 0` hoặc người dùng đang tương tác, **không đẩy** bố cục: hiện pill nổi "N thông báo mới ↑" (nhấn để cuộn lên). `notification.changed` đồng bộ trạng thái đọc/xóa từ nơi khác. Dòng đã gộp (`updated`) thay tại chỗ.
- **Toast ngoài trang:** khi đang ở trang khác trong ứng dụng, thông báo mới hiện toast góc dưới phải (tiêu đề + phụ đề, nhấn để mở `link`), tự đóng sau 6 giây, tối đa 1 toast mỗi 3 giây (dư thì gộp "Bạn có N thông báo mới"), `role="status"`, không giành focus. Không toast cho `message.new` khi đang mở đúng cuộc hội thoại đó.
- **Đồng bộ lại:** nối lại socket hoặc tab hiện lại sau > 30 giây: tải lại trang đầu và số chưa đọc, ghép theo `id` (không nháy danh sách).
- **Trang đích:** nếu `link` dẫn tới thứ đã bị xóa/không còn quyền, trang đích dùng trạng thái "không còn" chuẩn; từ trang đó có nút quay lại Thông báo.

## Cài đặt thông báo (`notification-settings`, ngăn kéo/hộp thoại từ nút ⚙)

1. **Thông báo đẩy trên thiết bị này:** công tắc theo trạng thái thật: *Chưa hỗ trợ* / *Cần thêm vào Màn hình chính (iOS)* / *Chưa bật* / *Đã bật* / *Bị chặn trong trình duyệt* (kèm hướng dẫn theo trình duyệt). Bật = bấm → hỏi quyền → đăng ký (xem `diagrams/sequence-subscribe-push.mmd`). Có nút "Gửi thử" (một thông báo thử, giới hạn 3 lần/giờ).
2. **Theo nhóm:** bảng nhóm (Xã hội, Tin nhắn, Thanh toán, Kiểm duyệt, Hệ thống) × (Trong ứng dụng, Đẩy). Nhóm *Bảo mật* hiển thị cố định bật, có chú thích lý do.
3. **Ẩn nội dung trên màn hình khóa:** công tắc.
4. **Thiết bị nhận thông báo:** danh sách thiết bị (nền tảng, nhãn, đã cài PWA?, lần giao thành công gần nhất), bật/tắt từng thiết bị, xóa; thiết bị hiện tại được đánh dấu; thiết bị đang *Tạm ngưng* (đã đăng xuất hoặc lâu không dùng) hiển thị nhãn riêng và tự hoạt động lại khi bạn đăng nhập trên thiết bị đó.
5. Lưu ngay khi đổi (lạc quan), lỗi thì hoàn lại và báo.

**Thẻ gợi ý bật thông báo đẩy** ở đầu danh sách: chỉ hiện khi hỗ trợ, quyền chưa bị chặn, thiết bị chưa đăng ký và chưa từng bấm "Để sau" trong 14 ngày (lưu `localStorage`, bọc try/catch). **Không** hỏi quyền khi vừa vào trang hay vừa đăng nhập.

## Trạng thái

| Trạng thái | Hiển thị |
| --- | --- |
| Đang tải | 5 dòng xương, `aria-busy="true"` |
| Trống (Tất cả) | Icon chuông lớn nhạt, "Chưa có thông báo", chú thích "Chúng tôi sẽ báo khi có điều mới", nút "Cài đặt thông báo" |
| Trống (Chưa đọc) | "Bạn đã xem hết rồi" |
| Lỗi tải | Khung lỗi + "Thử lại"; giữ dữ liệu cũ nếu có |
| Mất mạng / socket rớt | Dải nhỏ "Đang kết nối lại…"; hành động ghi xếp hàng ngắn hoặc báo thất bại, không mất im lặng |
| Hết hạn phiên | Chuyển tới đăng nhập, `returnTo` = trang hiện tại |
| Lỗi 429/503 | "Hệ thống đang bận, thử lại sau" |

## Trợ năng

- Danh sách là `<ul>`; mỗi dòng `<li>` có một liên kết chính và các nút phụ; thứ tự Tab: liên kết → menu. Không `aria-live` cho toàn danh sách; một vùng `aria-live="polite"` riêng thông báo "N thông báo mới" và kết quả thao tác ("Đã đánh dấu đã đọc", "Đã xóa").
- Tương phản ≥ 4.5:1; vùng chạm ≥ 44×44 px trên cảm ứng; focus ring rõ.
- `prefers-reduced-motion`: bỏ hiệu ứng thu gọn/chèn, chỉ đổi tức thì.
- Văn bản tiếng Việt; thời gian theo `vi`; không dùng icon thay cho nhãn khi chỉ có icon (có `aria-label`).

## Hiệu năng giao diện

- Component dòng bọc `React.memo` theo `id + readAt + count`; không render lại cả danh sách khi một dòng đổi.
- Kho trạng thái theo `id` (Map) + mảng id đã sắp; cập nhật bất biến theo lô trong một frame.
- Không tải thư viện icon đầy đủ: ánh xạ tĩnh danh sách icon cho phép (~20 icon).
- Mã của trang thông báo, cài đặt, đăng ký push tách bằng `dynamic import`; `NotificationProvider` chỉ giữ số chưa đọc và đăng ký socket (nhẹ).
