# Technical Research — Diễn đàn hỏi đáp

## Bản ghi quyết định 1 — Mạch bài thay cho chuyên mục nhiều tầng <!-- key: decision_record -->

**Status:** Accepted
**Category:** New Architecture Pattern
**Door Type:** One-way (expensive to reverse)

### Bối cảnh <!-- key: context -->

Người dùng cần chủ đề, câu hỏi và trả lời. Threads và X gom thảo luận quanh một bài gốc, không quanh cây diễn đàn. Chuyên mục lồng nhau đổi cách truy vấn và cách kiểm duyệt.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Một bài gốc, trả lời có `parent_id` trong cùng mạch, một chủ đề trên bài gốc | Bảng phẳng, phân trang theo thời gian | Một danh sách, không đệ quy giao diện | Đổi sau này phải viết lại mạch đã lưu | Giống Threads và X |
| Diễn đàn nhiều tầng, mỗi chuyên mục một cây bài | Không giống hai sản phẩm được nêu | Khó kiểm duyệt và khó phân trang | Khó | Loại |
| Chỉ hashtag tự do, không có bản ghi chủ đề | Dễ thiếu chủ đề trống và tên trùng | Phải dọn chuỗi mỗi lần đọc | Dễ | Không đủ chỗ để khóa cả chủ đề |

### Quyết định <!-- key: decision -->

Mỗi bài gốc thuộc một chủ đề. Trả lời nằm trong mạch của bài gốc qua `root_id`, và trỏ bài mà nó đáp lại qua `parent_id`. Giao diện xếp trả lời theo thời gian, một lần thụt vào, không vẽ cây sâu.

### Hệ quả <!-- key: consequences -->

Khóa chủ đề chặn bài mới và trả lời mới trong chủ đề đó. Xóa bài gốc thì cả mạch khuất khỏi danh sách. Không có đường dẫn chuyên mục con.

### Khả năng đảo ngược <!-- key: reversibility -->

Thêm tầng chuyên mục sau này phải gán lại chủ đề cho mọi bài gốc. Vì vậy quyết định này là một chiều.

---

## Bản ghi quyết định 2 — Tệp đính kèm trên MinIO sẵn có <!-- key: decision_record -->

**Status:** Accepted
**Category:** Integration Feasibility
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Người dùng cần tải ảnh hoặc video lên bài. Ứng dụng đã có MinIO và URL ký hạn. Chưa cần phát trực tiếp hay chuyển mã.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| URL tải lên có chữ ký, bucket riêng tư, trình duyệt phát tệp mp4 trực tiếp | Đúng `StorageService` hiện có | Không thêm hàng đợi | Đổi cách phát được | Không đo thời lượng video |
| Dịch vụ video riêng, cắt đoạn, phát luồng | Chưa có trong repo | Thêm vận hành | Khó gỡ | Ngoài phạm vi |
| Nhét ảnh vào PostgreSQL | Trái cách lưu tệp đang dùng | Làm nặng bản sao lưu | Dễ bỏ | Loại |

### Quyết định <!-- key: decision -->

Tạo bản ghi media, cấp URL PUT có hạn, người dùng tải thẳng lên MinIO, rồi gọi hoàn tất. Ảnh hoặc một video trong một bài, loại MIME nằm trong danh sách cho phép. Không chuyển mã, không phát trực tiếp.

### Hệ quả <!-- key: consequences -->

Threat model phải chặn MIME lạ, tệp quá lớn và bucket công khai. Bài chỉ nhận media đã hoàn tất của chính người đăng.

### Khả năng đảo ngược <!-- key: reversibility -->

Thêm chuyển mã sau này không đổi khóa đối tượng đã lưu.
