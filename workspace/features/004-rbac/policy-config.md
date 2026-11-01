# Cấu hình phân quyền cứng (policy config)

Đây là đặc tả của **file cấu hình duy nhất** quyết định ai được làm gì. Vị trí đề xuất: `backend/src/modules/rbac/authorization.config.ts`. Không có bảng `roles`/`permissions` trong DB; đổi bảng này là sửa mã, review, triển khai.

## 1. Khái niệm

| Khái niệm | Ý nghĩa | Nguồn lúc chạy |
| --- | --- | --- |
| Vai trò (`UserRole`) | `guest`, `user`, `admin`. `guest` là người chưa đăng nhập, không có bản ghi | `users.role` qua `cache:authz` |
| Gói (`Plan`) | `free`, `unlimited`, `valued`. Chỉ áp dụng cho `user`; admin được coi như `valued` không giới hạn | `subscriptions` qua `cache:authz` |
| Quyền (`Permission`) | `resource:action`, ví dụ `analysis:run` | cấu hình này |
| Hạn mức (`quota`) | số lần theo ngày, reset 00:00 giờ Việt Nam | Redis `quota:*` |
| Giới hạn (`limit`) | trần số lượng đang tồn tại (địa điểm đã lưu, tin đang đăng) | đếm từ DB khi tạo mới |
| Quy tắc tài nguyên (`resource rule`) | quyền kèm điều kiện chủ sở hữu | cấu hình này |

**Quyền hiệu lực** của một principal:

```
guest  = GUEST_PERMISSIONS
user   = GUEST_PERMISSIONS ∪ USER_PERMISSIONS ∪ PLAN_ENTITLEMENTS[plan].permissions
admin  = GUEST_PERMISSIONS ∪ USER_PERMISSIONS ∪ ADMIN_PERMISSIONS ∪ PLAN_ENTITLEMENTS.valued.permissions
```

Lưu ý: kiểm tra theo **quyền**, không theo tên vai trò. Chuỗi `role === 'admin'` không được xuất hiện trong controller hay service (chỉ trong cấu hình và guard).

## 2. Danh sách quyền

### 2.1 Công khai (khách trở lên)

| Quyền | Ý nghĩa | Ghi chú |
| --- | --- | --- |
| `landing:view` | xem trang giới thiệu, giá | |
| `legal:view` | xem điều khoản, chính sách | |
| `article:view` | đọc bài viết trong ứng dụng | |
| `listing:view` | xem danh sách và chi tiết tin | không gồm thông tin liên hệ |
| `map:view` | xem bản đồ nền, ghim tin | không lưu, không phân tích |
| `analysis:demo` | xem kết quả phân tích mẫu (có nhãn "Số liệu minh họa") | không tính lượt |

### 2.2 Người dùng đã đăng nhập (mọi gói)

| Quyền | Ý nghĩa | Ràng buộc |
| --- | --- | --- |
| `profile:read` / `profile:update` | hồ sơ của mình | chỉ của chính mình |
| `session:manage` | xem, đổi tên, đăng xuất thiết bị | chỉ phiên của mình (003-auth) |
| `account:delete` | xóa tài khoản | cần xác thực lại ≤ 10 phút |
| `billing:read` | xem gói, lịch sử thanh toán của mình | |
| `notification:read` | thông báo của mình | |
| `place:save` | lưu địa điểm | giới hạn `savedPlaces` |
| `place:note` | ghi chú địa điểm đã lưu | chỉ của mình |
| `analysis:run` | chạy phân tích vị trí | hạn mức `analysisDaily` |
| `analysis:history:read` | xem lịch sử phân tích của mình | thời gian giữ theo gói |
| `listing:create` | đăng tin | giới hạn `activeListings` |
| `listing:update` | sửa tin | chỉ chủ tin (resource rule) |
| `listing:delete` | gỡ tin | chủ tin, hoặc `listing:moderate` |
| `listing:contact:reveal` | xem thông tin liên hệ người đăng | cần đăng nhập; có rate limit chống thu thập |
| `listing:report` | báo cáo tin vi phạm | |
| `comment:create` | bình luận, hỏi đáp | |
| `comment:delete` | xóa bình luận | chủ bình luận, hoặc `listing:moderate` |
| `discussion:read` | đọc diễn đàn | cần đăng nhập |
| `discussion:write` | tạo chủ đề, bài, trả lời, thích, báo cáo | cần đăng nhập |
| `message:read` | đọc tin nhắn riêng của mình | cần đăng nhập; chỉ hội thoại mình tham gia (`009-messaging`) |
| `message:write` | nhắn tin, thả cảm xúc, chặn, báo cáo tin | cần đăng nhập; có giới hạn tần suất riêng |
| `follow:read` | xem số theo dõi và danh sách người theo dõi | cần đăng nhập (`011-follow`) |
| `follow:write` | theo dõi, bỏ theo dõi | cần đăng nhập; 60 lần mỗi giờ |
| `feedback:write` | gửi góp ý kèm ảnh/video, xem và trả lời góp ý của mình | cần đăng nhập; 5 góp ý mỗi giờ |
| `email:self` | xem và đổi tùy chọn nhận email của mình | cần đăng nhập; chỉ danh mục `notification`/`marketing` |

