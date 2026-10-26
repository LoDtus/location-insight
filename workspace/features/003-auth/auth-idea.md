# Xác thực (Authentication)

**Feature ID:** 003-auth
**Type:** New Feature
**Status:** Ready for Planning

## Vấn đề <!-- key: problem -->

Địa Thế chưa có cơ chế đăng nhập. Không có danh tính thì không lưu được địa điểm, không giới hạn được lượt phân tích theo người dùng, không tính được gói trả phí và không tách được quyền admin. Người dùng cũng cần dùng trên nhiều trình duyệt và thiết bị, tự quản lý và đăng xuất từ xa khi mất máy.

## Bối cảnh hiện tại <!-- key: current_context -->

- `website/` (Next.js) đã có các route `/auth/login`, `/auth/register`, `/auth/fogot-password`, `/auth/reset-password` và thư mục `features/auth` nhưng các file `auth.*.ts` đang rỗng. Chưa gọi backend.
- `backend/` (NestJS 12, ESM) mới có `AppModule` và `UserModule` mẫu. Chưa có guard, DB, Redis.
- Backend không publish cổng ra host. Trình duyệt chỉ nói chuyện với website, website chuyển tiếp (proxy) tới `http://backend`.
- Tài liệu pháp lý (`005-legal`) đã nêu: đăng nhập email/Google, JWT, refresh token lưu Redis hoặc DB, nhật ký IP, đủ 18 tuổi.
- Quy tắc dự án (`.cursor/rules/security.md`): access token 15–30 phút, refresh token thu hồi được lưu Redis/DB, cookie `HttpOnly`/`Secure`/`SameSite`, Argon2id, rate limit, deny-by-default.

## Mục tiêu <!-- key: goal -->

Người dùng đăng nhập bằng Google (và email + mật khẩu nếu bật), dùng đồng thời nhiều thiết bị, xem danh sách thiết bị, đăng xuất một hoặc nhiều thiết bị và thấy hiệu lực gần như tức thì. Hệ thống chặn chiếm phiên, dùng lại token bị đánh cắp và dò mật khẩu, mà không làm chậm API đáng kể.

## Phạm vi <!-- key: scope -->

**In scope:**

- Đăng nhập Google OAuth 2.0 (Authorization Code + PKCE, kiểm tra ID token).
- Đăng ký, đăng nhập email + mật khẩu, xác minh email, quên và đặt lại mật khẩu (bật/tắt bằng cấu hình).
- JWT Bearer access token ngắn hạn, refresh token xoay vòng, phát hiện dùng lại.
- Nhiều phiên song song theo thiết bị/trình duyệt, danh sách thiết bị, đổi tên, đăng xuất từng phiên, đăng xuất các phiên khác, đăng xuất tất cả.
- Thu hồi tức thời bằng Redis, đẩy sự kiện realtime tới các tab/thiết bị đang mở.
- Khóa/mở tài khoản, buộc đăng xuất khi đổi mật khẩu hoặc xóa tài khoản.
- Xác thực lại (step-up) trước thao tác nhạy cảm.
- Rate limit và chống dò tài khoản, nhật ký sự kiện bảo mật.
- Xác thực dịch vụ nội bộ (service-to-service) ở mức nguyên tắc.

**Out of scope (non-goals):**

- Phân quyền theo vai trò và gói: xem `004-rbac`.
- MFA/TOTP cho người dùng thường, passkey, đăng nhập Facebook/Apple (ghi vào hướng mở rộng).
- Đăng nhập app mobile native (thiết kế để mở rộng, chưa làm giai đoạn này).
- Single sign-on doanh nghiệp, tự làm identity provider, API key công khai cho bên thứ ba.
- Gửi email marketing. Chỉ gửi email giao dịch (xác minh, đặt lại mật khẩu).

## Tiêu chí thành công <!-- key: success_criteria -->

- Đăng xuất từ xa: thiết bị bị đăng xuất bị từ chối ở request API kế tiếp (dưới 1 giây sau khi lệnh được xác nhận) và nhận thông báo realtime trong dưới 2 giây khi đang mở.
- Thêm kiểm tra phiên vào mỗi request API không làm p95 tăng quá 3 ms (một vòng Redis).
- Token refresh bị dùng lại (ngoài cửa sổ cho phép) làm phiên bị thu hồi và ghi log.
- Mất Redis không làm ai bị đăng xuất vĩnh viễn: client tự refresh qua Postgres và đăng nhập tiếp.
- Không có token hay mật khẩu nào xuất hiện trong log, URL hoặc localStorage.

## Đối tượng sử dụng chính & Kịch bản sử dụng <!-- key: primary_actors -->

- **Khách (guest):** chưa đăng nhập, xem trang công khai, bấm "Đăng nhập với Google".
- **Người dùng (user):** đăng nhập trên laptop và điện thoại, mở "Thiết bị đăng nhập", thấy máy lạ, bấm đăng xuất máy đó.
- **Quản trị (admin):** đăng nhập, bị yêu cầu xác thực lại trước thao tác nhạy cảm, có thể khóa tài khoản và buộc đăng xuất.
- **Người vận hành (solo dev):** cấu hình khóa ký, danh sách admin, rate limit; đọc nhật ký sự kiện.

## Nơi bị ảnh hưởng <!-- key: impacted_areas -->

