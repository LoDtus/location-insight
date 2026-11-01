import { apiRequest } from "@/features/auth/auth.api";

export type EmailCategory = "security" | "transactional" | "notification" | "marketing";
export type EmailStatus = "queued" | "sending" | "sent" | "dead" | "suppressed" | "skipped";
export type EmailLocale = "vi" | "en";

export const LOCALES: EmailLocale[] = ["vi", "en"];

export const CATEGORY_LABEL: Record<EmailCategory, string> = {
    security: "Bảo mật",
    transactional: "Giao dịch",
    notification: "Thông báo",
    marketing: "Tiếp thị",
};

export const STATUS_LABEL: Record<EmailStatus, string> = {
    queued: "Đang chờ",
    sending: "Đang gửi",
    sent: "Đã gửi",
    dead: "Thất bại",
    suppressed: "Bị chặn",
    skipped: "Bỏ qua",
};

export interface TemplateSummary {
    key: string;
    category: EmailCategory;
    name: string;
    description: string;
    locales: Array<{ locale: EmailLocale; customized: boolean; enabled: boolean; updatedAt: string | null }>;
}

export interface TemplateVariable {
    name: string;
    description: string;
    example: string;
}

export interface TemplateDetail {
    key: string;
    locale: EmailLocale;
    category: EmailCategory;
    name: string;
    customized: boolean;
    enabled: boolean;
    version: number;
    subject: string;
    bodyHtml: string;
    bodyText: string | null;
    defaults: { subject: string; bodyHtml: string; bodyText: string };
    variables: TemplateVariable[];
}

export interface TemplateInput {
    subject: string;
    bodyHtml: string;
    bodyText: string | null;
    enabled: boolean;
}

export interface EmailLogItem {
    id: string;
    templateKey: string;
    category: EmailCategory;
    to: string;
    subject: string;
    status: EmailStatus;
    attempts: number;
    error: string | null;
    hasContent: boolean;
    createdAt: string;
    sentAt: string | null;
}

export interface EmailStats {
    last24h: Partial<Record<EmailStatus, number>>;
    queueDepth: number;
    oldestPendingSeconds: number;
}

export interface Suppression {
    email: string;
    reason: "hard_bounce" | "complaint" | "manual";
    note: string | null;
    createdAt: string;
}

export interface EmailPreference {
    category: "notification" | "marketing";
    enabled: boolean;
}

const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const listTemplates = (): Promise<TemplateSummary[]> => apiRequest("/admin/email/templates");

export const getTemplate = (key: string, locale: EmailLocale): Promise<TemplateDetail> =>
    apiRequest(`/admin/email/templates/${key}?locale=${locale}`);

export const saveTemplate = (key: string, locale: EmailLocale, input: TemplateInput): Promise<TemplateDetail> =>
    apiRequest(`/admin/email/templates/${key}/${locale}`, { method: "PUT", body: JSON.stringify(input) });

export const resetTemplate = (key: string, locale: EmailLocale): Promise<TemplateDetail> =>
    apiRequest(`/admin/email/templates/${key}/${locale}`, { method: "DELETE" });

export const previewTemplate = (
    key: string,
    input: { locale: EmailLocale; subject: string; bodyHtml: string; bodyText: string | null },
): Promise<{ subject: string; html: string; text: string }> =>
    apiRequest(`/admin/email/templates/${key}/preview`, json(input));

export const sendTest = (key: string, locale: EmailLocale): Promise<{ id: string }> =>
    apiRequest(`/admin/email/templates/${key}/test`, json({ locale }));

export function listMessages(params: {
    status?: string;
    template?: string;
    q?: string;
    cursor?: string | null;
}): Promise<{ items: EmailLogItem[]; nextCursor: string | null }> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    const text = search.toString();
    return apiRequest(`/admin/email/messages${text ? `?${text}` : ""}`);
}

export const retryMessage = (id: string): Promise<{ id: string }> => apiRequest(`/admin/email/messages/${id}/retry`, json({}));
export const getStats = (): Promise<EmailStats> => apiRequest("/admin/email/stats");
export const listSuppressions = (): Promise<Suppression[]> => apiRequest("/admin/email/suppressions");
export const addSuppression = (email: string, note?: string): Promise<{ email: string }> =>
    apiRequest("/admin/email/suppressions", json({ email, note: note || undefined }));
export const removeSuppression = (email: string): Promise<{ email: string }> =>
    apiRequest(`/admin/email/suppressions/${encodeURIComponent(email)}`, { method: "DELETE" });

export const getPreferences = (): Promise<EmailPreference[]> => apiRequest("/email/preferences");
export const setPreference = (category: EmailPreference["category"], enabled: boolean): Promise<EmailPreference[]> =>
    apiRequest("/email/preferences", { method: "PUT", body: JSON.stringify({ category, enabled }) });
export const unsubscribe = (query: string): Promise<{ category: string }> =>
    apiRequest(`/email/unsubscribe?${query}`, json({}));
