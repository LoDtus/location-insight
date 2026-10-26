# Xác thực (Authentication)

**Feature ID:** 003-auth
**Status:** Draft
**Last Updated:** 26/10/2026

## Tổng quan <!-- key: overview -->

Cho phép người dùng đăng nhập bằng Google (và email + mật khẩu nếu bật), dùng nhiều thiết bị cùng lúc, tự quản lý thiết bị và đăng xuất từ xa gần như tức thì. Access token là JWT ngắn hạn mang `sid`; phiên được kiểm tra trong Redis mỗi request; refresh token xoay vòng, nguồn sự thật nằm ở PostgreSQL. Phân quyền theo vai trò và gói thuộc `004-rbac`.

## Mục tiêu & Phạm vi <!-- key: goals_scope -->

**In scope:**

- Đăng nhập Google (Authorization Code + PKCE), đăng ký/đăng nhập/quên mật khẩu bằng email (cờ bật tắt).
- JWT Bearer, refresh xoay vòng, phát hiện dùng lại.
- Nhiều phiên, danh sách thiết bị, đăng xuất một/các thiết bị khác/tất cả, đăng xuất từ xa realtime.
- Khóa tài khoản, step-up, rate limit, nhật ký sự kiện.

**Out of scope:**

- Phân quyền theo vai trò/gói và hạn mức (`004-rbac`).
- MFA người dùng, passkey, đăng nhập mạng xã hội khác, SSO doanh nghiệp.
- Ứng dụng mobile native (thiết kế sẵn khả năng mở rộng).

## Đối tượng liên quan <!-- key: actors -->

- Khách (guest): chưa đăng nhập.
- Người dùng (user): đã đăng nhập.
- Quản trị (admin): đã đăng nhập, role admin.
- Người vận hành: cấu hình, đọc nhật ký, tạo admin bằng CLI.
- Hệ thống ngoài: Google OAuth, nhà cung cấp email giao dịch (nếu bật mật khẩu).

## Yêu cầu chức năng <!-- key: functional_requirements -->

- **FR-01 (Đăng nhập Google):** `GET /auth/google/start` và `/auth/google/callback` theo Authorization Code + PKCE + `state` + `nonce`; kiểm tra ID token (chữ ký, `iss`, `aud`, `exp`, `nonce`, `email_verified`); khóa danh tính là `sub`.
- **FR-02 (Liên kết tài khoản):** tự gộp theo email chỉ khi tài khoản hiện có đã xác minh email; nếu chưa, trả `link_required`.
- **FR-03 (Đăng ký/đăng nhập mật khẩu):** theo cờ `AUTH_PASSWORD_ENABLED`; Argon2id; xác minh email bắt buộc; phản hồi đồng nhất.
- **FR-04 (Quên/đặt lại mật khẩu):** token một lần băm lưu DB, 15 phút; đặt lại thu hồi mọi phiên.
- **FR-05 (Access token):** JWT ES256, 15 phút, claim `iss, aud, sub, sid, jti, iat, exp`, header `typ: at+jwt`, `kid`.
- **FR-06 (Kiểm tra mỗi request):** `AuthGuard` toàn cục xác minh JWT rồi pipeline Redis kiểm tra `session:active:{sid}` và `cache:authz:{userId}`; route công khai phải có `@Public()`.
- **FR-07 (Refresh):** `POST /auth/refresh` xoay token, khóa dòng DB, cửa sổ nới 10 giây, dùng lại ngoài cửa sổ thì thu hồi phiên.
- **FR-08 (Cookie refresh cho web):** `__Secure-dt_rt`, `HttpOnly; Secure; SameSite=Strict; Path=/api/auth`; kiểm tra `Origin` và `X-Requested-With`.
- **FR-09 (Khởi động phiên im lặng):** frontend gọi refresh lúc tải trang để lấy access token vào bộ nhớ.
- **FR-10 (Nhiều thiết bị):** mỗi thiết bị một phiên; tối đa 10 phiên, vượt thì thu hồi phiên cũ nhất (`evicted`).
- **FR-11 (Quản lý thiết bị):** `GET /auth/sessions`, `PATCH /auth/sessions/{id}` đổi tên, `DELETE` một phiên, `POST …/revoke-others`, `POST …/revoke-all`; phiên hiện tại được đánh dấu `isCurrent`.
- **FR-12 (Đăng xuất):** `POST /auth/logout` thu hồi phiên hiện tại, xóa cookie, idempotent.
- **FR-13 (Thu hồi tức thời):** commit PostgreSQL rồi `DEL session:active`, đặt `session:revoked`, `PUBLISH events:session:revoked`; có job đối soát 60 giây.
- **FR-14 (Realtime):** WebSocket nối bằng vé một lần; nhận `session.revoked` rồi đóng 4401; kiểm tra lại mỗi 60 giây; client xóa trạng thái và về trang đăng nhập.
- **FR-15 (Khóa/xóa tài khoản):** `status` đổi sang `locked`/`deleted` thì thu hồi mọi phiên và xóa `cache:authz`.
- **FR-16 (Step-up):** `POST /auth/reauth`; thao tác nhạy cảm cần `auth_time` ≤ 10 phút, nếu không `403 reauth_required`.
- **FR-17 (Rate limit):** theo IP, tài khoản, phiên; Redis; chi tiết ở Bối cảnh kỹ thuật.
- **FR-18 (Nhật ký bảo mật):** ghi `auth_events` cho đăng nhập, đăng xuất, thu hồi, dùng lại token, đổi mật khẩu, khóa; lưu 12 tháng.
- **FR-19 (Dọn dẹp):** job hằng ngày xóa phiên hết hạn/thu hồi quá 30 ngày, token một lần quá hạn, sự kiện quá 12 tháng.
- **FR-20 (Tạo admin):** chỉ bằng script CLI của người vận hành, ghi `auth_events`.

