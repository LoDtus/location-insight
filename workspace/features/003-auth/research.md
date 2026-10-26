# Technical Research — Xác thực (Authentication)

Nguồn tham khảo: RFC 9700 (OAuth 2.0 Security BCP), RFC 8725 (JWT BCP), RFC 9068 (JWT profile cho access token), RFC 7636 (PKCE), OWASP Cheat Sheet (Session Management, JWT, Authentication, Password Storage), tài liệu Auth0 về refresh token rotation, các bài thực hành về thu hồi JWT bằng Redis. Chi tiết các nguồn ở cuối file.

## Bản ghi quyết định 1 — Mô hình phiên: access JWT ngắn + kiểm tra phiên trong Redis + refresh xoay vòng trong PostgreSQL <!-- key: decision_record -->

**Status:** Accepted
**Category:** New Architecture Pattern
**Door Type:** One-way (đã ảnh hưởng mọi API và frontend)

### Bối cảnh <!-- key: context -->

Yêu cầu: JWT Bearer, nhiều thiết bị, đăng xuất từ xa càng nhanh càng tốt, dùng Redis. JWT thuần stateless không thu hồi được trước khi hết hạn; phiên server thuần thì mất lợi ích của JWT.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
|---|---|---|---|---|
| A. JWT thuần, chỉ đợi hết hạn | Cao | Cao | Dễ | Không thu hồi được; vi phạm yêu cầu đăng xuất nhanh |
| B. JWT + danh sách đen theo `jti` | Trung bình | Trung bình | Dễ | Phải ghi mọi token đã cấp; "đăng xuất tất cả" cần liệt kê token |
| C. JWT mang `sid` + kiểm tra danh sách phiên đang hoạt động trong Redis mỗi request | Cao | Cao | Trung bình | Một vòng Redis; thu hồi = xóa khóa; thêm kho thu hồi theo người dùng |
| D. Phiên server (cookie session) | Thấp | Cao | Khó | Trái yêu cầu JWT Bearer |

### Quyết định <!-- key: decision -->

Chọn **C**. Access token là JWT ES256 sống 15 phút, mang `sid` (id phiên) và `sub`. Mỗi request kiểm tra `sid` còn hoạt động trong Redis (danh sách trắng, không phải danh sách đen) cùng trạng thái người dùng. Refresh token là chuỗi ngẫu nhiên đục, chỉ lưu băm trong PostgreSQL, xoay vòng mỗi lần dùng. Nguồn sự thật là PostgreSQL; Redis là bộ nhớ đệm nhanh và có thể mất mà không làm ai mất phiên (client refresh để nạp lại).

Lý do chính: một cơ chế duy nhất cho "đăng xuất phiên", "đăng xuất tất cả", "khóa tài khoản", và danh sách trắng nên mặc định từ chối khi Redis thiếu dữ liệu (an toàn khi lỗi).

### Hệ quả <!-- key: consequences -->

- Mỗi request tốn một pipeline Redis (2 lệnh). Redis lỗi thì API cần đăng nhập trả 503 (đóng an toàn).
- Cùng kiểm tra phải áp dụng cho **mọi** kênh: HTTP, WebSocket lúc bắt tay và định kỳ trong kết nối. (Ví dụ lỗi thật: có CVE ở một ứng dụng chỉ kiểm tra chữ ký/hạn trên WebSocket, bỏ qua kiểm tra thu hồi.)
- Trần thời gian xấu nhất của một access token bị lộ sau khi đã thu hồi mà Redis không nhận lệnh: 15 phút, và có tiến trình đối soát giảm xuống ~60 giây.
- Cần bảng `auth_sessions` và khóa Redis theo quy ước `naming.md`.

### Khả năng đảo ngược <!-- key: reversibility -->

Có thể chuyển sang cookie session hoặc dịch vụ danh tính ngoài bằng cách thay `AuthGuard` và lớp phát token; mô hình dữ liệu phiên giữ nguyên. Đổi sang mô hình khác sau khi có client ngoài (mobile) sẽ tốn công hơn.

---

## Bản ghi quyết định 2 — Ký access token bằng ES256 (bất đối xứng) <!-- key: decision_record -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** Two-way (xoay khóa được, thay thuật toán cần phát hành lại token, tối đa 15 phút)

### Bối cảnh <!-- key: context -->

Cần ký token, cho phép dịch vụ phụ (AI, media) xác minh mà không giữ khóa ký, và tránh lỗi nhầm thuật toán.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
|---|---|---|---|---|
| HS256 | Cao | Cao | Dễ | Mọi dịch vụ xác minh đều giữ được khóa ký |
| RS256 | Cao | Trung bình | Dễ | Khóa lớn, chậm hơn |
| ES256 | Cao | Cao | Dễ | Chữ ký ngắn, xác minh nhanh, khóa công khai chia sẻ được |
| EdDSA | Trung bình | Trung bình | Dễ | Tương thích thư viện/ngôn ngữ thấp hơn |

