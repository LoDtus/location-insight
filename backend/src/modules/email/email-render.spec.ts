import { describe, expect, it } from 'vitest';
import { findTemplate } from './email.catalog.js';
import {
  cleanSubject,
  htmlToText,
  renderEmail,
  sanitizeTemplateHtml,
  unknownVariables,
} from './email-render.js';

const def = findTemplate('verify_email')!;
const values = {
  app_name: 'Địa Thế',
  app_url: 'https://diathe.vn',
  support_email: 'support@diathe.vn',
  display_name: 'A <script>alert(1)</script>',
  verify_url: 'https://diathe.vn/auth/verify-email?token=abc&x=1',
  expires_minutes: '60',
};

describe('email-render', () => {
  it('escape biến trong HTML nhưng không trong văn bản', () => {
    const out = renderEmail({ def, ...def.defaults, subject: 'Hi {{display_name}}', bodyHtml: def.defaults.bodyHtml, bodyText: null, values, unsubscribeUrl: null });
    expect(out.html).not.toContain('<script>');
    expect(out.html).toContain('&lt;script&gt;');
  });

  it('biến URL không phải http(s) bị bỏ', () => {
    const out = renderEmail({ def, subject: 's', bodyHtml: '<a href="{{verify_url}}">x</a>', bodyText: 'u={{verify_url}}', values: { ...values, verify_url: 'javascript:alert(1)' }, unsubscribeUrl: null });
    expect(out.html).not.toContain('javascript:');
    expect(out.text).toBe('u=');
  });

  it('tiêu đề không chứa xuống dòng', () => {
    expect(cleanSubject('a\r\nBcc: x@y.z')).toBe('a Bcc: x@y.z');
    const out = renderEmail({ def, subject: 'Hi {{display_name}}', bodyHtml: 'x', bodyText: null, values: { ...values, display_name: 'a\r\nBcc: x@y.z' }, unsubscribeUrl: null });
    expect(out.subject).not.toMatch(/[\r\n]/);
  });

  it('phát hiện biến lạ và cú pháp sai', () => {
    expect(unknownVariables(def, ['{{display_name}} {{nope}}', '{{ a b }}'])).toEqual(['{{nope}}', '{{ a b }}']);
    expect(unknownVariables(def, ['{{display_name}} {{ verify_url }}'])).toEqual([]);
  });

  it('lọc script, on*, javascript:, iframe', () => {
    const dirty = '<p onclick="x()">a<script>1</script><iframe src="https://e"></iframe><a href="javascript:alert(1)" style="color:red;position:fixed">l</a><img src="https://t/p.gif"></p>';
    const clean = sanitizeTemplateHtml(dirty);
    expect(clean).not.toMatch(/script|onclick|iframe|javascript|position|<img/i);
    expect(clean).toContain('color:red');
  });

  it('giữ href là biến', () => {
    expect(sanitizeTemplateHtml('<a href="{{verify_url}}">x</a>')).toContain('href="{{verify_url}}"');
  });

  it('sinh văn bản từ HTML kèm liên kết', () => {
    expect(htmlToText('<p>Chào</p><p><a href="https://a.b/c">Bấm</a></p>')).toBe('Chào\nBấm (https://a.b/c)');
  });

  it('thêm liên kết hủy đăng ký vào cả HTML và văn bản', () => {
    const out = renderEmail({ def, subject: 's', bodyHtml: 'x', bodyText: null, values, unsubscribeUrl: 'https://diathe.vn/unsubscribe?u=1' });
    expect(out.html).toContain('Hủy nhận loại email này');
    expect(out.text).toContain('https://diathe.vn/unsubscribe?u=1');
  });
});
