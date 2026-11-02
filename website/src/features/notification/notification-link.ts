export function safeLink(value: string): string | null {
    if (!value.startsWith("/app/") && !value.startsWith("/admin/")) return null;
    if (value.includes("..") || value.includes("\\")) return null;
    return value;
}

export function relativeTime(iso: string, now = Date.now()): string {
    const delta = now - new Date(iso).getTime();
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const format = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });
    if (delta < hour) return format.format(-Math.max(1, Math.round(delta / minute)), "minute");
    if (delta < day) return format.format(-Math.round(delta / hour), "hour");
    if (delta < 7 * day) return format.format(-Math.round(delta / day), "day");
    return new Intl.DateTimeFormat("vi", { dateStyle: "medium" }).format(new Date(iso));
}

export function absoluteTime(iso: string): string {
    return new Intl.DateTimeFormat("vi", { dateStyle: "full", timeStyle: "short" }).format(new Date(iso));
}