### 2.3 Theo gói

| Quyền | Gói được cấp | Ghi chú |
| --- | --- | --- |
| `valuation:run` | `valued`, hoặc bất kỳ user nào còn tín dụng định giá | kiểm tra số dư ở lớp nghiệp vụ trong cùng giao dịch trừ tín dụng |

### 2.4 Quản trị

| Quyền | Ý nghĩa | Step-up (≤ 10 phút) |
| --- | --- | --- |
| `admin:access` | vào khu `/admin/*` | không |
| `user:read` | tìm, xem hồ sơ rút gọn người dùng | không |
| `user:lock` | khóa/mở khóa user (không áp cho admin) | có |
| `user:session:revoke` | buộc đăng xuất user (không áp cho admin) | có |
| `subscription:grant` | cấp, rút gói thủ công, kèm lý do | có |
| `credit:grant` | cộng/trừ tín dụng định giá, kèm lý do | có |
| `quota:reset` | đặt lại lượt trong ngày cho user | có |
| `listing:moderate` | ẩn, gỡ tin, xóa bình luận vi phạm | không |
| `report:review` | xử lý báo cáo vi phạm | không |
| `article:manage` | tạo, sửa, xuất bản bài viết | không |
| `discussion:moderate` | ẩn bài diễn đàn, khóa hoặc ẩn chủ đề | không |
| `message:moderate` | xem tin bị báo cáo (bản chụp ngữ cảnh), ẩn tin | không; không đọc được hội thoại tùy ý |
| `feedback:manage` | xem mọi góp ý, trả lời, đổi trạng thái | không; ghi `admin_audit_logs` |
| `email:manage` | sửa mẫu email, gửi thử, xem nhật ký, thử lại, quản lý danh sách chặn | gửi thử 10/giờ; ghi `admin_audit_logs` |
| `audit:read` | xem `admin_audit_logs`, `auth_events` rút gọn | không |

## 3. Ma trận vai trò × quyền

`●` có · `○` có điều kiện · `—` không.

| Quyền | guest | user | admin |
| --- | :-: | :-: | :-: |
| `landing:view`, `legal:view`, `article:view`, `listing:view`, `map:view`, `analysis:demo` | ● | ● | ● |
| `profile:*`, `session:manage`, `billing:read`, `notification:read` | — | ● | ● |
| `account:delete` | — | ○ (step-up) | ○ (không áp cho admin cuối cùng) |
| `place:save`, `place:note`, `analysis:history:read` | — | ● | ● |
| `analysis:run` | — | ○ (hạn mức) | ● (không tính lượt) |
| `listing:create` | — | ○ (giới hạn) | ● |
| `listing:update` | — | ○ (chủ tin) | ○ (chủ tin) |
| `listing:delete`, `comment:delete` | — | ○ (chủ) | ● (qua `listing:moderate`) |
| `listing:contact:reveal`, `listing:report`, `comment:create` | — | ● | ● |
| `valuation:run` | — | ○ (gói `valued` hoặc có tín dụng) | ● |
| Nhóm quản trị (mục 2.4) | — | — | ● |

## 4. Ma trận gói (chỉ user)

