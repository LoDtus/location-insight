import {
  ALLOWED_FILE_TYPES,
  ALLOWED_IMAGE_TYPES,
  MESSAGING_LIMITS,
} from './messaging.constants.js';

export function isImageType(contentType: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType);
}

export function isFileType(contentType: string): boolean {
  return Object.prototype.hasOwnProperty.call(ALLOWED_FILE_TYPES, contentType);
}

export function fileExtension(contentType: string): string | null {
  if (isFileType(contentType))
    return ALLOWED_FILE_TYPES[contentType as keyof typeof ALLOWED_FILE_TYPES];
  return null;
}

// eslint-disable-next-line no-control-regex
const UNSAFE_NAME = /[\u0000-\u001f\u007f\\/:*?"<>|​-‏‪-‮⁦-⁩]/g;

/**
 * Tên hiển thị của tệp: NFC, bỏ ký tự điều khiển, đường dẫn và ký tự đặc biệt, gộp khoảng trắng, cắt độ dài,
 * và luôn kết thúc bằng đúng đuôi của loại nội dung đã kiểm (đuôi do người dùng gõ không được tin).
 * Tên này chỉ để hiển thị và đặt tên tệp tải về; khóa lưu trữ do máy chủ sinh.
 */
export function sanitizeFileName(raw: string, contentType: string): string {
  const extension = fileExtension(contentType) ?? '';
  const cleaned = raw
    .normalize('NFC')
    .replace(UNSAFE_NAME, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+/, '')
    .trim();
  const dot = cleaned.lastIndexOf('.');
  const stem = (dot > 0 ? cleaned.slice(0, dot) : cleaned).trim() || 'tep';
  const max =
    MESSAGING_LIMITS.fileNameMax - (extension ? extension.length + 1 : 0);
  const shortStem =
    Array.from(stem).slice(0, Math.max(max, 1)).join('').trim() || 'tep';
  return extension ? `${shortStem}.${extension}` : shortStem;
}

const PDF = Buffer.from('%PDF-');
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/** Kiểm chữ ký tệp theo loại đã khai báo (không tin Content-Type của client). `head` là vài trăm byte đầu. */
export function sniffFile(head: Buffer, contentType: string): boolean {
  if (contentType === 'application/pdf')
    return head.subarray(0, PDF.length).equals(PDF);
  if (
    isFileType(contentType) &&
    contentType.startsWith('application/vnd.openxmlformats-officedocument.')
  ) {
    return head.subarray(0, ZIP.length).equals(ZIP);
  }
  if (contentType === 'text/plain' || contentType === 'text/csv')
    return looksLikeText(head);
  return false;
}

function looksLikeText(head: Buffer): boolean {
  if (head.length === 0 || head.includes(0)) return false;
  // Đầu tệp có thể cắt giữa một ký tự nhiều byte: bỏ tối đa 3 byte cuối rồi kiểm UTF-8 nghiêm ngặt.
  for (let drop = 0; drop <= 3 && drop < head.length; drop += 1) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(
        head.subarray(0, head.length - drop),
      );
      return true;
    } catch {
      /* thử bỏ thêm byte cuối */
    }
  }
  return false;
}

/** Tiêu đề Content-Disposition buộc tải xuống, tên UTF-8 an toàn (RFC 6266 / 5987). */
export function attachmentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
