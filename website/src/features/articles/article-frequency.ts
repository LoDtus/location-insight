import type { FrequencyGrain } from "@/features/articles/articles.api";

/**
 * Chọn khoảng thời gian cho biểu đồ "Số bài đã đăng" (giờ Việt Nam). Tách khỏi UI để kiểm thử được.
 * - Mốc nhanh: 30/60 ngày gần nhất (theo ngày), nửa năm/1 năm gần nhất (theo tháng), tính lùi từ hôm nay.
 * - Tự chọn: một khoảng ngày, một tháng (theo ngày) hoặc một năm (theo tháng); tháng/năm có mũi tên lùi/tiến.
 * - Không cho xem tương lai: mọi khoảng bị cắt ở `latest` (hôm nay, hoặc ngày của bài đặt lịch xa nhất).
 */

export type FrequencyPreset = "30d" | "60d" | "6m" | "1y";

export type FrequencySelection =
    | { kind: "preset"; preset: FrequencyPreset }
    | { kind: "range"; from: string; to: string }
    | { kind: "month"; month: string }
    | { kind: "year"; year: string };

export type FrequencyQuery = { grain: FrequencyGrain; from: string; to: string };

export const FREQUENCY_PRESETS: { id: FrequencyPreset; label: string; title: string }[] = [
    { id: "30d", label: "30 ngày", title: "30 ngày gần nhất" },
    { id: "60d", label: "60 ngày", title: "60 ngày gần nhất" },
    { id: "6m", label: "6 tháng", title: "Nửa năm gần nhất" },
    { id: "1y", label: "1 năm", title: "1 năm gần nhất" },
];

/** Khoảng ngày dài hơn mức này thì gom theo tháng để biểu đồ không dày đặc. */
const RANGE_DAY_LIMIT = 186;

/** Hôm nay theo giờ Việt Nam, YYYY-MM-DD. */
export function vnToday(now: Date = new Date()): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function utc(day: string): Date {
    return new Date(`${day}T00:00:00Z`);
}

export function addDays(day: string, delta: number): string {
    const date = utc(day);
    date.setUTCDate(date.getUTCDate() + delta);
    return date.toISOString().slice(0, 10);
}

export function addMonths(month: string, delta: number): string {
    const [year, mon] = month.split("-").map(Number);
    const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastDayOfMonth(month: string): string {
    return addDays(`${addMonths(month, 1)}-01`, -1);
}

export function daysBetween(from: string, to: string): number {
    return Math.round((utc(to).getTime() - utc(from).getTime()) / 86_400_000);
}

function minKey(a: string, b: string): string {
    return a < b ? a : b;
}

/** Tham số gửi API cho một lựa chọn. `today` là hôm nay, `latest` là ngày xa nhất được xem (≥ today). */
export function resolveFrequency(selection: FrequencySelection, today: string, latest: string): FrequencyQuery {
    if (selection.kind === "preset") {
        if (selection.preset === "30d") return { grain: "day", from: addDays(today, -29), to: today };
        if (selection.preset === "60d") return { grain: "day", from: addDays(today, -59), to: today };
        const month = today.slice(0, 7);
        return { grain: "month", from: addMonths(month, selection.preset === "6m" ? -5 : -11), to: month };
    }
    if (selection.kind === "month") {
        return { grain: "day", from: `${selection.month}-01`, to: minKey(lastDayOfMonth(selection.month), latest) };
    }
    if (selection.kind === "year") {
        return { grain: "month", from: `${selection.year}-01`, to: minKey(`${selection.year}-12`, latest.slice(0, 7)) };
    }
    const to = minKey(selection.to, latest);
    const from = minKey(selection.from, to);
    if (daysBetween(from, to) + 1 > RANGE_DAY_LIMIT) return { grain: "month", from: from.slice(0, 7), to: to.slice(0, 7) };
    return { grain: "day", from, to };
}

/** Lùi/tiến một tháng hoặc một năm; null nếu đã chạm tương lai (không còn gì để xem). */
export function shiftSelection(selection: FrequencySelection, delta: -1 | 1, latest: string): FrequencySelection | null {
    if (selection.kind === "month") {
        const month = addMonths(selection.month, delta);
        return month > latest.slice(0, 7) ? null : { kind: "month", month };
    }
    if (selection.kind === "year") {
        const year = String(Number(selection.year) + delta);
        return year > latest.slice(0, 4) ? null : { kind: "year", year };
    }
    return null;
}

const WEEKDAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

/** Nhãn đầy đủ của một mốc (tooltip, bảng đọc màn hình): "Thứ bảy, 08/11/2026", "Tháng 11/2026", "Năm 2026". */
export function bucketLabel(grain: FrequencyGrain, bucket: string): string {
    if (grain === "year") return `Năm ${bucket}`;
    const [year, month, day] = bucket.split("-");
    if (grain === "month") return `Tháng ${month}/${year}`;
    return `${WEEKDAYS[utc(bucket).getUTCDay()]}, ${day}/${month}/${year}`;
}

/** Nhãn ngắn trên trục: "08/11", "T11/2026", "2026". */
export function axisTick(grain: FrequencyGrain, bucket: string): string {
    if (grain === "year") return bucket;
    const [year, month, day] = bucket.split("-");
    if (grain === "month") return `T${Number(month)}/${year}`;
    return `${day}/${month}`;
}

/** Mô tả khoảng đang xem: "30 ngày gần nhất", "Tháng 10/2026", "Năm 2025", "01/09/2026 – 15/10/2026". */
export function selectionTitle(selection: FrequencySelection): string {
    if (selection.kind === "preset") return FREQUENCY_PRESETS.find((preset) => preset.id === selection.preset)?.title ?? "";
    if (selection.kind === "month") return bucketLabel("month", selection.month);
    if (selection.kind === "year") return `Năm ${selection.year}`;
    const short = (day: string): string => day.split("-").reverse().join("/");
    return `${short(selection.from)} – ${short(selection.to)}`;
}

/** Bước hiện nhãn trục để không quá `max` nhãn (ECharts `interval` = số nhãn bỏ qua giữa hai nhãn hiện). */
export function tickInterval(count: number, max: number): number {
    return count <= max ? 0 : Math.ceil(count / max) - 1;
}
