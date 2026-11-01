# Phân quyền theo vai trò và gói (Authorization / RBAC)

**Feature ID:** 004-rbac
**Status:** Draft
**Last Updated:** 26/10/2026

## Tổng quan <!-- key: overview -->

Một file cấu hình cứng ở backend quyết định ba vai trò (`guest`, `user`, `admin`), gói của người dùng (`free`, `unlimited`, `valued`), quyền dạng `resource:action`, hạn mức theo ngày và giới hạn số lượng. Mọi route khai báo quyền; mặc định từ chối. Vai trò và gói đọc từ bộ đệm Redis cùng lượt kiểm tra phiên nên không thêm vòng mạng. Không có phân quyền động.

## Mục tiêu & Phạm vi <!-- key: goals_scope -->

**In scope:**

- Bảng quyền, vai trò, gói, hạn mức, giới hạn, quy tắc chủ sở hữu viết cứng ([policy-config.md](policy-config.md)).
- Guard, decorator, bộ đếm hạn mức Redis, tín dụng định giá, gói có thời hạn.
- API quyền hiệu lực cho frontend và API quản trị.
- Kiểm thử tính nhất quán của bảng quyền và kiểm kê route.

**Out of scope:**

- Phân quyền động, vai trò tùy biến, multi-tenant, chia sẻ tài nguyên.
- Thanh toán và hóa đơn (chỉ nhận kết quả gói).
- Đăng nhập, phiên, token (`003-auth`).

## Đối tượng liên quan <!-- key: actors -->

- Khách (guest), Người dùng (user) theo gói, Quản trị (admin).
- Người vận hành: sửa cấu hình, tạo admin bằng CLI.
- Hệ thống thanh toán (SePay) qua webhook (tính năng riêng).

## Yêu cầu chức năng <!-- key: functional_requirements -->

- **FR-01 (Cấu hình tập trung):** `authorization.config.ts` chứa `GUEST_PERMISSIONS`, `USER_PERMISSIONS`, `ADMIN_PERMISSIONS`, `PLAN_ENTITLEMENTS`, `ROLE_PERMISSIONS`, `RESOURCE_RULES`, `REQUIRES_RECENT_AUTH`; kiểu `Permission` là union chuỗi nên sai quyền là lỗi biên dịch.
- **FR-02 (Quyền hiệu lực):** guest, user, admin tính theo công thức ở policy-config mục 1; user cộng quyền theo gói; admin hưởng gói `valued`.
- **FR-03 (Mặc định từ chối):** route phải có đúng một trong `@Public`, `@RequirePermission`, `@AuthenticatedOnly`; thiếu thì ứng dụng không khởi động; `PermissionsGuard` từ chối nếu thiếu metadata.
- **FR-04 (Nguồn quyền):** `role`, `status`, `plan`, `planUntil` đọc từ `cache:authz:{userId}`, nạp từ DB khi thiếu; JWT không mang quyền.
- **FR-05 (Gói hiệu lực lười):** `plan` hết hạn tự tính là `free` khi `planUntil` đã qua. Thanh toán bảo đảm tối đa một dòng đang mở. Nếu dữ liệu cũ còn nhiều dòng, gói hiệu lực vẫn là gói cao nhất còn hạn.
- **FR-06 (Hạn mức phân tích):** `@Quota('analysisDaily')`; Lua `reserve` nguyên tử; giữ chỗ theo `requestId`; `release` hoàn lượt đúng một lần khi lỗi; reset 00:00 giờ Việt Nam; nạp lại từ lịch sử khi mất khóa.
- **FR-07 (Giới hạn số lượng):** `savedPlaces`, `activeListings` kiểm tra khi tạo mới, đếm trong DB; vượt thì `409 limit_reached`; hạ gói không xóa dữ liệu.
- **FR-08 (Quy tắc chủ sở hữu):** `RESOURCE_RULES` khai báo trường chủ, quyền thay thế, mã từ chối (403 cho tài nguyên công khai, 404 cho riêng tư).
- **FR-09 (Định giá):** `valuation:run` thuộc gói `valued` hoặc người còn tín dụng; trừ tín dụng trong cùng giao dịch với bản ghi định giá; `idempotency_key` unique.
- **FR-10 (Step-up):** quyền trong `REQUIRES_RECENT_AUTH` yêu cầu `authTime` ≤ 10 phút.
- **FR-11 (Hiệu lực tức thời):** đổi vai trò, gói, trạng thái: commit DB → xóa `cache:authz` → `PUBLISH events:authz:changed`.
- **FR-12 (API quyền hiệu lực):** `GET /me/entitlements` trả vai trò, gói, quyền, hạn mức (đã dùng, còn lại, `resetAt`), giới hạn và tín dụng.
- **FR-13 (API quản trị):** tìm người dùng, khóa/mở khóa, buộc đăng xuất, cấp/kết thúc gói, cộng/trừ tín dụng, đặt lại lượt, kiểm duyệt tin, bài viết, đọc nhật ký kiểm toán.
- **FR-14 (Ranh giới admin):** admin không tác động admin khác hay chính mình qua API; tạo/gỡ admin chỉ bằng CLI.
- **FR-15 (Kiểm toán admin):** mọi hành động admin ghi `admin_audit_logs` (người làm, đối tượng, trước/sau, lý do, IP, phiên).
- **FR-16 (Frontend):** `Can`/`useCan` để ẩn/hiện và gợi ý nâng gói; route `/admin/*`, `/app/*` kiểm tra phía server bằng `/auth/me`; khách vào `/app/*` chuyển tới đăng nhập; user vào `/admin` nhận 404.
- **FR-17 (Kiểm thử cấu hình):** các test ở policy-config mục 8 chặn merge khi sai.