- `backend`: module mới `auth` (guard toàn cục, service phiên, Google, mật khẩu), `user`, kết nối PostgreSQL và Redis.
- `website`: `features/auth`, route `/auth/*`, lớp gọi API có tự refresh, route proxy `/api/*`, cookie refresh, kênh realtime.
- Hạ tầng: Redis, PostgreSQL, biến môi trường (khóa ký, Google client), HTTPS.
- Dịch vụ phụ (`services/*` nếu có): xác minh token hoặc dùng khóa nội bộ.
- `005-legal`: chính sách quyền riêng tư và cookie phải khớp dữ liệu phiên thực tế (IP, thiết bị, thời hạn).

## Phụ thuộc <!-- key: dependencies -->

- Chặn: `004-rbac` dùng danh tính và `sid` từ tính năng này.
- Cần trước: trang chính sách quyền riêng tư và điều khoản công khai (`005-legal`) để Google duyệt consent screen.
- Cần: nhà cung cấp gửi email giao dịch nếu bật đăng nhập mật khẩu.

## Dữ liệu nhạy cảm & Tuân thủ <!-- key: data_sensitivity -->

Mật khẩu (băm), email, họ tên, ảnh đại diện, IP, user agent, mã định danh Google (`sub`), refresh token (chỉ lưu băm), nhật ký đăng nhập. Là dữ liệu cá nhân theo luật bảo vệ dữ liệu cá nhân: cần cơ sở xử lý, thời hạn lưu và quyền xóa đã nêu trong `005-legal`. Phân tích sâu nằm trong `threat-model.md`.

## Ràng buộc <!-- key: constraints -->

- JWT Bearer + Google OAuth 2.0 (yêu cầu của chủ dự án).
- Dùng Redis cho thu hồi và rate limit.
- Một người vận hành: ưu tiên thư viện phổ biến, ít bộ phận chuyển động, dễ đọc.
- Không lưu bí mật trong mã nguồn; mọi giá trị qua biến môi trường ở `.env` gốc.
- Backend không publish cổng; mọi lời gọi qua website hoặc mạng nội bộ.

## Rủi ro & Điểm chưa rõ <!-- key: risks_unknowns -->

- Redis là điểm nghẽn: nếu Redis không phản hồi, API xác thực phải từ chối (đóng an toàn) thay vì bỏ qua kiểm tra.
- Refresh đồng thời từ nhiều tab có thể bị hiểu nhầm là dùng lại token, gây đăng xuất oan. Giải pháp: khóa dòng DB, cửa sổ nới 10 giây, khóa chéo tab ở frontend.
- Gửi email đặt lại mật khẩu phụ thuộc nhà cung cấp ngoài; người vận hành không có email doanh nghiệp.
- Google có thể từ chối consent screen nếu thiếu trang pháp lý hoặc tên miền chưa xác minh.

## Giả định (Assumptions) <!-- key: assumptions -->

- A1. Access token sống 15 phút; phiên trượt 14 ngày không hoạt động, tối đa 30 ngày thì phải đăng nhập lại.
- A2. Mỗi tài khoản tối đa 10 phiên cùng lúc; phiên cũ nhất bị thay khi vượt.
- A3. Đăng nhập email + mật khẩu có trong giai đoạn 1 nhưng tắt được bằng `AUTH_PASSWORD_ENABLED=false`; khi tắt, chỉ còn Google.
- A4. Frontend giữ access token trong bộ nhớ; refresh token nằm trong cookie `HttpOnly` cho web, trong body cho client native (làm sau).
- A5. Liên kết tài khoản theo email chỉ tự động khi cả hai phía đã xác minh email.
- A6. Admin được tạo bằng script/CLI của người vận hành, không qua API.
- A7. Vùng giờ mốc ngày là `Asia/Ho_Chi_Minh`.
- A8. Một instance Redis (không cluster); mất dữ liệu Redis là chấp nhận được vì nguồn sự thật là PostgreSQL.

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

- Q1. Có giữ đăng nhập email + mật khẩu ở giai đoạn 1, hay chỉ Google để giảm bề mặt tấn công và không cần gửi email? (Đề xuất: chỉ bật Google trước, giữ mã sẵn sàng; xem research Quyết định 7.)
- Q2. Chọn nhà cung cấp email giao dịch nào (SMTP của dịch vụ miễn phí hay dịch vụ chuyên dụng)? Chỉ cần nếu Q1 giữ mật khẩu.
- Q3. Admin có bắt buộc TOTP ở giai đoạn 1 không? (Đề xuất: giai đoạn 2; giai đoạn 1 dùng Google có bật xác minh 2 bước và xác thực lại.)
- Q4. Có cho khách dùng thử phân tích không cần đăng nhập? (Đề xuất: không, vì tốn tiền gọi model; đã chốt ở `004-rbac`.)
- Q5. Tên miền và địa chỉ callback chính thức để đăng ký với Google.

## Tính năng liên quan <!-- key: related_features -->

- `004-rbac`: phân quyền, gói, hạn mức.
- `005-legal`: chính sách quyền riêng tư, cookie, điều khoản.
- `006-buying`: trang chi tiết tin, che số liên hệ với khách.
- `001-ui`, `002-landing-page`: giao diện đăng nhập.

## Nhật ký cập nhật <!-- key: update_log -->

- 26/10/2026: tạo bản đầu từ yêu cầu của chủ dự án, không qua vòng hỏi; mọi điểm chưa chốt ghi ở Giả định và Câu hỏi mở.
