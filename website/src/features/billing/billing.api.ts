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
    valuationCredits: number;
    notices: BillingNotice[];
    orders: OrderView[];
}

export interface RefundView {
    id: string;
    orderId?: string;
    userId?: string;
    status: "requested" | "approved" | "rejected" | "paid_out";
    amountVnd: number;
    reason: string;
    payoutAccountName?: string;
    payoutAccountNumber?: string;
    payoutBank?: string;
    payoutReference?: string | null;
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

export function markNoticeRead(id: string): Promise<void> {
    return apiRequest(`/me/billing/notices/${id}/read`, { method: "POST" });
}

export function requestRefund(
    orderId: string,
    input: {
        reason: string;
        amountVnd: number;
        userNote?: string;
        payoutAccountName: string;
        payoutAccountNumber: string;
        payoutBank: string;
    },
): Promise<RefundView> {
    return apiRequest<RefundView>(`/billing/orders/${orderId}/refunds`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function adminOrders(status?: string): Promise<OrderView[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiRequest<OrderView[]>(`/admin/billing/orders${query}`);
}

export function adminRefunds(): Promise<RefundView[]> {
    return apiRequest<RefundView[]>("/admin/billing/refunds");
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

export function decideRefund(id: string, decision: "approve" | "reject", note: string) {
    return apiRequest(`/admin/billing/refunds/${id}`, {
        method: "POST",
        body: JSON.stringify({ decision, note }),
    });
}

export function markRefundPaid(id: string, referenceCode: string) {
    return apiRequest(`/admin/billing/refunds/${id}/paid-out`, {
        method: "POST",
        body: JSON.stringify({ referenceCode }),
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
