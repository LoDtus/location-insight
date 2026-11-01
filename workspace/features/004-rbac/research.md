# Technical Research — Phân quyền (Authorization / RBAC)

## Bản ghi quyết định 1 — Mô hình: RBAC cho vai trò + bảng quyền theo gói (entitlement), kiểm tra theo quyền chứ không theo tên vai trò <!-- key: decision_record -->

**Status:** Accepted
**Category:** New Architecture Pattern
**Door Type:** One-way (mọi controller sẽ khai báo quyền theo mô hình này)

### Bối cảnh <!-- key: context -->

Ba vai trò cố định, thêm gói trả phí, hạn mức theo ngày, quyền theo chủ sở hữu. Không cần phân quyền động.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
|---|---|---|---|---|
| Kiểm tra `role === 'admin'` rải rác | Cao | Thấp | Dễ | Không biểu diễn được gói, hạn mức; dễ sót |
| RBAC thuần (vai trò → quyền) | Cao | Cao | Dễ | Thiếu chiều "gói" và "chủ sở hữu" |
| RBAC + entitlement theo gói + quy tắc chủ sở hữu khai báo | Cao | Cao | Dễ | Đủ cho bài toán; tất cả là dữ liệu tĩnh trong một file |
| ABAC / ReBAC (Zanzibar, OpenFGA) | Thấp | Thấp | Khó | Quá nặng; dịch vụ riêng |
| Thư viện chính sách (CASL, Casbin, OPA) | Trung bình | Trung bình | Trung bình | Thêm DSL/phụ thuộc cho ~30 quyền; Casbin/OPA chủ yếu hữu ích khi quyền động |

### Quyết định <!-- key: decision -->

Chọn **RBAC + entitlement theo gói + quy tắc chủ sở hữu khai báo**, tự viết bộ đánh giá nhỏ (khoảng 100 dòng, không thư viện). Controller khai báo **quyền** (`@RequirePermission('analysis:run')`), không khai báo vai trò; vai trò chỉ xuất hiện trong bảng ánh xạ. Quyền hiệu lực = quyền của vai trò ∪ quyền của gói (nếu là user). Hạn mức và giới hạn số lượng nằm trong cùng bảng gói.

Lý do: dữ liệu tĩnh nên một file TypeScript có kiểu chặt là dễ đọc, dễ review, dễ test nhất; thêm vai trò trung gian sau này chỉ là thêm một khóa.

### Hệ quả <!-- key: consequences -->

- Đổi quyền/hạn mức = sửa mã + triển khai (đúng yêu cầu "không phân quyền động").
- Mọi quyền phải được liệt kê trong kiểu `Permission`; test kiểm tra không có quyền mồ côi hay thiếu.
- Một vai trò mới ngoài `guest | user | admin` là thay đổi enum và cấu hình, không cần di cư dữ liệu ngoài cột `users.role`.

### Khả năng đảo ngược <!-- key: reversibility -->

Có thể chuyển sang thư viện chính sách bằng cách thay phần đánh giá phía sau `PolicyService`; decorator và bảng quyền giữ nguyên.

---

## Bản ghi quyết định 2 — Nguồn quyền tại thời điểm request: bộ đệm Redis từ DB, không phải claim trong JWT <!-- key: decision_record -->

**Status:** Accepted
**Category:** Performance & Scale
**Door Type:** Two-way

### Bối cảnh <!-- key: context -->

Cần đổi gói, khóa tài khoản, giáng vai trò có hiệu lực ngay, mà vẫn không thêm truy vấn DB mỗi request.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
|---|---|---|---|---|
| Role/plan trong JWT | Cao | Cao | Dễ | Cũ tới 15 phút; không phù hợp khóa tức thì và nâng gói |
| Truy vấn DB mỗi request | Cao | Cao | Dễ | Chậm, tải DB lớn |
| Bộ đệm Redis `cache:authz:{userId}` đọc cùng pipeline với kiểm tra phiên, xóa khi đổi | Cao | Cao | Dễ | Không thêm vòng mạng; hiệu lực ngay |

### Quyết định <!-- key: decision -->

Dùng hash `cache:authz:{userId}` (đã định nghĩa ở `003-auth/redis.md`) chứa `role`, `status`, `plan`, `planUntil`, `minIat`. Nạp từ DB khi thiếu (single-flight). Mọi thay đổi vai trò, gói, trạng thái đều: commit DB → `DEL` khóa → `PUBLISH events:authz:changed`. Gói hết hạn được tính lười: so `planUntil` với giờ hiện tại ở mỗi request nên không cần job. JWT **không** mang `role` hay `plan`; frontend nhận qua `/me/entitlements` để hiển thị.

