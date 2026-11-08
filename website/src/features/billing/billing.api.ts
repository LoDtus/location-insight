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

export type RefundReason =
    | "within_24h"
    | "service_outage"
    | "operator_stop"
    | "duplicate_or_wrong"
    | "overpay"
    | "legal";

export type RefundStatus = "requested" | "approved" | "rejected" | "paid_out";

export interface RefundView {
    id: string;
    orderId: string;
    orderCode: string | null;
    reason: RefundReason;
    amountVnd: number;
    status: RefundStatus;
    userNote: string | null;
    payoutAccountName: string | null;
    payoutAccountNumber: string | null;
    payoutBank: string | null;
    decisionNote: string | null;
    decidedAt: string | null;
    payoutReference: string | null;
    paidOutAt: string | null;
    createdAt: string;
    userId?: string;
}

export interface RefundInput {
    reason: RefundReason;
    userNote?: string;
    payoutAccountName: string;
    payoutAccountNumber: string;
    payoutBank: string;
}

export function requestRefund(orderId: string, input: RefundInput): Promise<RefundView> {
    return apiRequest<RefundView>(`/billing/orders/${orderId}/refunds`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function myRefunds(): Promise<RefundView[]> {
    return apiRequest<RefundView[]>("/me/billing/refunds");
}

export function adminRefunds(status?: RefundStatus, page = 1): Promise<RefundView[]> {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    return apiRequest<RefundView[]>(`/admin/billing/refunds?${params.toString()}`);
}

export function decideRefund(id: string, decision: "approve" | "reject", note: string) {
    return apiRequest<RefundView>(`/admin/billing/refunds/${id}`, {
        method: "POST",
        body: JSON.stringify({ decision, note }),
    });
}

export function markRefundPaidOut(id: string, referenceCode: string) {
    return apiRequest<RefundView>(`/admin/billing/refunds/${id}/paid-out`, {
        method: "POST",
        body: JSON.stringify({ referenceCode }),
    });
}

export const REFUND_REASON: Record<RefundReason, string> = {
    within_24h: "Đổi ý trong 24 giờ, chưa dùng quyền lợi",
    service_outage: "Dịch vụ gặp sự cố",
    operator_stop: "Ngừng cung cấp dịch vụ",
    duplicate_or_wrong: "Trả trùng hoặc nhầm đơn",
    overpay: "Chuyển thừa tiền",
    legal: "Theo quy định pháp luật",
};

export const REFUND_STATUS: Record<RefundStatus, string> = {
    requested: "Đang chờ xét",
    approved: "Đã duyệt, chờ chuyển tiền",
    rejected: "Bị từ chối",
    paid_out: "Đã chuyển tiền",
};

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
