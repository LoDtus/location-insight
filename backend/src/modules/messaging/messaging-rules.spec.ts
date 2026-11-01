import { describe, expect, it } from 'vitest';
import {
  directKey,
  escapeLike,
  excerpt,
  pixelsOk,
  pngSize,
  previewFor,
  readCursor,
  sendGate,
  visibleState,
  writeCursor,
} from './messaging-rules.js';
import { cleanMessage } from './messaging-text.js';

describe('sendGate (BR-04)', () => {
  it('người khởi tạo gửi được 1 tin chữ khi pending', () => {
    expect(sendGate({ state: 'pending', iAmInitiator: true, lastSeq: 0, kind: 'text' })).toBe('ok');
  });
  it('tin thứ hai khi pending bị chặn', () => {
    expect(sendGate({ state: 'pending', iAmInitiator: true, lastSeq: 1, kind: 'text' })).toBe('request_pending');
  });
  it('ảnh và bài chia sẻ bị chặn khi pending', () => {
    expect(sendGate({ state: 'pending', iAmInitiator: true, lastSeq: 0, kind: 'image' })).toBe('request_text_only');
    expect(sendGate({ state: 'pending', iAmInitiator: true, lastSeq: 0, kind: 'post_share' })).toBe('request_text_only');
  });
  it('declined không cho người khởi tạo gửi', () => {
    expect(sendGate({ state: 'declined', iAmInitiator: true, lastSeq: 1, kind: 'text' })).toBe('request_pending');
  });
  it('người nhận gửi tự do và hội thoại active gửi tự do', () => {
    expect(sendGate({ state: 'pending', iAmInitiator: false, lastSeq: 1, kind: 'image' })).toBe('ok');
    expect(sendGate({ state: 'declined', iAmInitiator: false, lastSeq: 1, kind: 'text' })).toBe('ok');
    expect(sendGate({ state: 'active', iAmInitiator: true, lastSeq: 9, kind: 'image' })).toBe('ok');
  });
});

describe('visibleState', () => {
  it('người khởi tạo không thấy declined', () => {
    expect(visibleState('declined', true)).toBe('pending');
    expect(visibleState('declined', false)).toBe('declined');
    expect(visibleState('active', true)).toBe('active');
  });
});

describe('directKey', () => {
  it('không phụ thuộc thứ tự', () => {
    expect(directKey('b', 'a')).toBe(directKey('a', 'b'));
    expect(directKey('a', 'b')).toBe('a:b');
  });
});

describe('cleanMessage (BR-02)', () => {
  it('bỏ thẻ HTML và ký tự điều khiển', () => {
    expect(cleanMessage('  <img src=x onerror=alert(1)>xin chào\u0000  ')).toBe('xin chào');
    expect(cleanMessage('<script>x</script>ok')).toBe('xok');
  });
  it('chuẩn hóa NFC và giữ xuống dòng', () => {
    expect(cleanMessage('é\nb')).toBe('é\nb');
  });
  it('rỗng sau khi làm sạch', () => {
    expect(cleanMessage('   ​ ')).toBe('');
  });
  it('bỏ ký tự đảo chiều văn bản', () => {
    expect(cleanMessage('a‮b')).toBe('ab');
  });
});

describe('preview và excerpt', () => {
  it('ảnh, bài chia sẻ, chữ', () => {
    expect(previewFor('image', '')).toBe('Đã gửi ảnh');
    expect(previewFor('post_share', '')).toBe('Đã gửi một bài viết');
    expect(previewFor('text', 'a  b\nc')).toBe('a b c');
  });
  it('cắt bằng dấu chấm lửng theo ký tự', () => {
    expect(Array.from(excerpt('x'.repeat(300))).length).toBe(120);
    expect(excerpt('x'.repeat(300)).endsWith('…')).toBe(true);
  });
});

describe('cursor', () => {
  it('đọc lại đúng và từ chối rác', () => {
    const cursor = writeCursor(['2026-11-02T00:00:00.000Z', 'abc']);
    expect(readCursor(cursor, 2)).toEqual(['2026-11-02T00:00:00.000Z', 'abc']);
    expect(readCursor('###', 2)).toBeNull();
    expect(readCursor(cursor, 3)).toBeNull();
    expect(readCursor(undefined, 2)).toBeNull();
  });
});

describe('ảnh', () => {
  it('đọc kích thước PNG', () => {
    const bytes = Buffer.alloc(32);
    Buffer.from([0x89, 0x50, 0x4e, 0x47]).copy(bytes);
    bytes.writeUInt32BE(640, 16);
    bytes.writeUInt32BE(480, 20);
    expect(pngSize(bytes)).toEqual({ width: 640, height: 480 });
    expect(pngSize(Buffer.alloc(32))).toBeNull();
  });
  it('giới hạn điểm ảnh', () => {
    expect(pixelsOk(4000, 3000)).toBe(true);
    expect(pixelsOk(8000, 8000)).toBe(false);
    expect(pixelsOk(9000, 10)).toBe(false);
    expect(pixelsOk(0, 10)).toBe(false);
  });
});

describe('escapeLike', () => {
  it('vô hiệu ký tự đại diện', () => {
    expect(escapeLike('50%_a\\')).toBe('50\\%\\_a\\\\');
  });
});
