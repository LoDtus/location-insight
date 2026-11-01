import sanitizeHtml from 'sanitize-html';
import { allVariables, TemplateDefinition } from './email.catalog.js';

const VAR = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;
const ANY_BRACES = /\{\{[^}]*\}\}/g;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Tên biến xuất hiện trong chuỗi (kể cả cú pháp sai như `{{ a b }}`, trả về token thô). */
export function usedVariables(source: string): { valid: string[]; invalid: string[] } {
  const valid = new Set<string>();
  const invalid: string[] = [];
  for (const token of source.match(ANY_BRACES) ?? []) {
    const m = /^\{\{\s*([a-z][a-z0-9_]*)\s*\}\}$/.exec(token);
    if (m) valid.add(m[1]);
    else invalid.push(token);
  }
  return { valid: [...valid], invalid };
}

/** Trả về danh sách biến không thuộc danh mục (rỗng = hợp lệ). */
export function unknownVariables(def: TemplateDefinition, sources: string[]): string[] {
  const known = new Set(allVariables(def).map((v) => v.name));
  const bad = new Set<string>();
  for (const source of sources) {
    const { valid, invalid } = usedVariables(source);
    for (const name of valid) if (!known.has(name)) bad.add(`{{${name}}}`);
    for (const token of invalid) bad.add(token);
  }
  return [...bad];
}

export function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Thay biến. `html`: escape HTML; biến URL không hợp lệ → chuỗi rỗng. */
export function substitute(
  source: string,
  def: TemplateDefinition,
  values: Record<string, string>,
  mode: 'html' | 'text',
): string {
  const kinds = new Map(allVariables(def).map((v) => [v.name, v.kind ?? 'text']));
  return source.replace(VAR, (_all, name: string) => {
    const raw = values[name] ?? '';
    const value = kinds.get(name) === 'url' ? (safeUrl(raw) ?? '') : raw;
    return mode === 'html' ? escapeHtml(value) : value.replace(/\r/g, '');
  });
}

/** Tiêu đề: một dòng, bỏ ký tự điều khiển (chống chèn header). */
export function cleanSubject(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

const ALLOWED_STYLES = {
  '*': {
    color: [/^#[0-9a-f]{3,8}$/i, /^[a-z]+$/i, /^rgba?\([\d\s,.%]+\)$/i],
    'background-color': [/^#[0-9a-f]{3,8}$/i, /^[a-z]+$/i, /^rgba?\([\d\s,.%]+\)$/i],
    'font-size': [/^\d+(\.\d+)?(px|em|rem|%)$/],
    'font-weight': [/^(normal|bold|[1-9]00)$/],
    'text-align': [/^(left|right|center)$/],
    'text-decoration': [/^(none|underline)$/],
    'line-height': [/^\d+(\.\d+)?(px|em|%)?$/],
    padding: [/^[\d\s.]+(px|em)?( [\d.]+(px|em)?){0,3}$/],
    margin: [/^[\d\s.]+(px|em|auto)?( [\d.]+(px|em|auto)?){0,3}$/],
    'border-radius': [/^\d+(px|%)$/],
    border: [/^[\w\s#.%(),-]+$/],
    'border-left': [/^[\w\s#.%(),-]+$/],
    display: [/^(inline-block|block)$/],
    width: [/^\d+(px|%)$/],
  },
};

/**
 * Lọc HTML của mẫu (do admin soạn). Không script/form/iframe/img/`on*`/`javascript:`.
 * `href` chỉ https/http/mailto hoặc biến `{{...}}` (không có scheme thì giữ nguyên để thay sau).
 */
export function sanitizeTemplateHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li',
      'a', 'span', 'div', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'small', 'code',
    ],
    allowedAttributes: {
      a: ['href', 'style', 'title'],
      '*': ['style'],
      td: ['style', 'colspan', 'rowspan', 'align'],
      th: ['style', 'colspan', 'rowspan', 'align'],
      table: ['style', 'width', 'cellpadding', 'cellspacing', 'border', 'align'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href'],
    allowProtocolRelative: false,
    allowedStyles: ALLOWED_STYLES,
    disallowedTagsMode: 'discard',
  });
}

/** Bản văn bản tự sinh từ HTML. */
export function htmlToText(html: string): string {
  const withLinks = html.replace(/<a\s[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gis, (_m, href: string, label: string) => {
    const text = label.replace(/<[^>]*>/g, '').trim();
    return text && text !== href ? `${text} (${href})` : href;
  });
  const text = sanitizeHtml(
    withLinks.replace(/<\/(p|div|h[1-4]|li|tr|blockquote)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n'),
    { allowedTags: [], allowedAttributes: {} },
  );
  return decodeEntities(text).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export interface LayoutInput {
  appName: string;
  appUrl: string;
  supportEmail: string;
  content: string;
  unsubscribeUrl: string | null;
  preheader?: string;
}

/** Khung chung (bảng 600px, CSS inline) — nằm trong mã, admin không sửa. */
export function wrapLayout(input: LayoutInput): string {
  const unsub = input.unsubscribeUrl
    ? `<p style="margin:8px 0 0;"><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Hủy nhận loại email này</a></p>`
    : '';
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(input.appName)}</title></head><body style="margin:0;padding:0;background-color:#f6f3ec;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f3ec;"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:12px;"><tr><td style="padding:20px 28px;border-bottom:1px solid #eee;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:#1f6f50;"><a href="${escapeHtml(input.appUrl)}" style="color:#1f6f50;text-decoration:none;">${escapeHtml(input.appName)}</a></td></tr><tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;">${input.content}</td></tr><tr><td style="padding:16px 28px 24px;border-top:1px solid #eee;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#6b7280;">Cần hỗ trợ? Liên hệ ${escapeHtml(input.supportEmail)}.${unsub}</td></tr></table></td></tr></table></body></html>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderEmail(args: {
  def: TemplateDefinition;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  values: Record<string, string>;
  unsubscribeUrl: string | null;
}): RenderedEmail {
  const { def, values } = args;
  const subject = cleanSubject(substitute(args.subject, def, values, 'text'));
  const content = substitute(args.bodyHtml, def, values, 'html');
  const html = wrapLayout({
    appName: values.app_name ?? '',
    appUrl: safeUrl(values.app_url ?? '') ?? '',
    supportEmail: values.support_email ?? '',
    content,
    unsubscribeUrl: args.unsubscribeUrl,
  });
  const textSource = args.bodyText?.trim() ? args.bodyText : null;
  let text = textSource ? substitute(textSource, def, values, 'text') : htmlToText(content);
  if (args.unsubscribeUrl) text += `\n\nHủy nhận loại email này: ${args.unsubscribeUrl}`;
  return { subject, html, text };
}
