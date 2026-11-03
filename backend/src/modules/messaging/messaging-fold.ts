/**
 * Bỏ dấu tiếng Việt để tìm "gõ không dấu" ngay trong PostgreSQL mà không cần extension `unaccent`.
 * Cùng một bảng ánh xạ dùng cho `translate()` ở SQL và cho hàm JS, nên hai bên luôn khớp nhau và
 * (vì ánh xạ 1 ký tự → 1 ký tự) vị trí khớp trong chuỗi đã bỏ dấu cũng là vị trí trong chuỗi gốc.
 * Cũng đổi chữ hoa sang chữ thường để không phụ thuộc locale của database (`lower()`).
 */
const GROUPS: ReadonlyArray<readonly [string, string]> = [
  ['a', 'àáạảãâầấậẩẫăằắặẳẵ'],
  ['e', 'èéẹẻẽêềếệểễ'],
  ['i', 'ìíịỉĩ'],
  ['o', 'òóọỏõôồốộổỗơờớợởỡ'],
  ['u', 'ùúụủũưừứựửữ'],
  ['y', 'ỳýỵỷỹ'],
  ['d', 'đ'],
];

const UPPER_ASCII = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER_ASCII = 'abcdefghijklmnopqrstuvwxyz';

const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ...GROUPS.flatMap(([base, chars]) =>
    Array.from(chars).flatMap((char): Array<readonly [string, string]> => [
      [char, base],
      [char.toUpperCase(), base],
    ]),
  ),
  ...Array.from(UPPER_ASCII).map((char, index): readonly [string, string] => [
    char,
    LOWER_ASCII[index] as string,
  ]),
];

const MAP = new Map<string, string>(PAIRS);

/** Hai chuỗi cùng độ dài cho `translate(cột, from, to)`. */
export const FOLD_FROM = PAIRS.map(([from]) => from).join('');
export const FOLD_TO = PAIRS.map(([, to]) => to).join('');

export function foldVietnamese(text: string): string {
  return Array.from(text.normalize('NFC'))
    .map((char) => MAP.get(char) ?? char)
    .join('');
}

/** Điều kiện SQL khớp không dấu, không phân biệt hoa thường: dùng với `:from`, `:to`, `:pattern`. */
export const FOLDED_BODY_SQL =
  "translate(m.body, :foldFrom, :foldTo) LIKE :pattern ESCAPE '\\'";

/** Cắt một đoạn quanh vị trí khớp đầu tiên (đã bỏ dấu nên vị trí trùng với chuỗi gốc). */
export function snippetAround(
  body: string,
  query: string,
  radius = 48,
): string {
  const clean = body.replace(/\s+/g, ' ').trim();
  const at = foldVietnamese(clean).indexOf(foldVietnamese(query));
  if (at < 0 || clean.length <= radius * 2) return clean.slice(0, radius * 2);
  const start = Math.max(0, at - radius);
  const end = Math.min(clean.length, at + query.length + radius);
  return `${start > 0 ? '…' : ''}${clean.slice(start, end)}${end < clean.length ? '…' : ''}`;
}