## Quy tắc nghiệp vụ <!-- key: business_rules -->

- **BR-01 (Tuổi):** đăng ký yêu cầu xác nhận đủ 18 tuổi và đồng ý điều khoản (khớp `005-legal`).
- **BR-02 (Thời hạn phiên):** idle 14 ngày trượt, tuyệt đối 30 ngày.
- **BR-03 (Thông báo thiết bị mới):** đăng nhập từ thiết bị chưa thấy hiện thông báo trong ứng dụng ("Thiết bị mới đăng nhập"); email chỉ gửi nếu kênh email đã bật.
- **BR-04 (Cùng nội dung lỗi):** đăng nhập sai, chưa xác minh, bị khóa đều trả `invalid_credentials`; quên mật khẩu luôn `202`.
- **BR-05 (Không khóa cứng):** sai mật khẩu chỉ làm chậm tăng dần (tối đa 15 phút), không khóa tài khoản.
- **BR-06 (Quyền lấy từ nguồn tin cậy):** `role`, `status`, `plan` đọc từ Redis/DB, không tin claim do client gửi.
- **BR-07 (Xóa tài khoản):** thu hồi mọi phiên ngay, xóa dữ liệu cá nhân sau 30 ngày; giữ bản ghi giao dịch theo luật.

## Tóm tắt luồng người dùng <!-- key: user_flow_summary -->

1. Khách bấm "Đăng nhập với Google" → Google → callback → backend tạo phiên, đặt cookie → website gọi refresh → có access token trong bộ nhớ.
2. Mỗi lần gọi API: `Authorization: Bearer`. Hết hạn thì tự refresh, chỉ một lần cho nhiều request song song.
3. Người dùng mở "Thiết bị đăng nhập", bấm "Đăng xuất" ở một máy: máy đó nhận thông báo realtime, bị đưa về trang đăng nhập; API từ chối ngay.
4. Token refresh bị dùng lại: phiên bị thu hồi, người dùng thấy cảnh báo ở lần đăng nhập sau.

## Bối cảnh kỹ thuật <!-- key: technical_context -->