## Quy tắc nghiệp vụ <!-- key: business_rules -->

- **BR-01 (Khách không phân tích):** khách chỉ xem kết quả mẫu có nhãn "Số liệu minh họa", không tính lượt.
- **BR-02 (Free):** 10 lượt phân tích mỗi ngày, chưa định giá. Giá trị minh họa, chờ chốt.
- **BR-03 (Unlimited):** không giới hạn lượt, định giá mua lẻ 10.000 đồng/lần.
- **BR-04 (Valued):** không giới hạn lượt và có bước định giá.
- **BR-05 (Lỗi không mất lượt):** phân tích lỗi thì hoàn lượt; thử lại cùng `requestId` không trừ hai lần.
- **BR-06 (Hết hạn gói):** quay về `free`; dữ liệu cũ giữ, chỉ chặn tạo mới vượt giới hạn.
- **BR-07 (Liên hệ người đăng):** chỉ thấy khi đăng nhập, có rate limit.
- **BR-08 (So sánh):** đặt cạnh các kết quả đã có thì miễn phí; thêm một địa điểm mới để phân tích tính một lượt (xem Q2).
- **BR-09 (Admin):** không bị tính lượt; không có quyền xem nội dung riêng tư của người dùng.

## Tóm tắt luồng người dùng <!-- key: user_flow_summary -->

1. Request đến: `AuthGuard` (003) tạo `principal` từ Redis; `PermissionsGuard` kiểm tra quyền theo vai trò và gói; `QuotaInterceptor` giữ chỗ nếu route có hạn mức; handler kiểm tra quy tắc tài nguyên.
2. User free bấm phân tích lần thứ 11 trong ngày: `429 daily_quota_exceeded` với `resetAt`, UI hiện "làm mới lúc 00:00".
3. User free bấm định giá: `403 plan_required` (`requiredPlan: valued`), UI hiện lời mời nâng gói hoặc mua lẻ.
4. Thanh toán thành công hoặc admin cấp gói: DB → xóa cache → sự kiện; tab đang mở tải lại quyền; request kế tiếp có hiệu lực.
5. Admin khóa tài khoản vi phạm (step-up, lý do): mọi phiên bị thu hồi, người đó thấy thông báo đăng xuất.

## Bối cảnh kỹ thuật <!-- key: technical_context -->

- Mô hình: RBAC + entitlement theo gói + quy tắc chủ sở hữu khai báo; tự viết bộ đánh giá nhỏ, không thư viện (research Quyết định 1).
- Nguồn quyền lúc chạy: `cache:authz` trong Redis đọc cùng pipeline kiểm tra phiên (Quyết định 2). Hiệu năng: ≤ 0,2 ms CPU, không thêm vòng mạng; tập quyền hiệu lực được tính sẵn theo `(role, plan)` trong bộ nhớ khi khởi động (9 tổ hợp).
- Hạn mức: Redis Lua + giữ chỗ + nạp lại từ lịch sử (Quyết định 3).
- Gói/tín dụng: `subscriptions`, `credit_ledger_entries` (Quyết định 4).
- Admin: tạo bằng CLI, step-up, kiểm toán (Quyết định 5).
- Frontend chỉ phản chiếu, bảo vệ route phía server (Quyết định 6).
- Cấu trúc đề xuất trong `backend/src/modules/rbac/`: `authorization.types.ts`, `authorization.config.ts`, `permissions.guard.ts`, `policy.service.ts`, `quota.service.ts`, `quota.interceptor.ts`, `subscription.service.ts`, `credit.service.ts`, `rbac.decorators.ts`, `rbac.module.ts`, tests `authorization.config.spec.ts`, `route-inventory.spec.ts`. Module `admin` riêng: `admin-users.controller.ts`, `admin-audit.service.ts`. Script CLI `scripts/admin-grant.ts` (`npm run admin:grant`).
- Frontend: `website/src/features/rbac/` hoặc trong `features/auth`: hook `use-entitlements.ts`, component `can.tsx`, cập nhật khi nhận `authz.changed` từ WebSocket.
- Biến môi trường mới: `ADMIN_ALLOWED_CIDRS` (tùy chọn), `ANALYSIS_BUDGET_GUARD` (cờ tùy chọn giảm hạn mức khi vượt ngân sách).
- Trạng thái mã nguồn: chưa có gì; `UserModule` mẫu ở `backend/src/modules/user/`.

## Phụ thuộc <!-- key: dependencies -->

