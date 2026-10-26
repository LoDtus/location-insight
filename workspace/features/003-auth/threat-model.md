# Threat Model — Xác thực (003-auth)

Phương pháp: STRIDE theo `02-planning-design/06-threat-modeling.md`, cộng rà soát bề mặt tấn công, xác thực, phân quyền, bí mật, mã hóa, nhật ký. Mức: **Cao** (phải xử lý trước khi mở đăng ký), **Trung** (xử lý trong giai đoạn 1), **Thấp** (chấp nhận hoặc theo dõi).

## 1. Tài sản cần bảo vệ

- Phiên đăng nhập (refresh token, access token).
- Mật khẩu (nếu bật), email, định danh Google (`sub`).
- Khóa ký JWT, Google client secret.
- Tính toàn vẹn của vai trò và trạng thái tài khoản.
- Nhật ký sự kiện bảo mật.

## 2. Bề mặt tấn công

| Bề mặt | Ai gọi được | Ghi chú |
| --- | --- | --- |
| `/auth/google/start`, `/auth/google/callback` | công khai | state, redirect |
| `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email` | công khai | dò tài khoản, dò mật khẩu, spam email |
| `/auth/refresh` | giữ cookie/refresh token | CSRF, đánh cắp token |
| `/auth/*` còn lại, `/auth/sessions*` | Bearer | chiếm quyền phiên khác |
| WebSocket `/api/realtime` | vé một lần | bỏ qua kiểm tra thu hồi trên socket |
| Redis, PostgreSQL | mạng nội bộ | lộ cổng, mật khẩu yếu |
| Frontend | XSS | lấy access token trong bộ nhớ |

## 3. Phân tích STRIDE

| # | Loại | Mối đe dọa | Mức | Biện pháp | Kiểm thử |
| --- | --- | --- | --- | --- | --- |
| S1 | Spoofing | Giả mạo token, đổi `alg` thành `none` hoặc `HS256` bằng khóa công khai | Cao | Cố định `ES256` phía server, bỏ qua `jku/jwk/x5u`, kiểm tra `typ`, `iss`, `aud`, `kid` thuộc danh sách | Unit test token `none`, `HS256`, `kid` lạ, `aud` sai |
| S2 | Spoofing | CSRF đăng nhập / chèn mã (authorization code injection) | Cao | `state` + PKCE `S256` + `nonce`, `GETDEL` dùng một lần, TTL 10 phút | Test callback sai/thiếu/dùng lại `state` |
| S3 | Spoofing | Chiếm tài khoản bằng email trùng (pre-hijack): kẻ xấu đăng ký bằng email nạn nhân trước, nạn nhân sau đăng nhập Google rồi bị gộp | Cao | Chỉ tự gộp khi tài khoản hiện có đã xác minh email; không đăng nhập được bằng mật khẩu khi chưa xác minh; khóa danh tính là `sub` | Test luồng gộp có/không xác minh |
| S4 | Spoofing | Dò mật khẩu, nhồi thông tin đăng nhập (credential stuffing) | Cao | Rate limit IP + độ trễ tăng dần theo tài khoản, Argon2id, kiểm tra mật khẩu bị lộ, phản hồi đồng nhất | Test tải: 1000 lần sai không khóa tài khoản người khác |
| S5 | Spoofing | Dò sự tồn tại tài khoản qua thông báo lỗi hoặc thời gian phản hồi | Trung | Luôn 202/401 cùng nội dung; luôn chạy một lần băm mật khẩu giả khi không tìm thấy user | Test so sánh thời gian ±20% |
| S6 | Spoofing | Open redirect sau đăng nhập | Trung | `redirectTo` chỉ nhận đường dẫn nội bộ thuộc danh sách; không bao giờ nhận URL tuyệt đối | Test `//evil.com`, `https://…`, `\\evil` |
| T1 | Tampering | Mass assignment: client gửi `role` hoặc `status` khi đăng ký/cập nhật | Cao | DTO `whitelist: true`, `forbidNonWhitelisted`, không có trường vai trò trong DTO người dùng | Test gửi `role: admin` |
| T2 | Tampering | Xoay vòng khóa ký sai làm token cũ hoặc giả được chấp nhận | Trung | Danh sách khóa theo `kid`; khóa cũ gỡ sau 15 phút; test xoay khóa | Test hai `kid` song song |
| T3 | Tampering | Sửa log để che dấu | Thấp | Bảng chỉ thêm; quyền DB của ứng dụng không có `UPDATE/DELETE` trên `auth_events` (trừ job xóa theo tuổi dùng vai trò riêng) | |
| R1 | Repudiation | Người dùng/admin chối hành động (đổi mật khẩu, khóa tài khoản) | Trung | `auth_events` ghi `type`, `user_id`, `session_id`, IP, UA, thời gian; thao tác admin ghi cả `actor_id` (xem `004-rbac`) | |
| I1 | Information disclosure | Token/mật khẩu lọt vào log hoặc URL | Cao | Che `Authorization`, cookie, `password`, `refreshToken`, `code`; không bao giờ đặt token trên query; vé WebSocket chỉ sống 30 giây và dùng một lần | Test snapshot log |
| I2 | Information disclosure | XSS lấy access token trong bộ nhớ | Cao | Refresh ở cookie `HttpOnly` (không lấy được); access 15 phút; CSP chặt, không `eval`, không `dangerouslySetInnerHTML` với dữ liệu người dùng; `Referrer-Policy: no-referrer` | Kiểm tra header CSP; quét XSS |
| I3 | Information disclosure | Lộ cơ sở dữ liệu thì lộ refresh token | Trung | Chỉ lưu SHA-256 của refresh token; mật khẩu Argon2id; email không băm nhưng truy cập DB hạn chế | |
| I4 | Information disclosure | Liệt kê tài nguyên qua `/auth/sessions/{id}` | Trung | Phiên của người khác trả `404` cùng nội dung | Test truy cập `sid` người khác |
| I5 | Information disclosure | Lộ vị trí qua IP trong danh sách thiết bị | Thấp | Che octet cuối khi hiển thị; chỉ chủ tài khoản thấy | |
| D1 | Denial of service | Dội `/auth/login` hoặc gửi hàng loạt email đặt lại mật khẩu | Cao | Rate limit theo IP và theo tài khoản; hạn mức email theo giờ; giới hạn kích thước body (10 KB) | Test tải |
| D2 | Denial of service | Argon2id tốn CPU bị lợi dụng | Trung | Giới hạn đồng thời (hàng đợi tối đa 4 băm cùng lúc, còn lại chờ hoặc 429), rate limit trước khi băm | Test song song |
| D3 | Denial of service | Redis hỏng hoặc đầy làm sập đăng nhập | Trung | Timeout 150 ms; `volatile-lru`; mọi khóa có TTL; cảnh báo bộ nhớ ≥ 70%; phục hồi tự nhiên nhờ PostgreSQL | Test dừng Redis: API trả 503, bật lại thì tự khỏi |
| D4 | Denial of service | Kẻ xấu cố ý sai mật khẩu để khóa nạn nhân | Trung | Không khóa cứng; chỉ làm chậm có trần 15 phút theo (tài khoản) và đếm riêng theo (IP, tài khoản) | |
| E1 | Elevation of privilege | Dùng lại refresh token bị đánh cắp | Cao | Xoay vòng + phát hiện dùng lại → thu hồi phiên; thông báo người dùng | Test dùng lại ngoài 10 giây |
| E2 | Elevation of privilege | Thu hồi bị bỏ sót ở WebSocket/kênh khác | Cao | Cùng một `SessionVerifier` cho HTTP và socket; kiểm tra lại mỗi 60 giây; test e2e đóng socket | Test: thu hồi → socket đóng < 2 giây |
| E3 | Elevation of privilege | Race: refresh đồng thời tạo hai nhánh hợp lệ | Trung | `SELECT … FOR UPDATE` theo phiên; cửa sổ nới 10 giây; khóa chéo tab | Test 20 refresh đồng thời |
| E4 | Elevation of privilege | Tạo admin qua API | Cao | Không có API; chỉ script CLI chạy bởi người vận hành, ghi log | Test không route nào đặt `role` |
| E5 | Elevation of privilege | Thao tác nhạy cảm bằng phiên bị chiếm | Trung | Step-up: `auth_time` ≤ 10 phút cho đổi mật khẩu, xóa tài khoản, đổi email, thao tác admin phá hủy | Test `reauth_required` |