- Mô hình phiên: JWT ES256 15 phút + `sid` kiểm tra Redis; refresh đục băm SHA-256 trong PostgreSQL, xoay, nới 10 giây (research Quyết định 1–3).
- Trình duyệt: access ở bộ nhớ, refresh ở cookie `HttpOnly` (Quyết định 4).
- Google: code + PKCE + state + nonce, thư viện `jose` (Quyết định 5).
- Thu hồi realtime: Redis Pub/Sub + WebSocket với vé một lần (Quyết định 6).
- Mật khẩu: Argon2id, tắt mặc định ở production tới khi có email (Quyết định 7).
- Rate limit mặc định (cấu hình trong `auth.config.ts`):

| Hành động | Giới hạn |
| --- | --- |
| Đăng nhập theo IP | 20 lần / 15 phút |
| Đăng nhập sai theo tài khoản | 5 lần miễn phí rồi chờ 2^n giây, tối đa 15 phút |
| Đăng ký theo IP | 5 / giờ |
| Quên mật khẩu | 3 / giờ cho mỗi email, 10 / giờ cho mỗi IP |
| Refresh | 30 / phút cho mỗi phiên |
| Google start | 30 / 10 phút cho mỗi IP |
| API chung đã đăng nhập | 300 / phút cho mỗi người dùng (có thể ghi đè theo route) |

- Ngân sách hiệu năng: kiểm tra phiên thêm ≤ 3 ms p95; refresh ≤ 150 ms p95; callback Google ≤ 1 s (không tính Google); Argon2id hiện tại ≈ 50–100 ms CPU mỗi lần, giới hạn 4 băm đồng thời.
- Cấu hình (biến môi trường, `.env` gốc): `AUTH_JWT_PRIVATE_KEY`, `AUTH_JWT_PUBLIC_KEYS`, `AUTH_JWT_KID`, `AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`, `AUTH_ACCESS_TTL_SECONDS=900`, `AUTH_SESSION_IDLE_DAYS=14`, `AUTH_SESSION_ABSOLUTE_DAYS=30`, `AUTH_MAX_SESSIONS=10`, `AUTH_PASSWORD_ENABLED=false`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `AUTH_ALLOWED_REDIRECTS`, `AUTH_ALLOWED_ORIGINS`, `REDIS_URL`, `TRUST_PROXY_HOPS`.
- Cấu trúc đề xuất trong `backend/src/modules/auth/`: `auth.module.ts`, `auth.controller.ts`, `auth.service.ts`, `session.service.ts`, `token.service.ts`, `google-oauth.service.ts`, `password.service.ts`, `auth.guard.ts`, `session-verifier.service.ts`, `auth.config.ts`, `auth.constants.ts`, `dto/*.dto.ts`, `realtime.gateway.ts`. Frontend: `website/src/features/auth/` (`auth.api.ts`, `auth.service.ts`, `auth.slice.ts`, hook `use-auth.ts`, lớp fetch tự refresh có khóa Web Locks).
- Trạng thái mã nguồn hiện tại: các file `website/src/features/auth/auth.*.ts` đang rỗng; backend mới có `UserModule` mẫu; chưa có kết nối PostgreSQL/Redis.

## Phụ thuộc <!-- key: dependencies -->

- Chặn `004-rbac` (dùng `principal`, `sid`, `cache:authz`).
- Cần `005-legal` (trang chính sách, điều khoản, cookie) trước khi Google duyệt.
- Cần PostgreSQL, Redis; email giao dịch nếu bật mật khẩu.

## Ràng buộc <!-- key: constraints -->

- JWT Bearer + Google OAuth 2.0; dùng Redis.
- Không bí mật trong mã nguồn; biến môi trường chỉ ở `.env` gốc.
- Backend không publish cổng; qua proxy website cùng origin.
- Thư viện chọn loại đang duy trì (không bỏ quá 2 năm).
- Một người vận hành: ưu tiên mã đơn giản, đọc được.

## Tài liệu liên quan (Artifacts) <!-- key: artifacts -->