| | `free` | `unlimited` | `valued` |
| --- | :-: | :-: | :-: |
| Quyền cộng thêm | không | không | `valuation:run` |
| `analysisDaily` (lượt/ngày) | 10 | không giới hạn | không giới hạn |
| `savedPlaces` | 20 | 200 | 200 |
| `activeListings` | 3 | 10 | 10 |
| `comparePlaces` (số địa điểm trong bảng so sánh) | 4 | 4 | 4 |
| `historyDays` (ngày giữ lịch sử phân tích) | 30 | 365 | 365 |
| Giá minh họa/tháng | 0 | 30.000 đ | 60.000 đ |

Tất cả số liệu là giả định (xem Open Question Q1). Admin: mọi giới hạn số lượng lấy theo `valued`, `analysisDaily` không giới hạn.

## 5. Quy tắc tài nguyên (chủ sở hữu)

| Quyền | Điều kiện | Cho phép thêm bởi | Khi từ chối |
| --- | --- | --- | --- |
| `listing:update` | `listing.ownerId === principal.userId` | — | `403 permission_denied` (tin công khai) |
| `listing:delete` | chủ tin | `listing:moderate` | `403` |
| `comment:delete` | `comment.authorId === principal.userId` | `listing:moderate` | `403` |
| `place:note`, `place:save` (xem, sửa, xóa) | `place.userId === principal.userId` | không ai | `404 not_found` (tài nguyên riêng tư, không lộ sự tồn tại) |
| `analysis:history:read` (một bản ghi) | chủ bản ghi | `audit:read` chỉ xem metadata, không xem nội dung | `404` |
| `profile:*` | `userId` trong đường dẫn trùng người gọi (hoặc dùng `/me`) | `user:read` chỉ đọc rút gọn | `404` |

Quy tắc chung: tài nguyên riêng tư → `404`; tài nguyên công khai nhưng không có quyền sửa → `403`. Tuyệt đối không dùng khóa đoán được từ ngoài; ID là UUID.

## 6. Mã cấu hình (đặc tả, TypeScript)

```ts
// backend/src/modules/rbac/authorization.types.ts
export enum UserRole {
  GUEST = 'guest',
  USER = 'user',
  ADMIN = 'admin',
}

export enum Plan {
  FREE = 'free',
  UNLIMITED = 'unlimited',
  VALUED = 'valued',
}

export type Permission =
  | 'landing:view' | 'legal:view' | 'article:view' | 'listing:view' | 'map:view' | 'analysis:demo'
  | 'profile:read' | 'profile:update' | 'session:manage' | 'account:delete' | 'billing:read'
  | 'notification:read' | 'place:save' | 'place:note' | 'analysis:run' | 'analysis:history:read'
  | 'listing:create' | 'listing:update' | 'listing:delete' | 'listing:contact:reveal'
  | 'listing:report' | 'comment:create' | 'comment:delete'
  | 'discussion:read' | 'discussion:write' | 'message:read' | 'message:write' | 'feedback:write' | 'email:self' | 'follow:read' | 'follow:write'
  | 'valuation:run'
  | 'admin:access' | 'user:read' | 'user:lock' | 'user:session:revoke' | 'subscription:grant'
  | 'credit:grant' | 'quota:reset' | 'listing:moderate' | 'report:review' | 'article:manage'
  | 'discussion:moderate' | 'message:moderate' | 'feedback:manage' | 'email:manage'
  | 'audit:read';

export type QuotaName = 'analysisDaily';
export type LimitName = 'savedPlaces' | 'activeListings' | 'comparePlaces' | 'historyDays';

/** null = không giới hạn */
export type QuotaValue = number | null;

export interface PlanEntitlement {
  readonly permissions: readonly Permission[];
  readonly quotas: Readonly<Record<QuotaName, QuotaValue>>;
  readonly limits: Readonly<Record<LimitName, number>>;
}

export interface ResourceRule {
  readonly ownerField: string; // tên trường chủ sở hữu trên tài nguyên
  readonly orPermission?: Permission; // quyền thay thế cho phép bỏ qua điều kiện chủ
  readonly denyAs: 403 | 404;
}
```

