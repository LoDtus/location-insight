import { describe, expect, it } from 'vitest';
import { allowedPushEndpoint, keyByteLength, plain, safeLink, topicOf } from './notification.rules.js';

describe('đường dẫn thông báo', () => {
  it('chỉ nhận đường dẫn trong ứng dụng', () => {
    expect(safeLink('/app/feed/abc')).toBe('/app/feed/abc');
    expect(safeLink('/app/profile/@lan-anh')).toBe('/app/profile/@lan-anh');
    expect(safeLink('/admin/messaging')).toBe('/admin/messaging');
    expect(safeLink('https://evil.example/app/feed')).toBeNull();
    expect(safeLink('/bai-viet/tin')).toBeNull();
    expect(safeLink('/app/../admin')).toBeNull();
  });

  it('làm sạch tên và rút gọn chủ đề push', () => {
    expect(plain('An\u0007  B', 10)).toBe('An B');
    expect(topicOf('follow.new')).toBe('follow-new');
    expect(allowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(allowedPushEndpoint('http://fcm.googleapis.com/x')).toBe(false);
    expect(keyByteLength(Buffer.alloc(65).toString('base64url'))).toBe(65);
  });
});