- Diagrams: [Đăng nhập Google](diagrams/sequence-login-google.mmd) · [Kiểm tra mỗi request](diagrams/sequence-request-verify.mmd) · [Refresh xoay vòng](diagrams/sequence-refresh-rotation.mmd) · [Thu hồi realtime](diagrams/sequence-revoke-realtime.mmd) · [Vòng đời phiên](diagrams/state-session.mmd) · [Luồng mật khẩu](diagrams/flow-password-login.mmd)
- API Contracts: [REST](interfaces/rest-api.yml) · [WebSocket](interfaces/socket-api.yml)
- Database Schemas: [postgresql.dbml](postgresql.dbml) · [redis.md](redis.md)
- Technical Research: [research.md](research.md)
- Threat model: [threat-model.md](threat-model.md)
- Idea: [auth-idea.md](auth-idea.md)

## Tiêu chí nghiệm thu (Acceptance Criteria) <!-- key: acceptance_criteria -->

- [ ] **AC-01:** Given khách chưa đăng nhập, When hoàn tất đăng nhập Google, Then có access token trong bộ nhớ, cookie `HttpOnly` được đặt, và không có token nào trong URL, `localStorage`, log.
- [ ] **AC-02:** Given `state` sai hoặc đã dùng, When callback được gọi, Then chuyển về `/auth/login?error=oauth_state` và không tạo phiên.
- [ ] **AC-03:** Given hai thiết bị đăng nhập, When thiết bị A đăng xuất thiết bị B, Then API với token của B trả `401 session_revoked` trong dưới 1 giây và B (đang mở) nhận `session.revoked` trong dưới 2 giây.
- [ ] **AC-04:** Given "Đăng xuất tất cả", When hoàn tất, Then mọi phiên (kể cả hiện tại) không còn gọi được API và refresh bị từ chối.
- [ ] **AC-05:** Given refresh token cũ bị dùng sau 10 giây, When gửi `/auth/refresh`, Then phiên bị thu hồi, có `auth_events` loại `refresh_reuse_detected`.
- [ ] **AC-06:** Given 20 request refresh đồng thời của cùng một phiên trong 10 giây, When xử lý, Then không phiên nào bị thu hồi.
- [ ] **AC-07:** Given Redis bị mất toàn bộ dữ liệu, When client gọi API với token còn hạn, Then nhận `session_inactive`, tự refresh một lần và tiếp tục mà không phải đăng nhập lại.
- [ ] **AC-08:** Given Redis không phản hồi, When gọi API cần đăng nhập, Then trả `503` và không bỏ qua kiểm tra.
- [ ] **AC-09:** Given token ký bằng `none`, `HS256`, hoặc `kid` lạ, When gọi API, Then `401 token_invalid`.
- [ ] **AC-10:** Given email chưa tồn tại và email đã tồn tại, When quên mật khẩu, Then phản hồi giống hệt (trạng thái, nội dung, thời gian ±20%).
- [ ] **AC-11:** Given không có route nào gắn `@Public()` hay quyền, When chạy kiểm thử kiểm kê route, Then mọi route đều bị từ chối khi không có token (deny-by-default).
- [ ] **AC-12:** Given thêm 11 phiên, When đăng nhập phiên thứ 11, Then phiên cũ nhất bị thu hồi với lý do `evicted`.
- [ ] **AC-13:** Given thao tác đổi mật khẩu, When `auth_time` quá 10 phút, Then `403 reauth_required`.
- [ ] **AC-14:** Given p95 trên bộ test tải 200 request/giây, When so sánh có và không có kiểm tra phiên, Then chênh lệch ≤ 3 ms.

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

- Q1–Q5 trong [auth-idea.md](auth-idea.md): giữ mật khẩu ở giai đoạn 1 hay không, nhà cung cấp email, TOTP cho admin, dùng thử cho khách, tên miền chính thức.
- Có cần xử lý Google "Cross-Account Protection" (RISC) để biết khi tài khoản Google bị khóa không? (Đề xuất: không ở giai đoạn 1.)
- Cách chuyển tiếp IP thật qua proxy website tới backend (số hop tin cậy) cần chốt khi triển khai.

## Nhật ký cập nhật <!-- key: update_log -->

- 26/10/2026: tạo đặc tả đầu tiên; các quyết định 1–8 ở `research.md`.
