import { describe, expect, it } from 'vitest';
import {
  FOLD_FROM,
  FOLD_TO,
  foldVietnamese,
  snippetAround,
} from './messaging-fold.js';

describe('bảng ánh xạ bỏ dấu', () => {
  it('hai chuỗi cho translate() cùng độ dài và không trùng ký tự nguồn', () => {
    const from = Array.from(FOLD_FROM);
    expect(from.length).toBe(Array.from(FOLD_TO).length);
    expect(new Set(from).size).toBe(from.length);
  });

  it('mọi ký tự nguồn là một đơn vị code (translate() làm việc theo ký tự)', () => {
    for (const char of Array.from(FOLD_FROM)) expect(char.length).toBe(1);
  });
});

describe('foldVietnamese', () => {
  it('bỏ dấu, đổi đ → d và hạ chữ thường', () => {
    expect(foldVietnamese('Hoàn Kiếm, ĐỒNG xuân')).toBe('hoan kiem, dong xuan');
    expect(foldVietnamese('Nguyễn Văn Cừ')).toBe('nguyen van cu');
    expect(foldVietnamese('Ở Đây ỔN')).toBe('o day on');
  });

  it('chấp nhận chuỗi Unicode dạng NFD', () => {
    expect(foldVietnamese('Hoàn Kiếm'.normalize('NFD'))).toBe('hoan kiem');
  });

  it('giữ nguyên chữ số, dấu câu và ký tự ngoài bảng', () => {
    expect(foldVietnamese('Tầng 3 – 12/10 😀')).toBe('tang 3 – 12/10 😀');
  });

  it('một ký tự vào, một ký tự ra: vị trí khớp không đổi', () => {
    const text = 'Đã gửi ảnh Hoàn Kiếm';
    expect(Array.from(foldVietnamese(text)).length).toBe(
      Array.from(text).length,
    );
  });
});

describe('snippetAround', () => {
  it('trả nguyên văn bản ngắn', () => {
    expect(snippetAround('Hẹn gặp ở đầu ngõ', 'dau ngo')).toBe(
      'Hẹn gặp ở đầu ngõ',
    );
  });

  it('cắt quanh vị trí khớp không dấu và thêm dấu chấm lửng hai đầu', () => {
    const body = `${'a'.repeat(120)} Hoàn Kiếm ${'b'.repeat(120)}`;
    const snippet = snippetAround(body, 'hoan kiem', 10);
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
    expect(snippet).toContain('Hoàn Kiếm');
  });
});