- Cần `003-auth` (principal, `cache:authz`, thu hồi phiên, step-up).
- Chặn mọi tính năng cần giới hạn: phân tích, định giá, lưu địa điểm, đăng tin, bình luận (cần ghi lịch sử phân tích có `userId` và nhận `requestId`).
- Liên quan: tính năng thanh toán (SePay) ghi `subscriptions`.

## Ràng buộc <!-- key: constraints -->

- Hardcode trong file cấu hình backend, không phân quyền động.
- Backend là nơi duy nhất thực thi.
- Không thêm truy vấn DB hay vòng Redis riêng cho kiểm tra quyền.
- Số liệu hạn mức là giả định cho tới khi chốt bảng giá.

## Tài liệu liên quan (Artifacts) <!-- key: artifacts -->

- Diagrams: [Kiểm tra quyền một request](diagrams/sequence-authorize-request.mmd) · [Đổi gói / khóa tài khoản](diagrams/flow-plan-change.mmd) · [Trạng thái gói](diagrams/state-plan.mmd)
- API Contracts: [REST](interfaces/rest-api.yml)
- Database Schemas: [postgresql.dbml](postgresql.dbml) · [redis.md](redis.md)
- Cấu hình cứng: [policy-config.md](policy-config.md)
- Technical Research: [research.md](research.md)
- Threat model: [threat-model.md](threat-model.md)
- Idea: [rbac-idea.md](rbac-idea.md)
- Liên quan: [003-auth](../003-auth/README.md)

## Tiêu chí nghiệm thu (Acceptance Criteria) <!-- key: acceptance_criteria -->

- [ ] **AC-01:** Given một route mới không có metadata, When khởi động ứng dụng, Then ứng dụng báo lỗi và không chạy.
- [ ] **AC-02:** Given khách gọi `analysis:run`, When gửi request, Then `401` (chưa đăng nhập); Given user free gọi `valuation:run`, Then `403 plan_required` với `requiredPlan: valued`.
- [ ] **AC-03:** Given user free đã dùng 10 lượt, When gọi lượt 11, Then `429 daily_quota_exceeded` có `resetAt` là 00:00 ngày kế (giờ Việt Nam).
- [ ] **AC-04:** Given 50 request đồng thời ở 9/10 lượt, When xử lý, Then đúng 1 thành công.
- [ ] **AC-05:** Given phân tích thất bại, When trả lỗi, Then lượt được hoàn đúng một lần; thử lại cùng `requestId` không trừ hai lần.
- [ ] **AC-06:** Given user nâng gói lên `valued`, When request kế tiếp, Then `valuation:run` được phép trong dưới 2 giây và tab đang mở nhận `authz.changed`.
- [ ] **AC-07:** Given gói hết hạn, When request kế tiếp, Then bị coi là `free` mà không cần job.
- [ ] **AC-08:** Given user A gọi `GET/PATCH/DELETE` ghi chú của user B, When gửi request, Then `404 not_found` cùng nội dung như id không tồn tại.
- [ ] **AC-09:** Given user sửa tin của người khác, When gửi request, Then `403 permission_denied`.
- [ ] **AC-10:** Given body có `role: "admin"` hoặc `plan`, When tạo/sửa hồ sơ, Then bị loại hoặc `422`, vai trò không đổi.
- [ ] **AC-11:** Given admin khóa user, When `auth_time` quá 10 phút, Then `403 reauth_required`; When thực hiện sau xác thực lại, Then mọi phiên của user bị thu hồi và có một bản ghi `admin_audit_logs`.
- [ ] **AC-12:** Given admin khóa admin khác hoặc chính mình, When gửi, Then `403 permission_denied`.
- [ ] **AC-13:** Given test đơn điệu vai trò và gói, When chạy, Then `GUEST ⊆ USER ⊆ ADMIN` và `FREE ⊆ UNLIMITED ⊆ VALUED` về quyền.
- [ ] **AC-14:** Given Redis dừng, When gọi `@Quota`, Then `503` và không chạy phân tích.
- [ ] **AC-15:** Given user bình thường vào `/admin` trên website, When tải trang, Then nhận 404 (không lộ sự tồn tại).

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

- Q1–Q3 và Q5 trong [rbac-idea.md](rbac-idea.md) vẫn mở. Q4 đã chốt: một gói đang mở, xem `007-billing/research.md` Bản ghi quyết định 4.
- Có cần thêm tiền tố `quota:` vào `.cursor/rules/naming.md` (Redis) không? (Đề xuất: có.)
- Khi hạ gói, dữ liệu vượt giới hạn (ví dụ 150 địa điểm đã lưu, còn giới hạn 20) hiển thị thế nào? (Đề xuất: giữ xem được, chặn thêm.)

## Nhật ký cập nhật <!-- key: update_log -->

- 26/10/2026: tạo đặc tả đầu tiên; các quyết định 1–6 ở `research.md`; số liệu hạn mức dựa trên trang giá minh họa của landing.
- 01/11/2026: Gói đang mở là một dòng mỗi người. Cách lấy hạng cao nhất chỉ còn là lưới an toàn cho dữ liệu cũ.