### Quyết định <!-- key: decision -->

**ES256**, thư viện `jose` (duy trì tích cực, hỗ trợ `kid`, JWKS). Cố định thuật toán ở phía server (`algorithms: ['ES256']`), từ chối `none`, `HS*`, và bỏ qua `jku`/`jwk`/`x5u` trong header. Header `typ: at+jwt` (RFC 9068). Khóa ở biến môi trường (PEM base64), có `kid`; hỗ trợ hai khóa cùng lúc khi xoay.

### Hệ quả <!-- key: consequences -->

Cần quy trình xoay khóa (tạo khóa mới, đưa vào danh sách xác minh, đổi khóa ký, gỡ khóa cũ sau 15 phút). Dịch vụ phụ chỉ cần khóa công khai.

### Khả năng đảo ngược <!-- key: reversibility -->

Đổi thuật toán: phát hành lại, token cũ hết hạn trong 15 phút.

---

## Bản ghi quyết định 3 — Refresh token đục, băm, xoay vòng, phát hiện dùng lại theo phiên <!-- key: decision_record -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** Two-way

### Bối cảnh <!-- key: context -->

Cần cấp lại access token mà người dùng không phải đăng nhập lại, đồng thời phát hiện token bị đánh cắp (RFC 9700 mục refresh token rotation).

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
|---|---|---|---|---|
| Refresh JWT | Trung bình | Thấp | Dễ | Không thu hồi trực tiếp, lưu phức tạp |
| Refresh đục, không xoay | Cao | Cao | Dễ | Bị đánh cắp là dùng được tới hết hạn |
| Refresh đục, xoay mỗi lần, phát hiện dùng lại | Cao | Trung bình | Dễ | Theo khuyến nghị RFC 9700, Auth0 |

### Quyết định <!-- key: decision -->

Token 256 bit ngẫu nhiên (`CSPRNG`), mã hóa base64url, tiền tố `rt_`. Lưu `SHA-256` (đủ vì entropy cao, tra cứu nhanh theo băm). Mỗi lần refresh: khóa dòng phiên (`SELECT … FOR UPDATE`), kiểm tra băm hiện tại; nếu khớp thì xoay (giữ băm cũ làm `previous`, ghi `rotated_at`). Nếu khớp `previous` trong **10 giây** thì coi là thử lại hợp lệ (cho phép mạng chập chờn, nhiều tab) và xoay tiếp; ngoài 10 giây thì coi là **dùng lại**: thu hồi cả phiên, ghi sự kiện `refresh_reuse_detected`, thông báo trong ứng dụng. Họ token = phiên (mỗi thiết bị một phiên), nên không cần bảng họ riêng.

### Hệ quả <!-- key: consequences -->

Có nguy cơ báo động giả nếu client không tuần tự hóa refresh (nhiều tab): frontend dùng Web Locks API. Mất phản hồi refresh trên mạng yếu được dung thứ nhờ cửa sổ 10 giây.

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ: chỉ đổi logic và cột; refresh hiện có hết hạn theo phiên.

---

## Bản ghi quyết định 4 — Nơi lưu token ở trình duyệt <!-- key: decision_record -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** Two-way

### Bối cảnh <!-- key: context -->

Yêu cầu Bearer token, nhưng lưu token trong `localStorage` làm XSS lấy được cả phiên dài hạn.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
|---|---|---|---|---|
| Cả hai token trong localStorage | Cao | Cao | Dễ | XSS lấy được refresh; bị cấm bởi tinh thần `security.md` |
| Access trong bộ nhớ, refresh trong cookie `HttpOnly` | Cao | Cao | Dễ | Cần chống CSRF cho endpoint refresh; mất access khi F5 nên gọi refresh lúc tải trang |
| Toàn bộ cookie (BFF, không lộ token cho JS) | Trung bình | Trung bình | Trung bình | Không còn Bearer ở trình duyệt |

### Quyết định <!-- key: decision -->

Access token trong **bộ nhớ** (không `localStorage`, không `sessionStorage`). Refresh token trong cookie `__Secure-dt_rt`: `HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age` theo phiên. Endpoint cookie (`/auth/refresh`, `/auth/logout`) bắt buộc: kiểm tra `Origin` thuộc danh sách cho phép, header tùy biến `X-Requested-With: dt`, `Content-Type: application/json`. Mọi endpoint khác chỉ nhận `Authorization: Bearer`, nên không bị CSRF. Client native gửi refresh qua body và lưu trong kho bảo mật hệ điều hành (làm sau).

