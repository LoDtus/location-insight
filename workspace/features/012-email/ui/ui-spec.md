# Giao diện — email (012-email)

## Admin: `/admin/email`

Ba tab, giữ phong cách `/admin/feedback` (token `green/cream/charcoal`).

1. **Mẫu email**: bên trái danh sách loại (tên, nhãn danh mục, chấm "đã tùy biến"); bên phải trình sửa:
   - chọn ngôn ngữ (vi/en), công tắc "Bật gửi" (khóa với `security`);
   - ô Tiêu đề, ô Nội dung HTML (textarea mono), ô Bản văn bản (tùy chọn);
   - dãy chip biến — bấm để chèn `{{biến}}` tại con trỏ; tooltip mô tả;
   - khung **Xem trước** (iframe `sandbox=""`, `srcdoc`), cập nhật sau 400 ms ngừng gõ qua `/preview`;
   - nút: Lưu, Gửi thử cho tôi, Khôi phục mặc định (xác nhận).
2. **Nhật ký**: bảng (thời gian, người nhận, loại, tiêu đề, trạng thái chip, số lần), lọc trạng thái/loại/địa chỉ, nút "Thử lại" cho `dead`, thẻ số liệu (xếp hàng, tuổi cũ nhất, lỗi 24h).
3. **Danh sách chặn**: bảng địa chỉ, lý do, ngày; thêm/bỏ chặn.

Trạng thái rỗng, lỗi và đang tải có thông điệp riêng; trên mobile bố cục một cột (danh sách → chi tiết).

## Người dùng: tùy chọn email

Thẻ "Email thông báo" trong hồ sơ của chính mình: công tắc cho từng danh mục có thể tắt ("Thông báo hoạt động" = notification). Ghi chú: "Email bảo mật (xác minh, đặt lại mật khẩu) luôn được gửi."

## Trang công khai `/unsubscribe`

Đọc `u`,`c`,`t` từ query, hiện nút "Hủy nhận email này" (không tự gọi khi mở để tránh bộ quét liên kết), gọi `POST /email/unsubscribe`, hiển thị kết quả.

## Trang `/auth/verify-email`

Đọc `token`, gọi `POST /auth/verify-email`, hiển thị kết quả và liên kết đăng nhập.
