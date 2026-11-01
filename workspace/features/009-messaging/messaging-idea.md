# Nhắn tin trực tiếp thời gian thực (Messaging)

**Feature ID:** 009-messaging
**Type:** New Feature
**Status:** Ready for Planning

## Vấn đề <!-- key: problem -->

Người mua, người bán và người hỏi đáp trong `/feed` không có cách trao đổi riêng với nhau. Họ phải để lộ số điện thoại hoặc email trong bài công khai, hoặc rời ứng dụng sang Zalo, Messenger. Ứng dụng mất ngữ cảnh (tin nhà đất nào, bài nào) và không kiểm soát được spam hay lừa đảo.

## Bối cảnh hiện tại <!-- key: current_context -->

- Đã có phiên đăng nhập, hồ sơ công khai (`display_name`, `avatar_url`), quyền theo vai trò và gói.
- Đã có một kênh WebSocket (Socket.IO, `RealtimeGateway`) xác thực bằng vé một lần, phát `session.revoked` và `authz.changed` qua Redis Pub/Sub. Chưa có sự kiện nghiệp vụ nào đi qua kênh này.
- Đã có MinIO và URL ký hạn cho ảnh (008-discussions), Redis giới hạn tần suất, nhật ký admin.
- `008-discussions` loại "tin nhắn riêng" khỏi phạm vi. `/feed` là nơi công khai, không thay thế nhắn tin.
- Chưa có hội thoại, tin nhắn, chặn người dùng hay báo cáo tin nhắn.

## Mục tiêu <!-- key: goal -->

Hai người dùng đã đăng nhập nhắn tin riêng, thấy tin mới ngay không cần tải lại, thấy đã đọc, gửi ảnh, trả lời trích dẫn, thả cảm xúc, và chia sẻ một bài trong `/feed`. Người lạ gửi tin đầu tiên vào mục **Yêu cầu** để người nhận chấp nhận trước. Giao diện theo mô hình hai cột của Threads và Messenger.

Thiết kế dùng được ngay với một PostgreSQL và một Redis, nhưng khóa dữ liệu, thứ tự tin và cách phát sự kiện đã đặt sẵn để tách dần khi lượng người dùng tăng (xem `scaling-roadmap.md`).

## Phạm vi <!-- key: scope -->

**In scope (bản đầu):**

- Hội thoại 1-1, tìm hoặc tạo theo cặp người dùng.
- Hộp thư **Inbox** và **Requests**; chấp nhận, từ chối, chặn.
- Gửi chữ, gửi tối đa 4 ảnh, chia sẻ một bài `/feed`, trả lời trích dẫn.
- Thu hồi tin của mình (với mọi người), xóa hội thoại phía mình.
- Thả một cảm xúc trên một tin.
- Phát tin mới, thu hồi, cảm xúc, đã đọc, đang gõ qua WebSocket sẵn có.
- Số chưa đọc, đánh dấu đã đọc, tắt thông báo hội thoại.
- Trạng thái hoạt động ("Đang hoạt động", "Hoạt động 9 giờ trước") có thể tắt.
- Chặn người dùng, báo cáo tin nhắn, màn duyệt báo cáo cho admin.
- Cài đặt riêng: ai được nhắn, hiện trạng thái hoạt động, gửi báo đã đọc.
- Giao diện `/app/messages` (máy tính hai cột, điện thoại một cột).

**Out of scope (non-goals), để chỗ sẵn trong thiết kế:**

- Nhóm chat (bảng đã hỗ trợ `type = group`, API và giao diện chưa mở).
- Gọi thoại, gọi video, ghi âm, gửi tệp tùy ý, video, GIF, nhãn dán.
- Mã hóa đầu cuối.
- Tìm kiếm toàn văn nội dung tin nhắn.
- Thông báo đẩy (push), email khi có tin chưa đọc.
- Xem trước liên kết (link preview) do máy chủ tải.
- Sửa nội dung tin sau khi gửi.
- Chuyển tiếp tin, ghim tin, hẹn giờ gửi, tin biến mất.
- Bot, tự động trả lời, chat hỗ trợ khách hàng.
- Khách chưa đăng nhập.

