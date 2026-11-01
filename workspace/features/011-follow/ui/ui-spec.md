# Đặc tả giao diện — Theo dõi

Chế độ **Preserve** (`ui-design`): dùng token và component sẵn có (xanh `green`, `cream`, `charcoal`, bo tròn, vùng chạm ≥ 44 px).

## Nút Theo dõi (`FollowButton`)

- Trạng thái: **Theo dõi** (nền xanh, chữ kem) → **Đang theo dõi** (viền, chữ đậm). Khi di chuột trên "Đang theo dõi" hiện **Bỏ theo dõi**; bấm bỏ theo dõi không cần hộp xác nhận (hoàn tác bằng một lần bấm lại).
- Cập nhật lạc quan; lỗi thì hoàn lại và hiện thông báo ngắn (`role="alert"`), `aria-pressed` phản ánh trạng thái.
- Nếu người kia đang theo dõi mình và mình chưa theo dõi lại: nhãn **Theo dõi lại**.
- Ẩn nếu là chính mình. Nếu API trả `403 cannot_follow_user` (bị chặn) thì hiện "Bạn không thể theo dõi người này." không nêu lý do.

## Hồ sơ

- Dưới tên: `120 người theo dõi · 80 đang theo dõi` là hai nút văn bản (≥ 44 px), mở hộp danh sách. Nhãn "Theo dõi bạn" nhỏ cạnh tên khi họ đang theo dõi mình.
- Nút Theo dõi đặt cạnh nút **Nhắn tin**; trên điện thoại hai nút xếp ngang, xuống dòng khi hẹp.

## Hộp danh sách (`FollowListDialog`)

- Hai tab **Người theo dõi** / **Đang theo dõi**, mỗi dòng: ảnh, tên, `@username` (liên kết hồ sơ), nút Theo dõi (trừ chính mình).
- Cuộn vô hạn theo con trỏ (30 mỗi lần), khung xương khi tải, trống: "Chưa có ai.", lỗi: nút Thử lại.
- Dùng `Dialog` có sẵn (giữ focus, Esc đóng).

## Diễn đàn

- Hai tab trên đầu `/feed`: **Mới nhất** | **Đang theo dõi** (tab chủ đề giữ nguyên). Tab theo dõi trống: "Hãy theo dõi vài người để thấy bài của họ ở đây." kèm gợi ý mở danh sách người dùng.
