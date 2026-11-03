import { describe, expect, it } from 'vitest';
import {
  attachmentDisposition,
  fileExtension,
  isFileType,
  isImageType,
  sanitizeFileName,
  sniffFile,
} from './messaging-files.js';

const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('loại tệp cho phép', () => {
  it('nhận ảnh và tài liệu, không nhận SVG, HTML, nén hay thực thi', () => {
    expect(isImageType('image/png')).toBe(true);
    expect(isFileType('application/pdf')).toBe(true);
    expect(isFileType(DOCX)).toBe(true);
    for (const type of [
      'image/svg+xml',
      'text/html',
      'application/zip',
      'application/x-msdownload',
      'application/javascript',
    ]) {
      expect(isFileType(type)).toBe(false);
      expect(isImageType(type)).toBe(false);
    }
  });

  it('không bị đánh lừa bởi thuộc tính của Object', () => {
    expect(isFileType('constructor')).toBe(false);
    expect(isFileType('toString')).toBe(false);
    expect(fileExtension('__proto__')).toBeNull();
  });

  it('đuôi tệp theo loại nội dung', () => {
    expect(fileExtension('application/pdf')).toBe('pdf');
    expect(fileExtension(DOCX)).toBe('docx');
    expect(fileExtension('text/csv')).toBe('csv');
  });
});

describe('sanitizeFileName', () => {
  it('bỏ đường dẫn và dấu chấm đầu tên', () => {
    expect(sanitizeFileName('../../etc/passwd.pdf', 'application/pdf')).toBe(
      'etc passwd.pdf',
    );
    expect(
      sanitizeFileName('C:\\Users\\a\\hợp đồng.pdf', 'application/pdf'),
    ).toBe('C Users a hợp đồng.pdf');
  });

  it('luôn kết thúc bằng đuôi của loại đã kiểm, không tin đuôi người dùng gõ', () => {
    expect(sanitizeFileName('bao cao.exe', 'application/pdf')).toBe(
      'bao cao.pdf',
    );
    expect(sanitizeFileName('bao cao', DOCX)).toBe('bao cao.docx');
    expect(sanitizeFileName('bảng giá.PDF', 'application/pdf')).toBe(
      'bảng giá.pdf',
    );
  });

  it('bỏ ký tự điều khiển, ký tự định hướng và ký tự cấm', () => {
    expect(sanitizeFileName('a\u0000b\u202ec"d<e>|f?.txt', 'text/plain')).toBe(
      'a b c d e f.txt',
    );
  });

  it('tên rỗng thì dùng tên mặc định; tên dài bị cắt nhưng giữ đuôi và không quá 120 ký tự', () => {
    expect(sanitizeFileName('   ', 'application/pdf')).toBe('tep.pdf');
    const long = sanitizeFileName(`${'x'.repeat(500)}.pdf`, 'application/pdf');
    expect(Array.from(long).length).toBeLessThanOrEqual(120);
    expect(long.endsWith('.pdf')).toBe(true);
  });

  it('chuẩn hóa NFC', () => {
    expect(
      sanitizeFileName('Hoàn Kiếm.txt'.normalize('NFD'), 'text/plain'),
    ).toBe('Hoàn Kiếm.txt');
  });
});

describe('sniffFile', () => {
  it('PDF phải bắt đầu bằng %PDF-', () => {
    expect(sniffFile(Buffer.from('%PDF-1.7\n...'), 'application/pdf')).toBe(
      true,
    );
    expect(sniffFile(Buffer.from('MZ\x90\x00'), 'application/pdf')).toBe(false);
  });

  it('tài liệu Office là vùng chứa zip (PK\\x03\\x04)', () => {
    expect(sniffFile(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14]), DOCX)).toBe(
      true,
    );
    expect(sniffFile(Buffer.from('<html><script>'), DOCX)).toBe(false);
  });

  it('văn bản: không có byte NUL và là UTF-8 hợp lệ', () => {
    expect(
      sniffFile(Buffer.from('Xin chào, đây là ghi chú'), 'text/plain'),
    ).toBe(true);
    expect(sniffFile(Buffer.from('a,b,c\n1,2,3\n'), 'text/csv')).toBe(true);
    expect(sniffFile(Buffer.from([0x61, 0x00, 0x62]), 'text/plain')).toBe(
      false,
    );
    expect(sniffFile(Buffer.from([0xff, 0xfe, 0xfd, 0xfc]), 'text/plain')).toBe(
      false,
    );
    expect(sniffFile(Buffer.alloc(0), 'text/plain')).toBe(false);
  });

  it('chấp nhận đầu tệp bị cắt giữa một ký tự nhiều byte', () => {
    const full = Buffer.from('Tiếng Việt: ế');
    expect(sniffFile(full.subarray(0, full.length - 1), 'text/plain')).toBe(
      true,
    );
  });

  it('loại không biết thì từ chối', () => {
    expect(sniffFile(Buffer.from('abc'), 'application/zip')).toBe(false);
  });
});

describe('attachmentDisposition', () => {
  it('buộc tải xuống, có tên UTF-8 và phương án ASCII', () => {
    const header = attachmentDisposition('Báo cáo tháng 10.pdf');
    expect(header.startsWith('attachment;')).toBe(true);
    expect(header).toContain(
      "filename*=UTF-8''B%C3%A1o%20c%C3%A1o%20th%C3%A1ng%2010.pdf",
    );
    expect(header).toContain('filename="B_o c_o th_ng 10.pdf"');
  });

  it('không cho chèn dấu nháy hay dấu gạch chéo ngược vào tiêu đề', () => {
    const header = attachmentDisposition('a"b\\c.pdf');
    expect(header).toContain('filename="a_b_c.pdf"');
    expect(header.match(/"/g)).toHaveLength(2);
  });
});
