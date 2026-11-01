# Threat Model — Nhắn tin trực tiếp thời gian thực

Phương pháp: STRIDE theo `02-planning-design/06-threat-modeling.md`, đối chiếu `.cursor/rules/security.md`. Mức độ nhạy cảm dữ liệu: **cao** (nội dung riêng tư, ảnh, quan hệ giữa hai người).

## 1. Tài sản cần bảo vệ

- Nội dung tin và ảnh của hai người trong hội thoại.
- Siêu dữ liệu: ai nhắn ai, khi nào, bao nhiêu tin, ai chặn ai, ai đang hoạt động.
- Danh tính người dùng (danh sách người dùng không được lộ qua tìm người nhận).
- Quyền kiểm duyệt và nhật ký admin.
- Kênh WebSocket và vé một lần.
- Khả dụng của hệ thống (nhắn tin không được làm sập phần còn lại).

## 2. Bề mặt tấn công

| Bề mặt | Ai gọi được | Ghi chú |
| --- | --- | --- |
| `GET/POST /messaging/conversations...` | Người đã đăng nhập | IDOR theo `conversationId`, `messageId` |
| `POST .../messages` | Người đã đăng nhập, là thành viên | Chữ, ảnh, bài chia sẻ; nguồn spam |
| `POST /messaging/attachments`, `.../complete` | Người đã đăng nhập | Tệp lên MinIO |
| `GET /messaging/recipients` | Người đã đăng nhập | Dò người dùng |
| WebSocket `/api/v1/realtime` | Người có vé | Sự kiện `typing`, `ping` từ client |
| Kênh Redis `events:messaging:*` | Chỉ backend | Ai ghi được Redis giả mạo được sự kiện |
| `/admin/messaging/*` | Admin | Đọc tin bị báo cáo |
| MinIO bucket tin nhắn | Qua URL ký | Rò URL |

## 3. Phân tích STRIDE

