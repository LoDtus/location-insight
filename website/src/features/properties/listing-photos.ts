export const MAX_PHOTOS = 10;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_EDGE_PX = 1280;
const JPEG_QUALITY = 0.82;

export type PhotoRejection = "type" | "size" | "decode";
export type PhotoResult = { ok: true; dataUrl: string } | { ok: false; reason: PhotoRejection };

/** Nhận dạng ảnh bằng chữ ký đầu tệp (magic bytes), không tin đuôi tệp hay Content-Type. */
export function detectImageType(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (bytes.length >= 8 && png.every((value, index) => bytes[index] === value)) return "png";
    const ascii = (from: number, length: number): string => String.fromCharCode(...bytes.slice(from, from + length));
    if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "webp";
    return null;
}

export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
    const longest = Math.max(width, height);
    if (longest <= maxEdge) return { width, height };
    const scale = maxEdge / longest;
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Kiểm tra, thu nhỏ và mã hóa ảnh thành JPEG data URL.
 * Tạm thời lưu cùng tin trong trình duyệt; khi có backend sẽ thay bằng tải lên kho đối tượng.
 */
export async function preparePhoto(file: File): Promise<PhotoResult> {
    if (file.size > MAX_PHOTO_BYTES) return { ok: false, reason: "size" };
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!detectImageType(head)) return { ok: false, reason: "type" };
    try {
        const bitmap = await createImageBitmap(file);
        const size = fitWithin(bitmap.width, bitmap.height, MAX_EDGE_PX);
        const canvas = document.createElement("canvas");
        canvas.width = size.width;
        canvas.height = size.height;
        const context = canvas.getContext("2d");
        if (!context) return { ok: false, reason: "decode" };
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size.width, size.height);
        context.drawImage(bitmap, 0, 0, size.width, size.height);
        bitmap.close();
        return { ok: true, dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY) };
    } catch {
        return { ok: false, reason: "decode" };
    }
}
