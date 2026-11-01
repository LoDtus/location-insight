const TZ = "Asia/Ho_Chi_Minh";

function dayKey(date: Date): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);
}

/** "Vừa xong", "5 phút", "2 giờ", "Hôm qua", "2 ngày", "1 tuần", sau đó ngày tháng. */
export function listTime(iso: string | null, now: number = Date.now()): string {
    if (!iso) return "";
    const at = new Date(iso);
    const delta = now - at.getTime();
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (delta < minute) return "Vừa xong";
    if (delta < hour) return `${Math.floor(delta / minute)} phút`;
    if (delta < day && dayKey(at) === dayKey(new Date(now))) return `${Math.floor(delta / hour)} giờ`;
    const days = Math.round((Date.parse(dayKey(new Date(now))) - Date.parse(dayKey(at))) / day);
    if (days <= 1) return "Hôm qua";
    if (days < 7) return `${days} ngày`;
    if (days < 30) return `${Math.floor(days / 7)} tuần`;
    return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", timeZone: TZ }).format(at);
}

export function clockTime(iso: string): string {
    return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
}

export function fullTime(iso: string): string {
    return new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: TZ,
    }).format(new Date(iso));
}

/** Dải thời gian giữa các cụm tin: "Hôm nay 14:05", "Hôm qua 09:12", "12 thg 10, 2026". */
export function dayLabel(iso: string, now: number = Date.now()): string {
    const at = new Date(iso);
    const day = 24 * 60 * 60 * 1000;
    const diff = Math.round((Date.parse(dayKey(new Date(now))) - Date.parse(dayKey(at))) / day);
    if (diff === 0) return `Hôm nay ${clockTime(iso)}`;
    if (diff === 1) return `Hôm qua ${clockTime(iso)}`;
    return `${new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }).format(at)} ${clockTime(iso)}`;
}

export function presenceText(
    presence: { online: boolean; lastActiveAt: string | null } | null,
    now: number = Date.now(),
): string {
    if (!presence) return "";
    if (presence.online) return "Đang hoạt động";
    if (!presence.lastActiveAt) return "";
    const delta = now - new Date(presence.lastActiveAt).getTime();
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (delta < minute) return "Vừa hoạt động";
    if (delta < hour) return `Hoạt động ${Math.floor(delta / minute)} phút trước`;
    if (delta < day) return `Hoạt động ${Math.floor(delta / hour)} giờ trước`;
    if (delta < 30 * day) return `Hoạt động ${Math.floor(delta / day)} ngày trước`;
    return "";
}

/** Hai tin liên tiếp cùng người gửi trong dưới 3 phút thì gộp thành một cụm. */
export function sameGroup(
    previous: { senderId: string; createdAt: string } | undefined,
    current: { senderId: string; createdAt: string },
): boolean {
    if (!previous || previous.senderId !== current.senderId) return false;
    return new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime() < 3 * 60_000;
}

/** Chèn dải thời gian khi cách tin trước hơn 30 phút hoặc khác ngày. */
export function needsSeparator(previousIso: string | undefined, currentIso: string): boolean {
    if (!previousIso) return true;
    const a = new Date(previousIso);
    const b = new Date(currentIso);
    return b.getTime() - a.getTime() > 30 * 60_000 || dayKey(a) !== dayKey(b);
}

const URL_PATTERN = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;

export type TextPart = { type: "text" | "link"; value: string };

/** Tách liên kết để vẽ bằng thẻ <a>; không bao giờ chèn HTML. */
export function splitLinks(text: string): TextPart[] {
    const parts: TextPart[] = [];
    let last = 0;
    for (const match of text.matchAll(URL_PATTERN)) {
        const index = match.index ?? 0;
        if (index > last) parts.push({ type: "text", value: text.slice(last, index) });
        parts.push({ type: "link", value: match[0] });
        last = index + match[0].length;
    }
    if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
    return parts;
}

export function initials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    return (words.at(-1) ?? "?").slice(0, 1).toLocaleUpperCase("vi");
}
