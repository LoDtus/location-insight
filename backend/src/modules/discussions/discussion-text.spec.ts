import { describe, expect, it } from 'vitest';
import { plainText, sniffMedia, stripMarkup } from './discussion-text.js';

describe('plainText', () => {
  it('bỏ thẻ và khoảng trắng', () => {
    expect(plainText('  <b>Hồ Tây</b>  ')).toBe('Hồ Tây');
    expect(plainText('<script>alert(1)</script>')).toBe('alert(1)');
    expect(plainText('   ')).toBe('');
  });

  it('giữ dấu trích dẫn đầu dòng, bỏ > ở chỗ khác', () => {
    expect(plainText('> câu trích\na > b')).toBe('> câu trích\na  b');
    expect(plainText('x\r\n> y')).toBe('x\n> y');
  });
});

describe('stripMarkup', () => {
  it('bỏ markup cho bản xem trước', () => {
    expect(stripMarkup('**đậm** *nghiêng* ++gạch chân++ ~~gạch~~ [Hồ Gươm](/map?c=1) \n> trích')).toBe(
      'đậm nghiêng gạch chân gạch Hồ Gươm trích',
    );
  });
});

describe('sniffMedia', () => {
  it('nhận jpeg và từ chối tệp lệch loại', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    expect(sniffMedia(jpeg, 'image/jpeg')).toBe(true);
    expect(sniffMedia(jpeg, 'image/png')).toBe(false);
  });

  it('nhận mp4 khi có ftyp', () => {
    const mp4 = Buffer.alloc(12);
    mp4.write('ftyp', 4, 'ascii');
    expect(sniffMedia(mp4, 'video/mp4')).toBe(true);
  });
});
