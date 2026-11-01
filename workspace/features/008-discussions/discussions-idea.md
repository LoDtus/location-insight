# Diễn đàn hỏi đáp

**Feature ID:** 008-discussions
**Type:** New Feature
**Status:** Ready for Planning

## Vấn đề <!-- key: problem -->

Người dùng tra cứu địa điểm nhưng chưa có chỗ hỏi người khác về khu đó, và chưa có chỗ trả lời. Bài viết ở `/bai-viet` là ghi chú của người vận hành, không phải câu hỏi của người dùng.

## Bối cảnh hiện tại <!-- key: current_context -->

Ứng dụng có phiên đăng nhập, hồ sơ công khai, ảnh lưu trên MinIO, và quyền admin để ẩn nội dung. Chưa có bài đăng của người dùng, chủ đề, trả lời hay tệp đính kèm. Không có phát trực tiếp.

## Mục tiêu <!-- key: goal -->

Người đã đăng nhập tạo được một chủ đề, đăng một câu hỏi hoặc một bài ngắn trong chủ đề đó, đính kèm ảnh hoặc một video đã tải lên, và người khác trả lời trên cùng một mạch. Người vận hành khóa chủ đề hoặc ẩn bài khi cần. Chưa làm các lớp nâng cao của mạng xã hội.

## Phạm vi <!-- key: scope -->

**In scope:**

- Chủ đề do người dùng tạo: tên, slug, một câu mô tả.
- Bài gốc là câu hỏi hoặc bài ngắn, gắn đúng một chủ đề.
- Trả lời trên bài gốc. Trả lời trỏ tới một bài trong cùng mạch, hiển thị phẳng theo thời gian.
- Ảnh (tối đa 4) hoặc một video tải lên, không phát trực tiếp và không chuyển mã.
- Thích hoặc bỏ thích một bài.
- Tác giả xóa bài của mình. Admin ẩn bài, khóa chủ đề, xem báo cáo.
- Đọc và viết trong khu `/app`, sau khi đăng nhập.

**Out of scope (non-goals):**

- Phát trực tiếp, Spaces, phòng thoại, tin nhắn riêng, theo dõi người dùng, bảng tin thuật toán, đăng lại, trích dẫn, thăm dò, thông báo đẩy.
- Biến `/bai-viet` thành diễn đàn, hoặc cho khách chưa đăng nhập đọc mạch bài.
- Sửa ma trận giá và gói. Diễn đàn không trừ lượt phân tích.

## Tiêu chí thành công <!-- key: success_criteria -->

- Một người tạo chủ đề, đăng câu hỏi kèm ảnh, người khác trả lời và thấy câu trả lời dưới bài gốc.
- Một bài không đứng trong hai chủ đề. Một bài không có cả 4 ảnh lẫn một video.
- Khách chưa đăng nhập không đọc và không ghi.
- Admin ẩn bài thì người dùng không còn thấy nội dung đó. Tác giả xóa bài của mình thì mạch biến mất khỏi danh sách.

## Đối tượng sử dụng chính & Kịch bản sử dụng <!-- key: primary_actors -->

- **Người dùng đã đăng nhập:** tạo chủ đề, hỏi về một khu, trả lời, thích, xóa bài của mình.
- **Người vận hành:** khóa chủ đề, ẩn bài, xem báo cáo.
- **Khách:** không vào khu này.

## Nơi bị ảnh hưởng <!-- key: impacted_areas -->

- Website: mục mới trong `/app` và màn duyệt trong `/admin`.
- Backend: module thảo luận, bảng PostgreSQL mới, tệp trên MinIO sẵn có.
- Redis: khóa giới hạn tần suất đăng.

## Phụ thuộc <!-- key: dependencies -->

- `003-auth`: phải có phiên trước khi đọc hoặc ghi.
- `004-rbac`: quyền mới cho đọc, ghi và kiểm duyệt. Nhật ký admin dùng bảng sẵn có.

## Dữ liệu nhạy cảm & Tuân thủ <!-- key: data_sensitivity -->

Nội dung do người dùng viết và ảnh hoặc video họ tải lên. Có thể lộ địa chỉ nhà hoặc mặt người. Không lưu tin nhắn riêng. URL tải tệp là liên kết có thời hạn, không để bucket công khai.

## Ràng buộc <!-- key: constraints -->

- Không thêm dịch vụ mới. Ảnh và video đi qua MinIO đang dùng.
- Không phát trực tiếp, không cắt video, không xếp hạng bằng mô hình.
- Bài là chữ thường, không nhận HTML.

## Rủi ro & Điểm chưa rõ <!-- key: risks_unknowns -->

- Chủ đề do mọi người tạo dễ bị spam tên gần giống nhau.
- Video không cắt dung lượng nếu chỉ tin kích thước tệp.
- Ảnh nhà thật trong câu hỏi là dữ liệu cá nhân. Ẩn bài không xóa tệp khỏi đĩa cho đến khi job dọn chạy.

## Giả định (Assumptions) <!-- key: assumptions -->

- Hình dạng giống một mạch trên Threads hoặc X: một bài gốc và các trả lời, không phải diễn đàn nhiều tầng chuyên mục.
- Mỗi bài gốc thuộc một chủ đề. Slug chủ đề là chữ thường, số và gạch ngang, duy nhất.
- Bài gốc tối đa 2.000 ký tự. Trả lời cùng giới hạn đó.
- Ảnh jpeg, png hoặc webp, mỗi tệp tối đa 8 MB, tối đa 4 ảnh. Video mp4 tối đa 50 MB, một tệp, không đo thời lượng.
- Thích là nút đếm, không phải theo dõi người đăng.
- Khu này chỉ có trong `/app/discussions` và `/admin/discussions`.

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

- Sau này khách chưa đăng nhập có được đọc mạch bài trên trang công khai không? Bản này không cho đọc.

## Tính năng liên quan <!-- key: related_features -->

- `001-ui`: màu và chữ của bản mô phỏng.
- `003-auth`: phiên và hồ sơ người đăng.
- `004-rbac`: quyền và nhật ký admin.
- `006-buying`: tin nhà đất là nội dung khác, không gắn thành bình luận của tin.

## Nhật ký cập nhật <!-- key: update_log -->

- 01/11/2026: tạo từ yêu cầu diễn đàn hỏi đáp, kiến trúc tham khảo Threads hoặc X, dừng ở chủ đề, bài đăng và media.
