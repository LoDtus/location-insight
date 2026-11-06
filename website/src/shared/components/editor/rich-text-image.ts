/**
 * Nguồn ảnh được phép trong nội dung bài: đường dẫn nội bộ ("/…", không phải "//…") hoặc https.
 * Mọi thứ khác (javascript:, data:, http:) bị bỏ, ảnh không được dựng.
 */
export function safeImageSrc(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const src = value.trim();
    if (src.length === 0 || src.length > 2000) return null;
    if (src.startsWith("/") && !src.startsWith("//")) return src;
    try {
        return new URL(src).protocol === "https:" ? src : null;
    } catch {
        return null;
    }
}
