# Giao diện — PWA (015-pwa)

Dùng token hiện có (`green/cream/charcoal`). Mọi thành phần bên dưới ẩn khi trình duyệt không hỗ trợ API tương ứng hoặc khi đã chạy standalone (trừ ngoại tuyến và cập nhật).

## 1. Lời mời cài đặt (`install-prompt`)

- **Vị trí:** thẻ nhỏ góc dưới trái trên desktop, thanh dưới (trên thanh điều hướng) trên điện thoại; không che nút chính, không chặn nội dung.
- **Nội dung:** icon ứng dụng, "Cài Địa Thế để mở nhanh và nhận thông báo", nút **Cài đặt** và **Để sau**.
- **Điều kiện hiện:** có `beforeinstallprompt`, chưa cài, ≥ 2 phiên hoặc đã vào Thông báo, chưa "Để sau" trong 30 ngày (lưu `localStorage`, bọc try/catch; thiếu thì coi như chưa từ chối nhưng không hiện lại trong phiên này).
- **Cố định:** mục "Cài ứng dụng" trong menu hồ sơ/cài đặt, luôn dùng được khi có sự kiện; mở ngăn hướng dẫn trên iOS.
- Esc/nút ✕ đóng; focus không bị giữ; `role="complementary"` với `aria-label="Cài đặt ứng dụng"`.

## 2. Hướng dẫn iOS / iPadOS / Safari macOS (`install-guide`)

Hộp thoại ngắn, 3 bước có hình: **1.** nút Chia sẻ, **2.** "Thêm vào Màn hình chính" (macOS: "Thêm vào Dock"), **3.** mở từ biểu tượng rồi vào Thông báo bật thông báo đẩy. Hiện khi người dùng iOS bấm bật thông báo đẩy mà chưa chạy standalone. Có nút "Đã hiểu"; nội dung dạng văn bản (không chỉ hình) để dùng được với trình đọc màn hình.

## 3. Thanh cập nhật (`update-banner`)

Dải mỏng dưới đầu trang: "Có phiên bản mới · **Tải lại**". Không tự tải lại. `role="status"`, không giành focus. Hiện tới khi người dùng bấm hoặc tải lại; hiện lại ở phiên sau.

## 4. Dải ngoại tuyến (`offline-bar`)

Khi `navigator.onLine === false` hoặc socket rớt kéo dài và mạng lỗi: dải "Đang ngoại tuyến · một số chức năng tạm thời không dùng được". Biến mất khi có mạng (kèm thông báo "Đã kết nối lại" 2 giây). Trang `/offline`: logo, "Không có kết nối", nút **Thử lại** (`location.reload()`), không dữ liệu riêng tư, văn bản tiếng Việt, tương phản đạt.

## 5. Huy hiệu và thanh tiêu đề

- Biểu tượng ứng dụng: số chưa đọc qua App Badging API (xem 014).
- `theme-color` theo token `green`; trên chế độ tối (nếu giao diện có) khai báo hai `meta theme-color` theo `prefers-color-scheme`.
- Trong standalone, không có thanh địa chỉ: mọi trang cần nút quay lại rõ (đã có ở bố cục `app`/`admin`); liên kết ngoài mở trong trình duyệt (`target="_blank" rel="noopener noreferrer"`).
- Khoảng đệm `safe-area-inset-*` cho tai thỏ/thanh Home trên iOS; `viewport-fit=cover` khai báo trong `viewport`.

## Trợ năng và hiệu năng

- Mọi thành phần điều khiển bằng bàn phím, nhãn tiếng Việt, tương phản ≥ 4.5:1, vùng chạm ≥ 44 px.
- `prefers-reduced-motion` tắt hoạt ảnh trượt vào.
- Mã của lời mời, hướng dẫn, thanh cập nhật tách bằng `dynamic import`, chỉ tải khi điều kiện hiện đúng; không tăng JavaScript của lần tải đầu.