## 4. Rà soát theo hạng mục

- **Xác thực:** đủ các lớp ở trên. Chưa có MFA cho người dùng thường (chấp nhận, ghi hướng mở rộng).
- **Phân quyền:** thuộc `004-rbac`. Ở đây chỉ bảo đảm `role` lấy từ nguồn tin cậy (Redis/DB), không từ token do client gửi.
- **Bí mật:** khóa ký ES256 (PEM), `GOOGLE_CLIENT_SECRET`, khóa mã hóa nếu có, mật khẩu DB/Redis. Tất cả trong `.env` gốc, không commit, không in log. Quy trình xoay: khóa ký 6–12 tháng một lần hoặc khi nghi lộ; client secret khi nghi lộ. Kho bí mật của nền tảng triển khai ưu tiên hơn file `.env` trong production.
- **Mã hóa:** TLS ≥ 1.2, HSTS (`max-age=31536000; includeSubDomains`), cookie `Secure`. Redis và PostgreSQL chỉ trong mạng nội bộ; bật TLS nếu chúng ở máy khác.
- **Nhật ký và kiểm toán:** sự kiện ở `auth_events`; không ghi token, mật khẩu, nội dung `Authorization`; chuỗi do người dùng nhập được làm sạch `\r\n` trước khi ghi. Cảnh báo (log mức cao) khi: `refresh_reuse_detected`, > 20 `login_failed` từ một IP trong 5 phút, đăng nhập admin từ IP mới.
- **Dịch vụ nội bộ:** dịch vụ phụ không chấp nhận JWT người dùng qua mạng công khai; dùng khóa nội bộ hoặc HMAC giữa các dịch vụ; JWT người dùng nếu được chuyển tiếp thì kiểm tra bằng khóa công khai, nhưng quyết định thu hồi vẫn gọi lại backend chính.

## 5. Rủi ro còn lại được chấp nhận

- Một access token bị lộ dùng được tối đa ~15 phút nếu cả lệnh thu hồi Redis và job đối soát cùng lỗi. Xác suất thấp, tác động hạn chế vì token không đổi được mật khẩu (cần step-up).
- Người dùng không bật xác minh 2 bước ở Google thì tài khoản Địa Thế yếu như tài khoản Google đó.
- Pub/Sub có thể rớt thông điệp; được bù bằng kiểm tra định kỳ và kiểm tra mỗi request.
- Phụ thuộc Google: Google ngừng hoạt động thì không đăng nhập mới được (nếu mật khẩu bị tắt).

## 6. Danh sách việc bảo mật bắt buộc trước khi mở đăng ký

1. Đã có trang chính sách quyền riêng tư và điều khoản công khai.
2. HTTPS, HSTS, CSP, CORS theo danh sách cho phép.
3. Rate limit bật, `trust proxy` đúng.
4. Khóa ký và secret ở biến môi trường, đã thử xoay khóa.
5. Bộ test ở cột "Kiểm thử" chạy xanh.
6. Cảnh báo cho các sự kiện bảo mật đã bật.
