export const MAX_OBJECT_KEY_BYTES = 512;
export const MAX_BATCH_DELETE = 1000;
export const MAX_PUT_URL_TTL_SECONDS = 600;
export const MAX_GET_URL_TTL_SECONDS = 3600;
const DEFAULT_REQUEST_TIMEOUT_MS = 5000;

export interface StorageSettings {
  bucket: string;
  endpoint: string;
  publicEndpoint: string;
  region: string;
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  autoCreateBucket: boolean;
  corsOrigins: string[];
  requestTimeoutMs: number;
}

type Reader = (name: string) => string | undefined;

export function resolveStorageSettings(read: Reader): StorageSettings {
  const required = (name: string): string => {
    const value = read(name)?.trim();
    if (!value) throw new Error(`Thiếu biến môi trường ${name}`);
    return value;
  };
  const isProduction = read('NODE_ENV') === 'production';
  const endpoint = required('S3_ENDPOINT');
  const publicEndpoint = read('S3_PUBLIC_ENDPOINT')?.trim() || '';
  if (isProduction && !publicEndpoint) {
    throw new Error(
      'Thiếu biến môi trường S3_PUBLIC_ENDPOINT (bắt buộc ở production)',
    );
  }

  return {
    bucket: required('S3_BUCKET'),
    endpoint,
    publicEndpoint: publicEndpoint || endpoint,
    region: read('S3_REGION')?.trim() || 'us-east-1',
    forcePathStyle: read('S3_FORCE_PATH_STYLE') !== 'false',
    accessKeyId: required('S3_ACCESS_KEY'),
    secretAccessKey: required('S3_SECRET_KEY'),
    autoCreateBucket: parseBoolean(
      read('S3_AUTO_CREATE_BUCKET'),
      !isProduction,
    ),
    corsOrigins: parseOrigins(read('S3_CORS_ORIGINS') || read('CORS_ORIGINS')),
    requestTimeoutMs: parsePositiveInt(
      read('S3_REQUEST_TIMEOUT_MS'),
      DEFAULT_REQUEST_TIMEOUT_MS,
    ),
  };
}

export function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '' && origin !== '*');
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fallback;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** Khóa luôn do server sinh; đây là lớp phòng thủ thứ hai (BR-03). */
export function assertSafeKey(key: string): void {
  const invalid =
    key === '' ||
    key.startsWith('/') ||
    key.includes('\\') ||
    key.split('/').some((part) => part === '..' || part === '.') ||
    Buffer.byteLength(key, 'utf8') > MAX_OBJECT_KEY_BYTES;
  if (invalid) throw new Error('Khóa đối tượng không hợp lệ');
}

export interface SigningPlan {
  signingDate: Date;
  expiresIn: number;
}

/**
 * Giới hạn thời hạn URL theo trần của loại URL. Nếu có `windowSeconds`, làm tròn
 * mốc ký xuống đầu cửa sổ để nhiều lần ký trong cùng cửa sổ ra cùng một URL
 * (trình duyệt dùng lại cache). URL còn hiệu lực từ `ttl` tới `ttl + window`.
 */
export function planSigning(
  ttlSeconds: number,
  maxTtlSeconds: number,
  nowMs: number,
  windowSeconds?: number,
): SigningPlan {
  const ttl = Math.min(Math.max(Math.floor(ttlSeconds), 1), maxTtlSeconds);
  if (!windowSeconds || windowSeconds <= 0) {
    return { signingDate: new Date(nowMs), expiresIn: ttl };
  }
  const windowMs = Math.floor(windowSeconds) * 1000;
  const start = Math.floor(nowMs / windowMs) * windowMs;
  return {
    signingDate: new Date(start),
    expiresIn: ttl + Math.floor(windowSeconds),
  };
}
