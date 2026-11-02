import { apiRequest } from "@/features/auth/auth.api";

export interface NotificationItem {
    id: string;
    type: string;
    category: string;
    icon: string;
    tone: "neutral" | "info" | "success" | "warning" | "danger";
    title: string;
    subtitle: string | null;
    createdAt: string;
    readAt: string | null;
    link: string;
    count: number;
}

export interface UnreadCount {
    count: number;
    capped: boolean;
}

export interface ChannelPreference {
    inApp: boolean;
    push: boolean;
}

export interface NotificationPreferences {
    hideContentOnLockScreen: boolean;
    groups: Record<string, ChannelPreference>;
}

export interface PushConfig {
    enabled: boolean;
    vapidPublicKey?: string;
}

export interface PushDevice {
    id: string;
    platform: string;
    label: string | null;
    installedPwa: boolean;
    pushEnabled: boolean;
    suspended: boolean;
    current: boolean;
    lastSeenAt: string;
    lastSuccessAt: string | null;
    createdAt: string;
}

export function listNotifications(filter: "all" | "unread", cursor?: string | null): Promise<{ items: NotificationItem[]; nextCursor: string | null }> {
    const params = new URLSearchParams({ limit: "20", filter });
    if (cursor) params.set("cursor", cursor);
    return apiRequest(`/notifications?${params.toString()}`);
}

export function unreadCount(): Promise<UnreadCount> {
    return apiRequest("/notifications/unread-count");
}

export function markRead(id: string): Promise<void> {
    return apiRequest(`/notifications/${id}/read`, { method: "PUT" });
}

export function markUnread(id: string): Promise<void> {
    return apiRequest(`/notifications/${id}/unread`, { method: "PUT" });
}

export function markReadBatch(ids: string[]): Promise<void> {
    return apiRequest("/notifications/read-batch", { method: "POST", body: JSON.stringify({ ids }) });
}

export function markReadAll(upToId?: string): Promise<{ updated: number }> {
    return apiRequest("/notifications/read-all", { method: "POST", body: JSON.stringify(upToId ? { upToId } : {}) });
}

export function removeNotification(id: string): Promise<void> {
    return apiRequest(`/notifications/${id}`, { method: "DELETE" });
}

export function getPreferences(): Promise<NotificationPreferences> {
    return apiRequest("/notifications/preferences");
}

export function patchPreferences(body: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    return apiRequest("/notifications/preferences", { method: "PATCH", body: JSON.stringify(body) });
}

export function pushConfig(): Promise<PushConfig> {
    return apiRequest("/notifications/push/config");
}

export function listDevices(deviceId: string): Promise<PushDevice[]> {
    return apiRequest(`/notifications/push/subscriptions?deviceId=${deviceId}`);
}

export function saveSubscription(body: Record<string, unknown>): Promise<PushDevice> {
    return apiRequest("/notifications/push/subscriptions", { method: "POST", body: JSON.stringify(body) });
}

export function patchDevice(id: string, body: { pushEnabled?: boolean; label?: string }): Promise<PushDevice> {
    return apiRequest(`/notifications/push/subscriptions/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function removeDevice(id: string): Promise<void> {
    return apiRequest(`/notifications/push/subscriptions/${id}`, { method: "DELETE" });
}

export function sendTestPush(): Promise<void> {
    return apiRequest("/notifications/push/test", { method: "POST" });
}
