export const OFFLINE_PATH = "/offline";
export const FALLBACK_URL = "/app/notification";
export const DEFAULT_ICON = "/icons/icon-192.png";
export const DEFAULT_BADGE = "/icons/badge-96.png";
export const CACHE_LIMIT_BYTES = 20 * 1024 * 1024;

export type PushView = {
    title: string;
    body: string;
    url: string;
    tag: string;
    icon: string;
    badge: string;
    timestamp?: number;
    renotify: boolean;
    id?: string;
    type: string;
    unread?: number;
};

export function isAppPath(pathname: string): boolean {
    return pathname === "/app" || pathname.startsWith("/app/") || pathname === "/admin" || pathname.startsWith("/admin/");
}

export function notificationTarget(raw: string | undefined, origin: string): string {
    if (!raw) return FALLBACK_URL;
    let url: URL;
    try {
        url = new URL(raw, origin);
    } catch {
        return FALLBACK_URL;
    }
    if (url.origin !== origin || !isAppPath(url.pathname)) return FALLBACK_URL;
    return `${url.pathname}${url.search}`;
}

export function withNotificationId(path: string, id: string | undefined): string {
    if (!id) return path;
    const url = new URL(path, "https://app.local");
    url.searchParams.set("n", id);
    return `${url.pathname}${url.search}`;
}

export function isStaticAsset(pathname: string): boolean {
    return (
        pathname.startsWith("/_next/static/") ||
        pathname.startsWith("/icons/") ||
        pathname.startsWith("/fonts/") ||
        pathname === OFFLINE_PATH
    );
}

export function responseIsPrivate(headers: { get(name: string): string | null }): boolean {
    if (headers.get("set-cookie")) return true;
    const cache = (headers.get("cache-control") ?? "").toLowerCase();
    return cache.includes("private") || cache.includes("no-store");
}

export function parsePushPayload(raw: string, origin: string): PushView {
    try {
        const data = JSON.parse(raw) as Record<string, unknown>;
        const title = typeof data.title === "string" ? data.title.trim().slice(0, 120) : "";
        if (!title) return genericPush();
        return {
            title,
            body: typeof data.body === "string" ? data.body.slice(0, 200) : "",
            url: notificationTarget(typeof data.url === "string" ? data.url : undefined, origin),
            tag: typeof data.tag === "string" && data.tag ? data.tag.slice(0, 64) : "notification",
            icon: iconPath(data.icon, DEFAULT_ICON),
            badge: iconPath(data.badge, DEFAULT_BADGE),
            timestamp: typeof data.ts === "number" ? data.ts : undefined,
            renotify: data.renotify === true,
            id: typeof data.id === "string" ? data.id : undefined,
            type: typeof data.type === "string" ? data.type : "unknown",
            unread: typeof data.unread === "number" && Number.isFinite(data.unread) ? data.unread : undefined,
        };
    } catch {
        return genericPush();
    }
}

function genericPush(): PushView {
    return {
        title: "Bạn có thông báo mới",
        body: "",
        url: FALLBACK_URL,
        tag: "notification",
        icon: DEFAULT_ICON,
        badge: DEFAULT_BADGE,
        renotify: false,
        type: "generic",
    };
}

function iconPath(value: unknown, fallback: string): string {
    if (typeof value !== "string" || !value.startsWith("/icons/") || value.includes("..")) return fallback;
    return value;
}
