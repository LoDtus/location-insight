import { INestApplication } from '@nestjs/common';
import compression from 'compression';
import type { Request, Response } from 'express';
import { constants } from 'node:zlib';

/** Phản hồi nhỏ hơn ngưỡng này nén không đáng (header + CPU). */
export const COMPRESSION_THRESHOLD_BYTES = 1024;

/**
 * Không nén các đường có bí mật trong thân phản hồi (access token, mã OTP…). Nén thân phản hồi vừa chứa bí mật vừa
 * phản chiếu dữ liệu người gửi lên cho phép đoán bí mật qua độ dài gói nén (tấn công kiểu BREACH).
 */
const SECRET_PATH = /\/auth(\/|$)/;

export function shouldCompress(req: Request, res: Response): boolean {
  if (SECRET_PATH.test(req.path)) return false;
  // Route tự gửi tệp đã nén sẵn (ảnh, video…) hoặc yêu cầu không nén.
  if (req.headers['x-no-compression']) return false;
  return compression.filter(req, res);
}

/**
 * Nén phản hồi gzip/brotli (JSON giảm 5–6 lần; xem workspace/docs/references/json-vs-binary-serialization.md).
 * Brotli mức 4 và gzip mức 6: cân bằng CPU và dung lượng cho phản hồi động.
 */
export const configureCompression = (app: INestApplication): void => {
  app.use(
    compression({
      threshold: COMPRESSION_THRESHOLD_BYTES,
      level: 6,
      brotli: { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } },
      filter: shouldCompress,
    }),
  );
};