### Hệ quả <!-- key: consequences -->

Quyền phụ thuộc Redis hoặc DB; Redis lỗi thì `AuthGuard` đã trả 503. TTL 15 phút là mức an toàn nếu một lần xóa khóa bị rớt.

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ: thêm claim vào JWT chỉ như gợi ý hiển thị nếu cần.

---

## Bản ghi quyết định 3 — Hạn mức theo ngày bằng bộ đếm Redis nguyên tử với giữ chỗ, hoàn lượt và idempotency <!-- key: decision_record -->

**Status:** Accepted
**Category:** Performance & Scale
**Door Type:** Two-way

### Bối cảnh <!-- key: context -->

Free có 10 lượt/ngày. UI đã hứa "lượt của bạn chưa bị trừ" khi lỗi và "làm mới lúc 00:00 ngày mai". Phân tích tốn tiền gọi model nên không được đếm sai theo hướng có lợi cho người dùng khi bị tấn công đồng thời.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
|---|---|---|---|---|
| Đếm trong PostgreSQL | Cao | Cao | Dễ | Chính xác, chậm hơn, tranh chấp khóa dòng |
| `INCR` đơn giản trong Redis | Cao | Cao | Dễ | Race giữa kiểm tra và tăng; không hoàn lượt; không idempotent |
| Script Lua nguyên tử + khóa giữ chỗ theo `requestId` | Cao | Trung bình | Dễ | Chính xác dưới tải; hoàn lượt được; thử lại không trừ hai lần |

### Quyết định <!-- key: decision -->

Script Lua `reserve` kiểm tra và tăng trong một bước; khóa giữ chỗ `quota:hold:{userId}:{requestId}` (TTL 10 phút) để `release` hoàn lượt đúng một lần khi phân tích lỗi và để thử lại cùng `requestId` không trừ lần hai. Hết ngày: khóa đếm có TTL tới 00:00 giờ Việt Nam + 1 giờ. Khi khóa đếm thiếu (Redis mất), nạp lại từ số lần phân tích của người dùng trong ngày trong bảng lịch sử phân tích (nguồn sự thật của tính năng phân tích) bằng `SET NX`. Quota là hạn mức thương mại, không phải ranh giới bảo mật, nên sai lệch nhỏ khi mất Redis được chấp nhận.

### Hệ quả <!-- key: consequences -->

Tính năng phân tích phải ghi lịch sử với `userId`, thời điểm, và nhận `requestId` do client sinh (UUID) cho mỗi lần bấm.

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ chuyển nguồn đếm sang PostgreSQL nếu cần chính xác tuyệt đối.

---

## Bản ghi quyết định 4 — Gói có thời hạn, gói hiệu lực tính lười, tín dụng định giá bằng sổ cái <!-- key: decision_record -->

**Status:** Accepted
**Category:** Data Migration
**Door Type:** Two-way

### Bối cảnh <!-- key: context -->

Cả thanh toán tự động và admin cấp tay sẽ ghi gói. Mua lẻ định giá 10.000 đồng/lần là một số dư, không phải gói.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
|---|---|---|---|---|
| Cột `plan`, `plan_until` trên `users` | Cao | Cao | Dễ | Mất lịch sử, khó đối soát thanh toán |
| Bảng `subscriptions` (lịch sử), gói hiệu lực = bản ghi còn hạn cao nhất | Cao | Cao | Dễ | Có lịch sử, nhiều nguồn cấp được |
| Số dư tín dụng trên `users` | Cao | Cao | Dễ | Dễ sai khi thử lại đồng thời |
| Sổ cái `credit_ledger_entries` (cộng/trừ), số dư = tổng | Cao | Cao | Dễ | Có dấu vết; chống trừ hai lần bằng khóa idempotency |

### Quyết định <!-- key: decision -->

Hai bảng: `subscriptions` và `credit_ledger_entries`. Gói hiệu lực = gói cao nhất trong các subscription `active` và còn hạn (`free < unlimited < valued`); không có thì `free`. Kết quả ghi vào `cache:authz` kèm `planUntil`. Tín dụng định giá: mỗi lần mua cộng +1, mỗi lần chạy định giá trừ −1 trong cùng giao dịch với bản ghi định giá; ràng buộc duy nhất theo `idempotency_key`.

### Hệ quả <!-- key: consequences -->

Cần quy tắc xử lý khi mua chồng gói (Open Question Q4). Kết nối thanh toán sau này chỉ thêm bản ghi, không đổi logic quyền.

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ, dữ liệu thô đủ để dựng lại mọi cách tính.

---

