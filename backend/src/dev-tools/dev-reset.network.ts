/**
 * Kiểm tra địa chỉ "cục bộ/mạng nội bộ" cho công cụ reset môi trường dev.
 * Hàm thuần, không phụ thuộc Nest, để kiểm thử dễ và dùng được ở nhiều lớp phòng thủ.
 */

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function parseIpv4(value: string): [number, number, number, number] | null {
  const match = IPV4.exec(value);
  if (!match) return null;
  const parts = match.slice(1, 5).map(Number);
  if (parts.some((part) => part < 0 || part > 255)) return null;
  return parts as [number, number, number, number];
}

/** IP loopback hoặc riêng tư (RFC 1918, link-local, ULA IPv6). Không hợp lệ thì trả false. */
export function isPrivateOrLoopbackIp(raw: string | undefined): boolean {
  if (!raw) return false;
  let ip = raw.trim().toLowerCase();
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1);
  if (ip.startsWith('::ffff:')) ip = ip.slice('::ffff:'.length);

  const v4 = parseIpv4(ip);
  if (v4) {
    const [a, b] = v4;
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    );
  }
  if (ip === '::1') return true;
  if (!ip.includes(':')) return false;
  const first = ip.split(':')[0] ?? '';
  const head = Number.parseInt(first || '0', 16);
  if (Number.isNaN(head)) return false;
  return (head & 0xfe00) === 0xfc00 || (head & 0xffc0) === 0xfe80;
}

/** Tên host dạng dịch vụ Docker (không có dấu chấm), vd `postgres`. */
function isBareServiceName(host: string): boolean {
  return /^[a-z][a-z0-9_-]{0,62}$/.test(host);
}

/**
 * Host của cơ sở dữ liệu có phải máy cục bộ/mạng nội bộ không.
 * Tên miền công khai (vd `db.example.com`, `xxx.rds.amazonaws.com`) bị từ chối.
 */
export function isLocalDatabaseHost(raw: string | undefined): boolean {
  if (!raw) return false;
  const host = raw.trim().toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host === 'host.docker.internal') return true;
  if (isPrivateOrLoopbackIp(host)) return true;
  return isBareServiceName(host);
}

/** Danh sách IP trong `X-Forwarded-For` (rỗng nếu không có). */
export function forwardedIps(header: string | string[] | undefined): string[] {
  const value = Array.isArray(header) ? header.join(',') : (header ?? '');
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