| # | Loại | Mối đe dọa | Mức | Biện pháp | Kiểm thử |
| --- | --- | --- | --- | --- | --- |
| S1 | Spoofing | Gửi tin giả danh người khác bằng `senderId` trong body | Cao | Không nhận `senderId` từ client; lấy từ phiên. DTO `whitelist` + `forbidNonWhitelisted` | Body có `senderId` bị `400` |
| S2 | Spoofing | Dùng lại vé WebSocket đã lộ | Trung | Vé dùng một lần (`GETDEL`), sống 30 giây (đã có ở 003-auth) | Dùng vé hai lần: lần hai bị đóng 4408 |
| S3 | Spoofing | Sự kiện giả bằng cách ghi thẳng vào Redis | Cao | Redis không mở ra ngoài mạng nội bộ, có mật khẩu và TLS khi qua mạng; kênh chỉ backend ghi; client chỉ nhận qua phòng `user:{id}` do máy chủ gán | Kiểm tra cấu hình infra; không có route client tự `join` phòng |
| T1 | Tampering | HTML hoặc script trong tin (XSS) | Cao | Máy chủ cắt thẻ và ký tự điều khiển; client vẽ bằng text node, không `dangerouslySetInnerHTML`; liên kết tự nhận dạng ở client với `rel="noopener noreferrer nofollow"` và `target="_blank"`; CSP đã có từ website | Tin `<img src=x onerror=...>` hiện thành chữ |
| T2 | Tampering | Khai `image/png` nhưng tải tệp khác (webshell, SVG chứa script) | Cao | Chỉ jpeg/png/webp; đọc magic byte lúc `complete`; lệch thì `rejected` và xóa object; không nhận SVG, GIF; trả ảnh với `Content-Type` do máy chủ đặt, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` chỉ cho ảnh | Đổi đuôi mp4 thành png bị từ chối |
| T3 | Tampering | Gắn ảnh của người khác, hoặc ảnh của hội thoại khác, vào tin của mình | Cao | Giao dịch kiểm `uploader_id = người gửi`, `conversation_id` khớp, `status = ready`, `message_seq IS NULL`; số dòng cập nhật phải bằng số ảnh | `attachmentId` của người khác bị `422` |
| T4 | Tampering | Sửa `seq` hoặc `clientMsgId` để ghi đè tin | Trung | `seq` do máy chủ cấp; `clientMsgId` chỉ dùng chống trùng trong phạm vi (hội thoại, người gửi); ON CONFLICT không ghi đè | Gửi lại cùng `clientMsgId` với body khác trả tin cũ, không đổi nội dung |
| R1 | Repudiation | Admin chối đã ẩn tin / xem báo cáo | Trung | `admin_audit_logs` bắt buộc lý do; ghi cả lần mở danh sách báo cáo ở mức tổng (không ghi nội dung) | Thiếu `reason` bị `400` |
| R2 | Repudiation | Người dùng chối đã gửi tin lừa đảo | Trung | Giữ `sender_id`, `created_at`, IP gửi ở log truy cập (không kèm nội dung); chụp ngữ cảnh khi có báo cáo | Báo cáo chứa đủ ngữ cảnh dù tin gốc bị thu hồi sau đó |
| I1 | Information disclosure | IDOR: đọc hội thoại hoặc tin của người khác bằng cách đoán id | Cao | Mọi route kiểm thành viên trong cùng truy vấn (`JOIN conversation_participants WHERE user_id = $me`); không thành viên trả 404 như không tồn tại; id là UUID v7 (không đoán tuần tự, nhưng không coi id là bí mật) | Test: user C gọi mọi route với id hội thoại của A và B đều ra 404 |
| I2 | Information disclosure | Lộ ai chặn ai | Trung | Chặn và `nobody` cùng trả `403 cannot_message_user`; `canSend` ở API chỉ nói "không gửi được", không nêu lý do | Hai lý do cho cùng phản hồi |
| I3 | Information disclosure | Dò danh sách người dùng bằng `/messaging/recipients` | Trung | Tối thiểu 2 ký tự, 10 kết quả, 30 lần mỗi phút, chỉ trả id, tên, ảnh; loại người đặt `nobody` và người chặn mình | Vượt giới hạn bị 429; không trả email |
| I4 | Information disclosure | Trạng thái hoạt động lộ thói quen | Trung | Chỉ hiện cho người đã có hội thoại `active` với mình; tắt được; không phát hiện diện qua socket, client chỉ hỏi khi mở hội thoại | Tắt `showActivityStatus`: cả hai chiều không thấy |
| I5 | Information disclosure | URL ảnh không hết hạn hoặc bị chia sẻ | Cao | Bucket riêng tư; URL đọc ký hạn 1 giờ; tên object ngẫu nhiên; không ghi URL vào log; ảnh của tin bị thu hồi biến khỏi API ngay và object bị xóa sau 7 ngày | URL hết hạn trả 403; tin đã thu hồi không còn URL |
| I6 | Information disclosure | Admin xem hội thoại tùy ý | Cao | Không có API đọc hội thoại cho admin. Chỉ đọc `context_snapshot` của báo cáo. Mọi lần xem được ghi nhật ký | Route đọc tin với vai trò admin (không là thành viên) trả 404 |
| I7 | Information disclosure | Log hoặc lỗi chứa nội dung tin, token | Cao | Không log `body`, URL ký, vé, access token; `trackId` trong lỗi; lọc xuống dòng khi log chuỗi người dùng | Grep log kiểm thử không thấy nội dung tin |
| I8 | Information disclosure | Xem trước liên kết do máy chủ tải gây SSRF hoặc lộ IP | Trung | **Không làm** ở bản đầu; client không tự tải trang bên ngoài | Không có route `link-preview` |
| I9 | Information disclosure | Bài chia sẻ lộ nội dung bài đã ẩn | Trung | Khi dựng tin `post_share`, kiểm bài `visible` lúc gửi; khi đọc, kiểm lại, bài ẩn hiển thị `available: false` không có nội dung | Admin ẩn bài, mở hội thoại: chỉ thấy "Bài viết không còn" |
| D1 | DoS | Gửi tin liên tục, bão tin | Cao | Giới hạn 60 tin/phút/người, 15 tin/10 giây/hội thoại, body ≤ 2.000 ký tự; Redis lỗi thì từ chối | Tin thứ 61 bị 429 |
| D2 | DoS | Spam hàng loạt tới người lạ | Cao | Hội thoại đầu chỉ cho 1 tin chữ; ≤ 20 hội thoại mới mỗi ngày; ≤ 30 pending cùng lúc; người nhận chặn là xong; báo cáo và đếm báo cáo trên mỗi người dùng; email phải xác minh mới gửi | Tin thứ hai trong pending bị 409 |
| D3 | DoS | Mở rất nhiều socket | Trung | ≤ 5 socket mỗi người (4403 đóng cái cũ nhất); giới hạn kết nối mới mỗi IP ở reverse proxy; vé 30 giây một lần | Socket thứ 6 đẩy socket đầu ra |
| D4 | DoS | Dồn `typing`, `ping` | Thấp | Tối đa 10 sự kiện/giây/socket, quá thì đóng 4429; `typing` giới hạn 1 mỗi 2 giây, bỏ im | Gửi 100 sự kiện/giây bị đóng |
| D5 | DoS | Truy vấn nặng (tải toàn bộ lịch sử, tìm người) | Trung | `limit ≤ 100`; không offset; chỉ mục theo khóa chính; tìm người chỉ tiền tố có chỉ mục | `limit=10000` bị 422/cắt về 100 |
| D6 | DoS | Vòng `recheck` 60 giây của `RealtimeGateway` gọi Redis từng socket | Trung | Gom theo `sid` và dùng pipeline; làm trước khi bật tính năng (roadmap bước 0) | Test tải 5.000 socket giữ thời gian recheck < 1 giây |
| D7 | DoS | Tệp ảnh khổng lồ hoặc bom giải nén | Trung | `byteSize ≤ 8 MB` kiểm ở `complete` bằng kích thước object thật; giới hạn width/height ≤ 8.000 và tổng điểm ảnh ≤ 40 triệu; không giải mã ảnh trong tiến trình API (chỉ đọc header) | Ảnh 20.000×20.000 bị từ chối |
| E1 | Elevation | User gọi API admin | Cao | `message:moderate` chỉ admin; `PermissionsGuard` mặc định từ chối | User gọi resolve bị 403 |
| E2 | Elevation | Gửi tin vào hội thoại đã rời hoặc bị khóa | Trung | Kiểm `left_at IS NULL` và trạng thái tài khoản ở mỗi lần gửi; phiên bị thu hồi thì socket bị đóng (đã có) | Sau `account_locked`, gửi trả 401/403 |
| E3 | Elevation | Người khởi tạo tự chấp nhận yêu cầu của chính mình | Trung | `accept` chỉ cho người không phải `initiator_id` | Người khởi tạo gọi accept bị 409 |
| E4 | Elevation | CORS rộng trên gateway (`origin: true` + `credentials: true`) cho phép trang lạ nối socket bằng cookie | Cao | Danh sách origin tường minh từ cấu hình; xác thực chỉ bằng vé (không dựa cookie); kiểm `Origin` khi bắt tay | Origin lạ bị từ chối |
| E5 | Elevation | Bỏ qua cổng "email đã xác minh" | Thấp | Kiểm trong service gửi tin và tạo hội thoại, không ở frontend | Gọi API trực tiếp với tài khoản chưa xác minh bị 403 |

## 4. Quyền riêng tư và pháp lý

- Người dùng xóa tài khoản: đặt `left_at`; tên hiển thị thành "Người dùng đã xóa"; tin của họ ở hội thoại của người khác được giữ lại hay xóa là quyết định pháp lý (câu hỏi mở). Mặc định: giữ, ẩn danh.
- Quyền xuất dữ liệu của chủ tài khoản: dựa vào `idx_messages_sender_created` hoặc job đọc theo từng hội thoại; không làm API bản đầu, ghi nhận để làm khi cần.
- Giữ báo cáo 180 ngày rồi xóa phần `context_snapshot`.
- Điều khoản và giao diện phải nói rõ: không mã hóa đầu cuối; tin bị báo cáo có thể được xem bởi người vận hành.
- Đối chiếu Nghị định 13/2023/NĐ-CP với bộ phận pháp lý (đây là tham chiếu, không phải kết luận pháp lý).

## 5. Bí mật và cấu hình

- Không có khóa mới. Dùng cấu hình MinIO và Redis sẵn có; kênh nhắn tin dùng cùng thông tin xác thực Redis (xem xét tách tài khoản Redis cho Pub/Sub ở môi trường thật).
- Danh sách origin của socket nằm ở biến môi trường, không viết cứng.
- Không ghi URL ký, vé, access token vào log.

## 6. Việc phải làm trước khi mở cho người dùng

1. Siết CORS và kiểm `Origin` ở `RealtimeGateway` (E4).
2. Gom và pipeline vòng `recheck` (D6).
3. Giới hạn số socket mỗi người và tốc độ sự kiện mỗi socket (D3, D4).
4. Kiểm thử IDOR đầy đủ trên mọi route (I1).
5. Cập nhật điều khoản và thông báo trên giao diện (mục 4).