```ts
// backend/src/modules/rbac/authorization.config.ts
import type { Permission, PlanEntitlement, ResourceRule } from './authorization.types.js';
import { Plan, UserRole } from './authorization.types.js';

export const GUEST_PERMISSIONS = [
  'landing:view', 'legal:view', 'article:view', 'listing:view', 'map:view', 'analysis:demo',
] as const satisfies readonly Permission[];

export const USER_PERMISSIONS = [
  'profile:read', 'profile:update', 'session:manage', 'account:delete', 'billing:read',
  'notification:read', 'place:save', 'place:note', 'analysis:run', 'analysis:history:read',
  'listing:create', 'listing:update', 'listing:delete', 'listing:contact:reveal',
  'listing:report', 'comment:create', 'comment:delete',
  'discussion:read', 'discussion:write', 'message:read', 'message:write', 'feedback:write', 'email:self', 'follow:read', 'follow:write',
] as const satisfies readonly Permission[];

export const ADMIN_PERMISSIONS = [
  'admin:access', 'user:read', 'user:lock', 'user:session:revoke', 'subscription:grant',
  'credit:grant', 'quota:reset', 'listing:moderate', 'report:review', 'article:manage',
  'discussion:moderate', 'message:moderate', 'feedback:manage', 'email:manage', 'audit:read',
] as const satisfies readonly Permission[];

export const PLAN_ENTITLEMENTS: Readonly<Record<Plan, PlanEntitlement>> = {
  [Plan.FREE]: {
    permissions: [],
    quotas: { analysisDaily: 10 },
    limits: { savedPlaces: 20, activeListings: 3, comparePlaces: 4, historyDays: 30 },
  },
  [Plan.UNLIMITED]: {
    permissions: [],
    quotas: { analysisDaily: null },
    limits: { savedPlaces: 200, activeListings: 10, comparePlaces: 4, historyDays: 365 },
  },
  [Plan.VALUED]: {
    permissions: ['valuation:run'],
    quotas: { analysisDaily: null },
    limits: { savedPlaces: 200, activeListings: 10, comparePlaces: 4, historyDays: 365 },
  },
};

/** Thứ tự gói để chọn gói hiệu lực cao nhất. */
export const PLAN_RANK: Readonly<Record<Plan, number>> = {
  [Plan.FREE]: 0,
  [Plan.UNLIMITED]: 1,
  [Plan.VALUED]: 2,
};

export const ADMIN_EFFECTIVE_PLAN = Plan.VALUED;

export const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  [UserRole.GUEST]: [...GUEST_PERMISSIONS],
  [UserRole.USER]: [...GUEST_PERMISSIONS, ...USER_PERMISSIONS],
  [UserRole.ADMIN]: [...GUEST_PERMISSIONS, ...USER_PERMISSIONS, ...ADMIN_PERMISSIONS],
};

export const RESOURCE_RULES: Readonly<Partial<Record<Permission, ResourceRule>>> = {
  'listing:update': { ownerField: 'ownerId', denyAs: 403 },
  'listing:delete': { ownerField: 'ownerId', orPermission: 'listing:moderate', denyAs: 403 },
  'comment:delete': { ownerField: 'authorId', orPermission: 'listing:moderate', denyAs: 403 },
  'place:note': { ownerField: 'userId', denyAs: 404 },
  'place:save': { ownerField: 'userId', denyAs: 404 },
  'analysis:history:read': { ownerField: 'userId', denyAs: 404 },
};

/** Quyền cần xác thực lại gần đây (giây). Khóa thiếu = không yêu cầu. */
export const RECENT_AUTH_SECONDS = 600;
export const REQUIRES_RECENT_AUTH: readonly Permission[] = [
  'account:delete', 'user:lock', 'user:session:revoke', 'subscription:grant', 'credit:grant', 'quota:reset',
];

/** Mốc ngày để reset hạn mức. */
export const QUOTA_TIMEZONE = 'Asia/Ho_Chi_Minh';
```

## 7. Hợp đồng chạy (runtime)

### 7.1 `Principal`

```ts
export interface Principal {
  readonly userId: string | null; // null = guest
  readonly role: UserRole;
  readonly plan: Plan; // guest: FREE nhưng không dùng
  readonly planUntil: number | null; // ms; null = không hạn
  readonly sessionId: string | null;
  readonly authTime: number | null; // ms
}
```

