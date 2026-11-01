# Góp ý của người dùng (Feedback)

**Feature ID:** 010-feedback
**Status:** In Progress
**Last Updated:** 2026-11-02

## Tổng quan

Người dùng gửi góp ý (báo lỗi, ý tưởng, câu hỏi, khác) kèm mô tả, ảnh và video, rồi trao đổi với đội ngũ ngay trong ứng dụng. Admin có tab quản lý để xem, lọc, trả lời và đổi trạng thái.

## Yêu cầu chức năng

- **FR-01:** `/app/feedback`: form gửi góp ý (loại, mô tả 10–4000 ký tự, tối đa 4 ảnh JPEG/PNG/WebP ≤ 8 MB và 1 video MP4 ≤ 50 MB) và danh sách góp ý của mình.
- **FR-02:** tệp tải thẳng lên MinIO bằng URL ký hạn 10 phút; máy chủ kiểm kích thước thật và magic byte khi hoàn tất; tệp `pending` quá 24 giờ bị dọn.
- **FR-03:** người gửi xem được chi tiết, trả lời thêm; góp ý đã `resolved` được mở lại khi người gửi trả lời; góp ý `closed` không nhận thêm.
- **FR-04:** `/admin/feedback`: danh sách mọi góp ý, lọc theo trạng thái và loại, trả lời, đổi trạng thái (`open`, `in_progress`, `resolved`, `closed`). Admin trả lời lần đầu thì `open` thành `in_progress`.
- **FR-05:** chấm "có trả lời mới" cho người gửi (số hiện ở thanh bên); admin thấy số góp ý đang chờ trả lời.
- **FR-06:** mọi trả lời và đổi trạng thái của admin ghi `admin_audit_logs`.

## Quy tắc

- Giới hạn: 5 góp ý, 30 trả lời, 30 tệp mỗi giờ mỗi người; Redis lỗi thì từ chối ghi.
- Nội dung là chữ thường: bỏ thẻ HTML, ký tự điều khiển; render bằng text node.
- Người dùng chỉ thấy góp ý của mình (người khác nhận 404). Quyền: `feedback:write` (user), `feedback:manage` (admin).

## Artifacts

- API: `GET/POST /feedback`, `/feedback/:id`, `/feedback/:id/replies`, `/feedback/media`, `/feedback/media/:id/complete`, `/feedback/unread-count`; `GET /admin/feedback`, `/admin/feedback/open-count`, `/admin/feedback/:id`, `POST /admin/feedback/:id/replies`, `/admin/feedback/:id/status`.
- Bảng: `feedbacks`, `feedback_media`, `feedback_replies`.
- Mã nguồn: `backend/src/modules/feedback/`, `website/src/features/feedback/`.

## Ngoài phạm vi

Email thông báo, đính kèm tệp ở phần trả lời, gán người xử lý, SLA.
