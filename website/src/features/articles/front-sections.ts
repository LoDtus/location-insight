/**
 * Các mục của trang /bai-viet theo thứ tự trang. Mỗi mục là một hàng riêng có neo #id: cuộn tới đâu thì URL đổi sang
 * #mục đó, mở liên kết có #mục thì trang cuộn thẳng tới mục. Tách khỏi UI để kiểm thử được.
 */
export const FRONT_SECTIONS = [
    { id: "tieu-diem", label: "spotlight" },
    { id: "moi-nhat", label: "latest" },
    { id: "noi-bat", label: "popular" },
    { id: "de-xuat", label: "recommended" },
    { id: "video-anh", label: "media" },
    { id: "duoc-quan-tam", label: "engaged" },
    { id: "chu-de", label: "topicsTitle" },
] as const;

export type FrontSectionId = (typeof FRONT_SECTIONS)[number]["id"];

export function isFrontSection(id: string): id is FrontSectionId {
    return FRONT_SECTIONS.some((section) => section.id === id);
}

/**
 * Mục đang đọc: mục cuối cùng (theo thứ tự trang) có mép trên đã vượt qua vạch đọc. `tops` là khoảng cách từ mép trên
 * từng mục tới mép trên khung cuộn, cùng thứ tự với `ids`. null khi còn ở phần đầu trang (chưa tới mục nào).
 */
export function activeSection<T extends string>(ids: readonly T[], tops: readonly number[], line: number): T | null {
    let active: T | null = null;
    ids.forEach((id, index) => {
        if (tops[index] <= line) active = id;
    });
    return active;
}

/** URL sau khi đổi mục: giữ đường dẫn và query, thay hash (bỏ hash khi chưa tới mục nào). */
export function urlWithSection(pathname: string, search: string, id: string | null): string {
    return `${pathname}${search}${id ? `#${id}` : ""}`;
}

/**
 * Các ô của thanh phân trang: luôn có trang đầu, trang cuối, trang hiện tại và `around` trang hai bên; khoảng bị lược
 * thay bằng "gap". Ví dụ (5, 10) → [1, gap, 4, 5, 6, gap, 10].
 */
export function pageWindow(page: number, pages: number, around = 1): Array<number | "gap"> {
    if (pages <= 1) return [1];
    const keep = new Set<number>([1, pages]);
    for (let at = page - around; at <= page + around; at += 1) if (at >= 1 && at <= pages) keep.add(at);
    // Không lược đúng một trang: hiện luôn trang đó thay vì dấu "…".
    const sorted = [...keep].sort((a, b) => a - b);
    const cells: Array<number | "gap"> = [];
    sorted.forEach((value, index) => {
        const previous = sorted[index - 1];
        if (previous !== undefined && value - previous === 2) cells.push(previous + 1);
        else if (previous !== undefined && value - previous > 2) cells.push("gap");
        cells.push(value);
    });
    return cells;
}

/** "2 giờ trước", "3 ngày trước" theo locale; quá 7 ngày thì null (dùng ngày tháng). */
export function relativeTime(iso: string, now: number, locale: string): string | null {
    const diff = (Date.parse(iso) - now) / 1000;
    const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const abs = Math.abs(diff);
    if (abs < 60) return format.format(Math.round(diff), "second");
    if (abs < 3600) return format.format(Math.round(diff / 60), "minute");
    if (abs < 86_400) return format.format(Math.round(diff / 3600), "hour");
    if (abs < 7 * 86_400) return format.format(Math.round(diff / 86_400), "day");
    return null;
}

/** Bài đăng trong vòng 6 giờ được đánh dấu "Mới". */
export function isFresh(iso: string, now: number): boolean {
    const age = now - Date.parse(iso);
    return age >= 0 && age < 6 * 3_600_000;
}
