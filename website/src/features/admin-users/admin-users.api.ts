import { apiRequest } from "@/features/auth/auth.api";

export type DirectoryPlan = "free" | "unlimited" | "valued";
export type DirectoryStatus = "active" | "trailing" | "canceled" | "expired" | "none";
export type DirectoryCycle = "month" | "year" | null;
export type DirectorySort = "created_desc" | "created_asc" | "name" | "expiry";

export interface DirectoryItem {
    userId: string;
    planCode: string;
    plan: DirectoryPlan;
    displayName: string;
    username: string | null;
    email: string;
    joinedAt: string;
    periodEnd: string | null;
    status: DirectoryStatus;
    cycle: DirectoryCycle;
    accountStatus: "active" | "locked";
    subscriptionId: string | null;
    open: boolean;
}

export interface DirectorySummary {
    users: { total: number; delta: number };
    newUsers: { current: number; previous: number };
    online: number;
    activePlans: { current: number; delta: number };
    revenue: { currentVnd: number; previousVnd: number; percent: number | null };
    pastDue: number;
}

export interface DirectoryResponse {
    items: DirectoryItem[];
    total: number;
    page: number;
    pageSize: number;
    summary: DirectorySummary;
}

export function listDirectory(query: {
    page: number;
    q: string;
    status: DirectoryStatus | "";
    plan: DirectoryPlan | "";
    sort: DirectorySort;
}): Promise<DirectoryResponse> {
    const params = new URLSearchParams();
    params.set("page", String(query.page));
    params.set("sort", query.sort);
    const q = query.q.trim();
    if (q) params.set("q", q);
    if (query.status) params.set("status", query.status);
    if (query.plan) params.set("plan", query.plan);
    return apiRequest<DirectoryResponse>(`/admin/billing/directory?${params.toString()}`);
}

const REASON = {
    renew: "Gia hạn thủ công.",
    cancel: "Huỷ gói thủ công, đưa về miễn phí.",
    change: "Đổi gói thủ công.",
    lock: "Khoá tài khoản từ quản lý người dùng.",
    unlock: "Mở khoá tài khoản từ quản lý người dùng.",
    delete: "Xoá người dùng từ quản lý người dùng.",
} as const;

export function renewDirectoryUser(userId: string): Promise<{ id: string }> {
    return apiRequest(`/admin/billing/users/${userId}/renew`, {
        method: "POST",
        body: JSON.stringify({ reason: REASON.renew }),
    });
}

export function cancelDirectoryUser(userId: string): Promise<{ id: string }> {
    return apiRequest(`/admin/billing/users/${userId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: REASON.cancel }),
    });
}

export function changeDirectoryPlan(
    userId: string,
    plan: "unlimited" | "valued",
): Promise<{ id: string }> {
    return apiRequest(`/admin/billing/users/${userId}/plan`, {
        method: "POST",
        body: JSON.stringify({ plan, reason: REASON.change }),
    });
}

export function lockDirectoryUser(userId: string): Promise<void> {
    return apiRequest(`/admin/users/${userId}/lock`, {
        method: "POST",
        body: JSON.stringify({ reason: REASON.lock }),
    });
}

export function unlockDirectoryUser(userId: string): Promise<void> {
    return apiRequest(`/admin/users/${userId}/lock`, {
        method: "DELETE",
        body: JSON.stringify({ reason: REASON.unlock }),
    });
}

export function deleteDirectoryUser(userId: string): Promise<void> {
    return apiRequest(`/admin/users/${userId}`, {
        method: "DELETE",
        body: JSON.stringify({ reason: REASON.delete }),
    });
}