Được tạo bởi `AuthGuard` (003) từ pipeline Redis; guest được tạo với `role = GUEST` ở route `@Public()`. Tính `plan` hiệu lực lười: `plan` trong cache chỉ có hiệu lực nếu `planUntil == null || planUntil > now`, ngược lại là `FREE`.

### 7.2 Decorator

| Decorator | Tác dụng |
| --- | --- |
| `@Public()` | không cần token; principal = guest; vẫn phải kèm `@RequirePermission(...)` công khai (ví dụ `listing:view`) để kiểm kê rõ |
| `@RequirePermission(...p)` | cần **tất cả** quyền p |
| `@AuthenticatedOnly()` | cần đăng nhập, không cần quyền cụ thể (hiếm, ví dụ `/auth/me`); phải khai báo rõ |
| `@Quota('analysisDaily')` | interceptor reserve/commit/release |
| `@RequireRecentAuth()` | dùng `RECENT_AUTH_SECONDS`; tự động áp cho quyền trong `REQUIRES_RECENT_AUTH` |
| `@Resource(loader, 'listing:update')` hoặc gọi `policy.assert(...)` trong service | kiểm tra quy tắc tài nguyên sau khi nạp tài nguyên |

Thứ tự guard: `ThrottlerGuard` → `AuthGuard` → `PermissionsGuard` → `QuotaInterceptor` → handler → kiểm tra tài nguyên trong service.

### 7.3 Mặc định từ chối

- Route không có một trong `@Public`, `@RequirePermission`, `@AuthenticatedOnly` bị từ chối lúc chạy và làm **ứng dụng không khởi động** (kiểm kê route khi bootstrap).
- Quyền không có trong `Permission` là lỗi biên dịch.
- Controller chỉ được kiểm tra vai trò thông qua quyền.

### 7.4 Mã lỗi

| Tình huống | HTTP | `code` | Ghi chú |
| --- | --- | --- | --- |
| Chưa đăng nhập, route cần đăng nhập | 401 | `unauthenticated` (hoặc mã token ở 003) | |
| Thiếu quyền do vai trò | 403 | `permission_denied` | không nêu quyền nào |
| Thiếu quyền do gói | 403 | `plan_required` | kèm `requiredPlan` để UI hiển thị lời mời nâng gói |
| Hết hạn mức ngày | 429 | `daily_quota_exceeded` | kèm `resetAt` (ISO) và header `Retry-After` |
| Chạm giới hạn số lượng | 409 | `limit_reached` | kèm `limit`, `current`, `requiredPlan?` |
| Cần xác thực lại | 403 | `reauth_required` | |
| Tài nguyên riêng tư của người khác | 404 | `not_found` | |
| Tài khoản bị khóa | 401 | `session_revoked` | do 003 |

## 8. Kiểm thử bắt buộc (chặn merge)

1. **Đơn điệu theo vai trò:** `GUEST ⊆ USER ⊆ ADMIN` về quyền.
2. **Đơn điệu theo gói:** `FREE ⊆ UNLIMITED ⊆ VALUED` về quyền; hạn mức/giới hạn không giảm theo gói.
3. **Không mồ côi:** mọi quyền trong `Permission` được dùng ở ít nhất một route hoặc service; mọi quyền được dùng đều có trong cấu hình.
4. **Phủ đủ gói:** `PLAN_ENTITLEMENTS`, `PLAN_RANK` có đủ khóa của `Plan`; `ROLE_PERMISSIONS` đủ khóa của `UserRole`.
5. **Snapshot ma trận:** test snapshot ma trận quyền; thay đổi phải thể hiện trong PR (review có chủ đích).
6. **Kiểm kê route:** quét mọi route của ứng dụng; fail nếu thiếu metadata; fail nếu route `@Public()` có phương thức ghi mà không có rate limit.
7. **Hồi quy đặc quyền:** bảng test `(principal, route) → status` cho khách/user free/user valued/admin trên mỗi route (tối thiểu: tạo, sửa, xóa, quản trị).
8. **Quota:** đồng thời 50 request cùng người dùng ở 9/10 lượt → đúng 1 thành công; `release` hoàn đúng 1 lần; cùng `requestId` không trừ hai lần.
9. **Admin không tác động admin:** `user:lock` lên admin → `403`.
