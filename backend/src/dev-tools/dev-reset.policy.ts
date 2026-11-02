import { isLocalDatabaseHost } from './dev-reset.network.js';

export interface DevResetPolicy {
  allowed: boolean;
  problems: string[];
}

/** Các biến thường dùng để đánh dấu môi trường; giá trị này bị coi là "không phải dev". */
const ENVIRONMENT_VARIABLES = [
  'NODE_ENV',
  'APP_ENV',
  'ENVIRONMENT',
  'DEPLOY_ENV',
  'STAGE',
  'VERCEL_ENV',
] as const;

const NON_DEV_VALUES = new Set([
  'production',
  'prod',
  'staging',
  'stage',
  'preview',
  'live',
]);

const PRODUCTION_DATABASE_WORDS = /(prod|production|live|staging)/i;

export const DEV_RESET_TOKEN_MIN_LENGTH = 32;

/**
 * Điều kiện bắt buộc để công cụ reset được phép tồn tại. TẤT CẢ phải đúng.
 * Đây là lớp phòng thủ cuối cùng trong mã; lớp ngoài là: không nạp module khi sai điều kiện,
 * xóa thư mục `dev-tools` khỏi image production, và thoát ngay khi production bật cờ này.
 */
export function evaluateDevResetPolicy(env: NodeJS.ProcessEnv): DevResetPolicy {
  const problems: string[] = [];

  if (env.NODE_ENV !== 'development') {
    problems.push('NODE_ENV phải đúng bằng "development"');
  }
  for (const name of ENVIRONMENT_VARIABLES) {
    const value = env[name]?.trim().toLowerCase();
    if (value && NON_DEV_VALUES.has(value)) {
      problems.push(`${name}=${value} không phải môi trường dev`);
    }
  }
  if (env.DEV_RESET_ENABLED !== 'true') {
    problems.push('DEV_RESET_ENABLED phải bằng "true"');
  }
  if ((env.DEV_RESET_TOKEN ?? '').length < DEV_RESET_TOKEN_MIN_LENGTH) {
    problems.push(
      `DEV_RESET_TOKEN thiếu hoặc ngắn hơn ${DEV_RESET_TOKEN_MIN_LENGTH} ký tự`,
    );
  }
  if (env.KUBERNETES_SERVICE_HOST) {
    problems.push('đang chạy trong Kubernetes');
  }
  if (env.TYPEORM_SYNCHRONIZE !== 'true') {
    problems.push('TYPEORM_SYNCHRONIZE phải bằng "true" (môi trường chưa dùng migration)');
  }
  if (!isLocalDatabaseHost(env.DATABASE_HOST)) {
    problems.push('DATABASE_HOST không phải máy cục bộ/mạng nội bộ');
  }
  if (PRODUCTION_DATABASE_WORDS.test(env.DATABASE_NAME ?? '')) {
    problems.push('DATABASE_NAME trông như cơ sở dữ liệu production/staging');
  }

  return { allowed: problems.length === 0, problems };
}
