const TAG = /<[^>]*>/g;

/**
 * Bỏ thẻ HTML và ký tự `<`. Giữ `>` chỉ khi là dấu trích dẫn đầu dòng (`> `) của markup nhẹ; `>` ở chỗ khác bị bỏ.
 * Nội dung luôn hiển thị qua React (đã thoát ký tự), đây là lớp phòng thủ thêm.
 */
export function plainText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(TAG, '')
    .replace(/</g, '')
    .split('\n')
    .map((line) => {
      const quote = /^\s*> /.test(line);
      const rest = (quote ? line.replace(/^\s*> /, '') : line).replace(/>/g, '');
      return quote ? `> ${rest}` : rest;
    })
    .join('\n')
    .trim();
}

/** Bỏ markup nhẹ để làm bản xem trước (thông báo, chỉ mục tìm kiếm). */
export function stripMarkup(value: string): string {
  return value
    .replace(/\[([^\]\n]+)\]\((?:https?:\/\/|\/)[^)\s]+\)/g, '$1')
    .replace(/(\*\*|\+\+|~~)(.+?)\1/g, '$2')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^> /gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sniffMedia(bytes: Buffer, declared: string): boolean {
  if (declared === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (declared === 'image/png') {
    return bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  }
  if (declared === 'image/webp') {
    return (
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (declared === 'video/mp4') {
    return bytes.length >= 12 && bytes.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  return false;
}
