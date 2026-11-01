const TAG = /<[^>]*>/g;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​-‏‪-‮⁦-⁩]/g;

/** Làm sạch tin: NFC, bỏ ký tự điều khiển và định hướng, bỏ thẻ HTML, cắt khoảng trắng đầu cuối (BR-02). */
export function cleanMessage(value: string): string {
  return value
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL, '')
    .replace(TAG, '')
    .replace(/[<>]/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

export function cleanLine(value: string): string {
  return cleanMessage(value).replace(/\s+/g, ' ');
}