## Bản ghi quyết định 5 — Ranh giới đặc quyền của admin: tạo bằng CLI, không quản lý ngang hàng qua API, mọi hành động có kiểm toán và step-up <!-- key: decision_record -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** One-way (sau khi có admin thật)

### Bối cảnh <!-- key: context -->

Không có phân quyền động nên nâng vai trò là thao tác hiếm và nhạy cảm nhất. Admin tài khoản bị chiếm là kịch bản tồi tệ nhất.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
|---|---|---|---|---|
| API cho admin thăng/giáng vai trò | Cao | Cao | Dễ | Một lỗ hổng phân quyền thành chiếm toàn quyền |
| Danh sách email admin trong biến môi trường, tự thăng khi đăng nhập | Trung bình | Cao | Dễ | Phụ thuộc xác minh email; đổi cần triển khai |
| Script CLI do người vận hành chạy trên máy chủ | Cao | Cao | Dễ | Không có đường tấn công qua mạng |

### Quyết định <!-- key: decision -->

Chỉ **script CLI** (`npm run admin:grant -- --email … `, ghi `admin_audit_logs` và `auth_events`) tạo hoặc gỡ admin. API admin không có hành động nào tác động admin khác (khóa, thu hồi phiên, cấp gói) và không tự tác động chính mình. Thao tác phá hủy hoặc ảnh hưởng nhiều người yêu cầu `auth_time` ≤ 10 phút. Mọi hành động admin ghi `admin_audit_logs` (người làm, đối tượng, trước/sau, lý do, IP). Tùy chọn `ADMIN_ALLOWED_CIDRS` giới hạn IP cho `/admin/*`. TOTP cho admin ở giai đoạn 2.

### Hệ quả <!-- key: consequences -->

Cần tài liệu vận hành cho CLI. Mất mọi admin được khôi phục bằng CLI.

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ nới lỏng sau nếu cần.

---

## Bản ghi quyết định 6 — Frontend chỉ phản chiếu quyền để hiển thị; bảo vệ route Next.js bằng kiểm tra phía server <!-- key: decision_record -->

**Status:** Accepted
**Category:** Cross-Service Pattern
**Door Type:** Two-way

### Bối cảnh <!-- key: context -->

`security.md` cấm tin vào kiểm tra phía client. Nhưng UX cần ẩn nút, hiện lời mời nâng gói, hiển thị lượt còn lại.

### Quyết định <!-- key: decision -->

Backend cung cấp `GET /me/entitlements`; frontend có component `Can`/hook `useCan` chỉ để ẩn/hiện và gợi ý. Mọi nút vẫn gọi API; API là nơi từ chối. Route `/admin/*` và `/app/*` kiểm tra bằng lời gọi `/auth/me` phía server (Server Component hoặc middleware gọi backend), không dựa vào sự có mặt của cookie hay trạng thái Redux. Trang bị chặn cho khách chuyển tới `/auth/login?redirectTo=…`; cho user thường vào `/admin` thì trả 404 (không lộ sự tồn tại).

### Hệ quả <!-- key: consequences -->

Có thể có khoảng ngắn UI lỗi thời (cho tới khi nhận `authz.changed`); không gây vượt quyền.

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ.

---

## Bản ghi quyết định 7 — Một dòng gói đang mở <!-- key: decision_record -->

**Status:** Accepted. Thu hẹp hệ quả của Bản ghi quyết định 4 về mua chồng gói.
**Category:** Data Migration
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Quyết định 4 để ngỏ quy tắc khi có nhiều dòng còn hạn. `007-billing` đã chốt một gói đang mở cho mỗi người.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Giữ công thức hạng cao nhất, thanh toán không tạo dòng thứ hai đang mở | Khớp quyết định 4 | Không đổi guard | Dễ | Dữ liệu cũ bẩn vẫn có lưới an toàn |
| Bỏ công thức hạng cao nhất, chỉ đọc một dòng | Gọn hơn | Phải sửa mọi chỗ tính gói | Dễ | Không cần khi thanh toán đã chặn dòng thứ hai |

### Quyết định <!-- key: decision -->

Giữ công thức hạng cao nhất trong `004-rbac`. Ràng buộc "một dòng đang mở" thuộc thanh toán và chỉ mục `uk_subscriptions_one_open`. Q4 đóng.

### Hệ quả <!-- key: consequences -->

Guard không cần biết luật đổi hạng. Luật đó nằm ở `007-billing/research.md` Bản ghi quyết định 4.

### Khả năng đảo ngược <!-- key: reversibility -->

Bỏ chỉ mục và cho tạo dòng thứ hai là đủ để trở lại cách chồng hạng.
