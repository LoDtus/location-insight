import { MESSAGING_LIMITS } from './messaging.constants.js';

export type MessageKind = 'text' | 'image' | 'file' | 'post_share' | 'system';
export type ConversationState = 'pending' | 'active' | 'declined';

export interface SendGateInput {
  state: ConversationState;
  iAmInitiator: boolean;
  lastSeq: number;
  kind: MessageKind;
}

export type SendGate = 'ok' | 'request_pending' | 'request_text_only';

/** Luật gửi trong hội thoại chưa được chấp nhận (BR-04). */
export function sendGate(input: SendGateInput): SendGate {
  if (!input.iAmInitiator || input.state === 'active') return 'ok';
  if (input.state === 'declined') return 'request_pending';
  if (input.lastSeq >= 1) return 'request_pending';
  if (input.kind !== 'text') return 'request_text_only';
  return 'ok';
}

/** Trạng thái người khởi tạo thấy: declined hiện như pending. */
export function visibleState(
  state: ConversationState,
  iAmInitiator: boolean,
): ConversationState {
  return state === 'declined' && iAmInitiator ? 'pending' : state;
}

/** Khóa duy nhất cho hội thoại 1-1, không phụ thuộc thứ tự hai người. */
export function directKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function previewFor(kind: MessageKind, body: string): string {
  if (kind === 'image') return body ? truncate(body) : 'Đã gửi ảnh';
  if (kind === 'file') return body ? truncate(body) : 'Đã gửi một tệp';
  if (kind === 'post_share') return 'Đã gửi một bài viết';
  return truncate(body);
}

export const UNSENT_PREVIEW = 'Tin nhắn đã thu hồi';

export function truncate(
  value: string,
  max: number = MESSAGING_LIMITS.previewMax,
): string {
  const chars = Array.from(value.replace(/\s+/g, ' ').trim());
  return chars.length <= max
    ? chars.join('')
    : `${chars.slice(0, max - 1).join('')}…`;
}

export function excerpt(
  value: string,
  max: number = MESSAGING_LIMITS.excerptMax,
): string {
  return truncate(value, max);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function writeCursor(parts: Array<string | number>): string {
  return Buffer.from(parts.join('|')).toString('base64url');
}

export function readCursor(
  cursor: string | undefined,
  size: number,
): string[] | null {
  if (!cursor) return null;
  try {
    const parts = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    return parts.length === size && parts.every(Boolean) ? parts : null;
  } catch {
    return null;
  }
}

export function pngSize(
  bytes: Buffer,
): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  if (!bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])))
    return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

export function pixelsOk(width: number, height: number): boolean {
  return (
    width >= 1 &&
    height >= 1 &&
    width <= MESSAGING_LIMITS.imageSideMax &&
    height <= MESSAGING_LIMITS.imageSideMax &&
    width * height <= MESSAGING_LIMITS.imagePixelsMax
  );
}