## Tiêu chí thành công <!-- key: success_criteria -->

- Hai người ở hai trình duyệt nhắn qua lại, tin hiện trên máy kia dưới 1 giây (cùng khu vực) mà không tải lại.
- Mất mạng 30 giây rồi có lại: không mất tin, không trùng tin, thứ tự đúng.
- Người lạ nhắn lần đầu: nằm ở Requests, chỉ gửi được 1 tin chữ cho đến khi được chấp nhận.
- Người bị chặn không gửi được và không biết mình bị chặn.
- Người ngoài hội thoại không đọc được tin, không đoán được hội thoại tồn tại.
- Chạy hai bản sao backend cùng lúc vẫn phát tin đúng.
- Có đường nâng cấp (xem roadmap) mà không đổi API công khai và không đổi khóa của bảng tin nhắn.

## Đối tượng sử dụng chính & Kịch bản sử dụng <!-- key: primary_actors -->

- **Người dùng đã đăng nhập:** hỏi người đăng tin về một căn nhà; trao đổi sau khi trả lời nhau trên `/feed`; chia sẻ bài cho bạn.
- **Người nhận lần đầu:** xem Requests, chấp nhận hoặc từ chối, chặn người làm phiền.
- **Admin:** xem tin bị báo cáo (kèm vài tin ngữ cảnh), ẩn tin, ghi lý do.
- **Hệ thống:** job dọn tệp, đối soát.

## Nơi bị ảnh hưởng <!-- key: impacted_areas -->

- Backend: module mới `messaging`; bổ sung quyền ở `rbac`; dùng chung `RealtimeGateway` ở `auth`.
- PostgreSQL: các bảng mới tiền tố `message` / `conversation` (xem `postgresql.dbml`).
- Redis: khóa giới hạn, hiện diện, bộ đệm thành viên, kênh sự kiện.
- MinIO: ảnh đính kèm, thư mục riêng.
- Website: `/app/messages`, mục menu "Messages" kèm số chưa đọc, nút "Nhắn tin" ở hồ sơ và ở bài `/feed`; `/admin/messaging`.
- Hạ tầng: reverse proxy phải cho WebSocket đi qua (đã có cho website).

## Phụ thuộc <!-- key: dependencies -->

- `003-auth`: phiên, vé WebSocket, hồ sơ, `RealtimeGateway`.
- `004-rbac`: thêm `message:read`, `message:write` (user), `message:moderate` (admin); `admin_audit_logs`.
- `008-discussions`: kiểu tin `post_share` tham chiếu `discussion_posts`.
- MinIO qua `StorageService`.
- `notification` (website): hiển thị số chưa đọc chung nếu có.

## Dữ liệu nhạy cảm & Tuân thủ <!-- key: data_sensitivity -->

Nội dung riêng tư của hai người, ảnh có thể có địa chỉ, giấy tờ, mặt người. Đây là dữ liệu cá nhân. Cần: truyền qua TLS, URL ảnh có hạn, admin chỉ thấy tin bị báo cáo, nhật ký truy cập admin, quyền xóa của chủ tài khoản, quy tắc lưu giữ rõ ràng. Cần đối chiếu Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân với bộ phận pháp lý trước khi ra sản phẩm. Phân tích sâu ở `threat-model.md`.

## Ràng buộc <!-- key: constraints -->

- Không thêm dịch vụ hạ tầng mới ở bản đầu: chỉ PostgreSQL, Redis, MinIO, backend NestJS đã có.
- Dùng lại Socket.IO và cách xác thực vé hiện có, không mở kết nối thứ hai.
- Chữ thường, không HTML. Tối đa 2.000 ký tự một tin.
- Ghi tin đi qua REST (có kiểm tra, giới hạn, idempotent); WebSocket chỉ để phát sự kiện và tín hiệu tạm (đang gõ).
- Tên bảng, khóa Redis, mã lỗi theo `naming.md` và `security.md`.
- Không giữ trạng thái hội thoại trong bộ nhớ một instance (phải chạy được nhiều instance).

