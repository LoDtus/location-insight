import { apiRequest } from "@/features/auth/auth.api";

export interface OrderView {
    id: string;
    kind: "subscription" | "valuation_credit";
    plan: "unlimited" | "valued" | null;
    cycle: "month" | "year" | "once";
    amountVnd: number;
    receivedVnd: number;
    code: string;
    status: "pending" | "paid" | "expired" | "canceled" | "needs_review";
    expiresAt: string;
    paidAt: string | null;
    qrUrl: string;
    bank: string;
    accountNumber: string;
    accountHolder: string;
    transferContent: string;
    userId?: string;
}

export interface BillingNotice {
    id: string;
    type: string;
    title: string;
    body: string;
    readAt: string | null;
    createdAt: string;
}

export interface MyBilling {
    effectivePlan: "free" | "unlimited" | "valued";
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    subscriptionId: string | null;
    source: "payment" | "admin_grant" | null;
    valuationCredits: number;
    notices: BillingNotice[];
    orders: OrderView[];
}

export interface AdminUserHit {
    userId: string;
    email: string;
    displayName: string;
    role: string;
    plan: string;
}

export function createOrder(input: {
    kind: "subscription" | "valuation_credit";
    plan?: "unlimited" | "valued";
    cycle?: "month" | "year";
}): Promise<OrderView> {
    return apiRequest<OrderView>("/billing/orders", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function getOrder(id: string): Promise<OrderView> {
    return apiRequest<OrderView>(`/billing/orders/${id}`);
}

export function cancelOrder(id: string): Promise<OrderView> {
    return apiRequest<OrderView>(`/billing/orders/${id}`, { method: "DELETE" });
}

export function getMyBilling(): Promise<MyBilling> {
    return apiRequest<MyBilling>("/me/billing");
}

export function cancelSubscription(id: string): Promise<{ id: string }> {
    return apiRequest(`/me/billing/subscriptions/${id}/cancel`, { method: "POST" });
}

export function resumeSubscription(id: string): Promise<{ id: string }> {
    return apiRequest(`/me/billing/subscriptions/${id}/resume`, { method: "POST" });
}

export function markNoticeRead(id: string): Promise<void> {
    return apiRequest(`/me/billing/notices/${id}/read`, { method: "POST" });
}

export function adminOrders(status?: string): Promise<OrderView[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiRequest<OrderView[]>(`/admin/billing/orders${query}`);
}

export function resolveOrder(id: string, decision: "fulfill" | "reject", reason: string) {
    return apiRequest(`/admin/billing/orders/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ decision, reason }),
    });
}

export function revokeSubscription(id: string, reason: string) {
    return apiRequest(`/admin/billing/subscriptions/${id}/revoke`, {
        method: "POST",
        body: JSON.stringify({ reason }),
    });
}

export function searchUsers(query: string): Promise<{ items: AdminUserHit[]; total: number }> {
    return apiRequest(`/admin/users?query=${encodeURIComponent(query)}&pageSize=10`);
}

export function adminUserBilling(userId: string): Promise<MyBilling> {
    return apiRequest<MyBilling>(`/admin/billing/users/${userId}`);
}

export function grantSubscription(
    userId: string,
    input: { plan: "unlimited" | "valued"; periodEnd: string; reason: string },
) {
    return apiRequest(`/admin/users/${userId}/subscriptions`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function formatVnd(value: number): string {
    return `${new Intl.NumberFormat("vi-VN").format(value)} đồng`;
}

export const ORDER_STATUS: Record<OrderView["status"], string> = {
    pending: "Đang chờ chuyển khoản",
    paid: "Đã trả",
    expired: "Hết hạn",
    canceled: "Đã hủy",
    needs_review: "Chờ đối soát",
};