### Hệ quả <!-- key: consequences -->

Tải trang đầu tiên luôn gọi `POST /auth/refresh` để lấy access token ("khởi động phiên im lặng"). Website cần route proxy `/api/*` cùng origin để cookie `Path=/api/auth` dùng được.

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ chuyển sang BFF hoàn toàn nếu sau này muốn.

---

## Bản ghi quyết định 5 — Google OAuth: Authorization Code + PKCE do backend làm client bảo mật <!-- key: decision_record -->

**Status:** Accepted
**Category:** Integration Feasibility
**Door Type:** Two-way

### Bối cảnh <!-- key: context -->

Cần đăng nhập Google an toàn, chống CSRF đăng nhập, chống phát lại ID token, không giữ token Google không cần dùng.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
|---|---|---|---|---|
| Google Identity Services (nút JS, nhận ID token ở frontend) | Trung bình | Cao | Dễ | Backend vẫn phải kiểm tra; khó áp dụng `state/nonce` chặt, phụ thuộc script ngoài |
| Authorization Code + PKCE, backend trao đổi mã | Cao | Trung bình | Dễ | Chuẩn khuyến nghị, secret nằm ở backend |
| Thư viện tất cả-trong-một (Passport/Auth.js) | Trung bình | Trung bình | Trung bình | Thêm lớp trừu tượng và phụ thuộc, khó gắn với mô hình phiên riêng |

### Quyết định <!-- key: decision -->

Authorization Code + PKCE (`S256`) + `state` + `nonce` (ba giá trị ngẫu nhiên độc lập) lưu trong Redis 10 phút, dùng một lần. Scope tối thiểu `openid email profile`. Backend đổi mã tại token endpoint, kiểm tra ID token bằng JWKS của Google (`iss`, `aud`, `exp`, `nonce`, thuật toán `RS256`), yêu cầu `email_verified=true`. Khóa danh tính là `sub` của Google, không phải email. Không lưu access/refresh token của Google (không cần gọi API Google). Địa chỉ chuyển hướng sau đăng nhập phải thuộc danh sách cho phép (chặn open redirect). Dùng `jose` + `fetch`; không thêm thư viện OAuth.

### Hệ quả <!-- key: consequences -->

Cần đăng ký redirect URI cố định và xác minh tên miền với Google. Cần trang chính sách quyền riêng tư và điều khoản công khai.

### Khả năng đảo ngược <!-- key: reversibility -->

Thêm nhà cung cấp khác (Apple, Facebook) bằng bảng `auth_identities` theo `provider` mà không đổi lõi.

---

## Bản ghi quyết định 6 — Thông báo realtime khi thu hồi: Redis Pub/Sub + WebSocket, có kiểm tra định kỳ <!-- key: decision_record -->

**Status:** Accepted
**Category:** Cross-Service Pattern
**Door Type:** Two-way

### Bối cảnh <!-- key: context -->

Kiểm tra mỗi request đã chặn truy cập ngay, nhưng tab đang mở cần được báo để chuyển về trang đăng nhập và đóng kết nối realtime.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
|---|---|---|---|---|
| Chỉ chờ lần gọi API kế tiếp | Cao | Cao | Dễ | Tab nhàn rỗi không biết, kết nối realtime sống |
| Polling `/auth/session` 30 giây | Cao | Cao | Dễ | Chậm, tốn |
| WebSocket + Redis Pub/Sub | Trung bình | Trung bình | Dễ | Tức thì, nhiều instance backend vẫn nhận |
| SSE | Trung bình | Cao | Dễ | `EventSource` không gắn được header Bearer |

### Quyết định <!-- key: decision -->

Một kênh WebSocket duy nhất cho thông báo (dùng chung với `notification`). Kết nối bằng **vé dùng một lần** (`POST /realtime/ticket`, 30 giây, lưu Redis) để không đưa access token vào URL. Mỗi instance backend subscribe `events:session:revoked`; khi nhận thì đóng socket của `sid` đó với mã `4401` và gửi `session.revoked` trước khi đóng. Pub/Sub không đảm bảo giao, nên có thêm: backend kiểm tra lại `sid` mỗi 60 giây cho từng socket, client kiểm tra khi tab được focus lại, và mọi request API vẫn bị chặn.

### Hệ quả <!-- key: consequences -->

Cần giữ bản đồ `sid → socket` trong bộ nhớ từng instance. Socket không bao giờ tin vào hạn của access token; nó gắn với `sid`.

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ thay kênh vận chuyển (SSE/WebSocket); sự kiện và khóa Redis giữ nguyên.

---

## Bản ghi quyết định 7 — Đăng nhập email + mật khẩu: giữ mã nhưng mặc định tắt cho tới khi có kênh gửi email <!-- key: decision_record -->