## Rủi ro & Điểm chưa rõ <!-- key: risks_unknowns -->

- Spam và lừa đảo qua tin nhắn riêng (mời chào, link độc, giả danh môi giới). Đây là rủi ro lớn nhất khi mở nhắn tin giữa người lạ.
- Redis Pub/Sub không đảm bảo giao: phải có đường đồng bộ lại theo `seq`.
- `RealtimeGateway.recheck` hiện gọi Redis một lần cho mỗi socket mỗi 60 giây; sẽ thành điểm nghẽn khi có hàng nghìn kết nối (xem roadmap, bước 0).
- `cors: { origin: true }` trên gateway quá rộng; phải siết trước khi phát nội dung riêng tư.
- Đã có người dùng bị xóa mềm: tin cũ của họ hiển thị thế nào.
- Tin nhắn là bảng tăng nhanh nhất hệ thống; không tách sớm thì chi phí đổi khóa sau rất cao, nên khóa chính đã đặt theo hội thoại.

## Giả định (Assumptions) <!-- key: assumptions -->

- Hội thoại 1-1 duy nhất cho một cặp người dùng (`direct_key`). Hai người không có hai hội thoại.
- Người lạ = hai người chưa có hội thoại `active`. Chưa có tính năng theo dõi nên "chưa theo dõi" không dùng làm tiêu chí.
- Tin đầu của người lạ: chỉ chữ, tối đa 1 tin cho đến khi được chấp nhận (giống Instagram, Threads).
- Thu hồi tin không giới hạn thời gian; nội dung bị xóa khỏi DB ngay, tệp ảnh xóa sau 7 ngày (giống `008-discussions`).
- Một người một cảm xúc trên một tin; chọn lại thì đổi, chọn trùng thì bỏ.
- Hiện diện chỉ lưu Redis, không ghi DB; mất Redis thì hiện "không rõ".
- Không đếm "đã nhận" (delivered); chỉ có "đã gửi" và "đã xem".
- Giới hạn khởi điểm: 60 tin mỗi phút mỗi người; 20 hội thoại mới mỗi ngày; 5 kết nối socket mỗi người. Chỉnh bằng cấu hình.
- Mục tiêu thiết kế bản đầu: 5.000 kết nối đồng thời, 50 tin mỗi giây. Đây là mục tiêu, chưa đo; kiểm bằng load test (xem README).
- Bản đầu giữ `RealtimeGateway` trong `auth`; module `messaging` đăng ký bộ phát sự kiện thông qua nó.

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

- Có cho phép nhắn tin giữa người mua và người bán trước khi cả hai đã xác minh email không? Đề xuất: yêu cầu email đã xác minh để gửi (đọc thì không cần).
- Khách chưa trả lời Requests sau bao lâu thì tự dọn? Đề xuất: giữ 30 ngày rồi ẩn, không xóa.
- Cần giữ tin tối đa bao lâu (chính sách lưu giữ)? Đề xuất: đến khi cả hai phía xóa hội thoại, sau đó xóa cứng sau 30 ngày.
- Có cần email nhắc khi có tin chưa đọc sau 15 phút không? Để giai đoạn 2.

## Tính năng liên quan <!-- key: related_features -->

- `003-auth`: phiên và kênh realtime.
- `004-rbac`: quyền, nhật ký admin.
- `008-discussions`: bài `/feed` được chia sẻ vào tin nhắn; báo cáo dùng cách làm tương tự.
- `006-buying`: tin nhà đất; nút "Nhắn người đăng" có thể gắn ngữ cảnh tin (giai đoạn 2).
- `001-ui`: màu và chữ.

## Nhật ký cập nhật <!-- key: update_log -->

- 02/11/2026: tạo từ yêu cầu nhắn tin thời gian thực, tham khảo giao diện Threads/Messenger và kiến trúc Discord, Zulip, Mattermost, Socket.IO.
