import { describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import { shouldCompress } from './compression.config.js';

/** Đặc tả: workspace/docs/references/json-vs-binary-serialization.md (nén phản hồi, không nén đường có bí mật). */
function request(path: string, headers: Record<string, string> = {}): Request {
  return { path, headers: { 'accept-encoding': 'gzip, br', ...headers } } as unknown as Request;
}

function response(type: string): Response {
  return { getHeader: (name: string) => (name.toLowerCase() === 'content-type' ? type : undefined) } as unknown as Response;
}

describe('nén phản hồi', () => {
  it('nén JSON thường', () => {
    expect(shouldCompress(request('/api/v1/map/layers/places'), response('application/json; charset=utf-8'))).toBe(true);
  });

  it('không nén đường xác thực (có token trong thân phản hồi)', () => {
    expect(shouldCompress(request('/api/v1/auth/login'), response('application/json'))).toBe(false);
    expect(shouldCompress(request('/api/v1/auth'), response('application/json'))).toBe(false);
  });

  it('không nén khi được yêu cầu hoặc nội dung đã nén sẵn', () => {
    expect(shouldCompress(request('/api/v1/map/compare', { 'x-no-compression': '1' }), response('application/json'))).toBe(false);
    expect(shouldCompress(request('/api/v1/media/x'), response('image/jpeg'))).toBe(false);
  });
});