**Status:** Proposed
**Category:** Technology Choice
**Door Type:** Two-way

### Bối cảnh <!-- key: context -->

UI đã có form đăng ký, quên mật khẩu, đặt lại. Nhưng mật khẩu kéo theo xác minh email, đặt lại, chống dò, lưu băm, và cần gửi email, mà người vận hành không có email doanh nghiệp.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
|---|---|---|---|---|
| Chỉ Google | Cao | Cao | Dễ | Bề mặt tấn công nhỏ nhất; người không dùng Google không vào được |
| Google + mật khẩu | Cao | Trung bình | Dễ | Thêm luồng email, dò mật khẩu, lưu mật khẩu |
| Mật khẩu + Google, bật tắt bằng cờ | Cao | Trung bình | Dễ | Mã có sẵn, bật khi sẵn sàng |

### Quyết định <!-- key: decision -->

Triển khai theo cờ `AUTH_PASSWORD_ENABLED`, mặc định `false` ở production cho tới khi có kênh email giao dịch và đã chạy bộ kiểm thử dò mật khẩu. Khi bật: Argon2id (m=19 MiB, t=2, p=1 theo OWASP), mật khẩu tối thiểu 10 ký tự, tối đa 128, không bắt quy tắc thành phần, kiểm tra danh sách mật khẩu bị lộ (k-anonymity) nếu có thể. Thư viện `@node-rs/argon2`.

### Hệ quả <!-- key: consequences -->

Cần chốt Open Question Q1, Q2 trước khi bật.

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ: tắt cờ, dữ liệu băm vẫn nằm trong bảng.

---

## Bản ghi quyết định 8 — Hạn mức chống lạm dụng bằng Redis, khóa theo IP và theo tài khoản <!-- key: decision_record -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** Two-way

### Bối cảnh <!-- key: context -->

`security.md` bắt buộc rate limit cho đăng nhập, quên mật khẩu. Khóa tài khoản cứng sau N lần sai cho phép kẻ tấn công khóa nạn nhân.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
|---|---|---|---|---|
| `@nestjs/throttler` + kho Redis | Cao | Cao | Dễ | Chuẩn cho NestJS, thêm bộ đếm tuỳ biến cho khóa theo tài khoản |
| Viết Lua riêng toàn bộ | Trung bình | Thấp | Dễ | Nhiều mã phải bảo trì |
| Giới hạn ở proxy/WAF | Thấp | Cao | Dễ | Không biết nghiệp vụ theo tài khoản |

### Quyết định <!-- key: decision -->

Dùng bộ giới hạn tốc độ có kho Redis cho giới hạn theo IP/route, cộng một bộ đếm lỗi đăng nhập theo tài khoản có độ trễ tăng dần (không khóa cứng): 5 lần sai đầu miễn phí, rồi chờ 2^n giây tối đa 15 phút; bắt buộc trả cùng một phản hồi để không lộ tài khoản có tồn tại hay không. Số liệu cụ thể ở `README.md` mục Bối cảnh kỹ thuật.

### Hệ quả <!-- key: consequences -->

Cần cấu hình `trust proxy` đúng để lấy IP thật; sai cấu hình làm mọi người chung một IP.

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ.

---

### Nguồn tham khảo

- [RFC 9700 — OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700) và [bản đối chiếu cấu hình của Django OAuth Toolkit](https://django-oauth-toolkit.readthedocs.io/en/latest/security.html)
- [Auth0 — Refresh token rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation) (thu hồi họ token khi dùng lại)
- [Lucid — Tránh báo động giả khi phát hiện trộm refresh token](https://lucid.co/techblog/2023/09/18/avoiding-false-positives-in-oauth-2-0-refresh-token-theft-detection) (cửa sổ nới)
- [Auth0 — state, nonce và PKCE khác nhau thế nào](https://auth0.com/blog/demystifying-oauth-security-state-vs-nonce-vs-pkce/)
- [SuperTokens — Thu hồi JWT bằng blacklist](https://supertokens.com/blog/revoking-access-with-a-jwt-blacklist) và [Flask-JWT-Extended — blocklist](https://flask-jwt-extended.readthedocs.io/en/stable/blocklist_and_token_revoking.html)
- [WorkOS — Tấn công nhầm thuật toán JWT](https://workos.com/blog/jwt-algorithm-confusion-attacks)
- RFC 8725, RFC 9068, RFC 7636; OWASP Cheat Sheet Series (Session Management, JWT for Java, Authentication, Password Storage). Các tài liệu này tôi dẫn theo hiểu biết chung, chưa mở lại từng trang trong lần soạn này; nên đối chiếu khi triển khai.
