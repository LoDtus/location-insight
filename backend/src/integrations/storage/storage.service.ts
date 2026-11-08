import {
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ConfigService } from '@nestjs/config';
import {
  MAX_BATCH_DELETE,
  MAX_GET_URL_TTL_SECONDS,
  MAX_PUT_URL_TTL_SECONDS,
  StorageSettings,
  assertSafeKey,
  planSigning,
  resolveStorageSettings,
} from './storage.config.js';

export interface PresignPutOptions {
  /** Ký kèm Content-Length (cần thử trên MinIO/R2 trước khi dùng; xem 016-media-storage). */
  contentLength?: number;
}

export interface PresignGetOptions {
  responseContentType?: string;
  responseContentDisposition?: string;
  /** Làm tròn mốc ký để cùng URL trong một cửa sổ (cache trình duyệt). */
  signingWindowSeconds?: number;
}

export interface ListedObjects {
  keys: string[];
  nextCursor: string | null;
}

/**
 * Cổng duy nhất tới kho đối tượng S3 (MinIO, Cloudflare R2, ...).
 * Chỉ dùng tập con S3 chạy được trên mọi nhà cung cấp; xem workspace/features/016-media-storage.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly settings: StorageSettings;
  private readonly client: S3Client;
  private readonly presignClient: S3Client;

  constructor(config: ConfigService) {
    this.settings = resolveStorageSettings((name) => config.get<string>(name));
    this.client = this.makeClient(this.settings.endpoint);
    this.presignClient = this.makeClient(this.settings.publicEndpoint);
  }

  async onModuleInit(): Promise<void> {
    const { bucket, autoCreateBucket } = this.settings;
    let lastError: unknown;

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      try {
        if (autoCreateBucket) {
          await this.ensureBucket();
          await this.ensureCors();
        } else {
          await this.ping();
        }
        this.logger.log(`Kho đối tượng sẵn sàng (bucket "${bucket}")`);
        return;
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Kho đối tượng chưa sẵn sàng (${attempt}/10): ${errorName(error)}`,
        );
        await delay(3000);
      }
    }

    if (!autoCreateBucket) {
      this.logger.error(
        `Không truy cập được bucket "${bucket}". Production không tự tạo bucket: tạo bucket và CORS trước (xem 016-media-storage/configuration.md).`,
      );
    }
    throw lastError;
  }

  async ping(): Promise<void> {
    await this.client.send(
      new HeadBucketCommand({ Bucket: this.settings.bucket }),
    );
  }

  async putObject(
    key: string,
    body: Buffer | Uint8Array | string,
    contentType?: string,
  ): Promise<{ bucket: string; key: string }> {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.settings.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return { bucket: this.settings.bucket, key };
  }

  /** Đẩy một tệp trên đĩa lên kho theo stream (không nạp cả tệp vào bộ nhớ). */
  async putObjectFromFile(
    key: string,
    filePath: string,
    sizeBytes: number,
    contentType: string,
  ): Promise<void> {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.settings.bucket,
        Key: key,
        Body: createReadStream(filePath),
        ContentLength: sizeBytes,
        ContentType: contentType,
      }),
    );
  }

  /** Tải một đối tượng về tệp trên đĩa theo stream. Tệp đích phải chưa tồn tại. */
  async downloadObjectToFile(key: string, filePath: string): Promise<void> {
    assertSafeKey(key);
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.settings.bucket, Key: key }),
    );
    if (!(response.Body instanceof Readable)) {
      throw new Error('Kho đối tượng không trả về stream');
    }
    await pipeline(
      response.Body,
      createWriteStream(filePath, { flags: 'wx', mode: 0o600 }),
    );
  }

  async getObject(key: string): Promise<Buffer> {
    assertSafeKey(key);
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.settings.bucket, Key: key }),
    );
    const bytes = await response.Body?.transformToByteArray();
    return Buffer.from(bytes ?? []);
  }

  async deleteObject(key: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.settings.bucket, Key: key }),
    );
  }

  /** Xóa theo lô (≤ 1000 mỗi yêu cầu). Trả về các khóa xóa thất bại để người gọi ghi nhật ký/thử lại. */
  async deleteObjects(keys: string[]): Promise<string[]> {
    keys.forEach(assertSafeKey);
    const failed: string[] = [];
    for (let start = 0; start < keys.length; start += MAX_BATCH_DELETE) {
      const batch = keys.slice(start, start + MAX_BATCH_DELETE);
      const response = await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.settings.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      for (const item of response.Errors ?? []) {
        if (item.Key) failed.push(item.Key);
      }
    }
    return failed;
  }

  async listByPrefix(
    prefix: string,
    cursor?: string,
    limit = 1000,
  ): Promise<ListedObjects> {
    if (prefix !== '') assertSafeKey(prefix);
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.settings.bucket,
        Prefix: prefix,
        ContinuationToken: cursor,
        MaxKeys: Math.min(Math.max(limit, 1), 1000),
      }),
    );
    return {
      keys: (response.Contents ?? []).flatMap((item) =>
        item.Key ? [item.Key] : [],
      ),
      nextCursor: response.IsTruncated
        ? (response.NextContinuationToken ?? null)
        : null,
    };
  }

  async objectSize(key: string): Promise<number | null> {
    assertSafeKey(key);
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.settings.bucket, Key: key }),
      );
      return response.ContentLength ?? null;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async getObjectRange(key: string, bytes: number): Promise<Buffer> {
    assertSafeKey(key);
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.settings.bucket,
        Key: key,
        Range: `bytes=0-${Math.max(bytes, 1) - 1}`,
      }),
    );
    const data = await response.Body?.transformToByteArray();
    return Buffer.from(data ?? []);
  }

  async getPresignedPutUrl(
    key: string,
    contentType: string,
    expiresInSeconds = MAX_PUT_URL_TTL_SECONDS,
    options: PresignPutOptions = {},
  ): Promise<string> {
    assertSafeKey(key);
    const plan = planSigning(
      expiresInSeconds,
      MAX_PUT_URL_TTL_SECONDS,
      Date.now(),
    );
    return getSignedUrl(
      this.presignClient,
      new PutObjectCommand({
        Bucket: this.settings.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: options.contentLength,
      }),
      {
        expiresIn: plan.expiresIn,
        // Mặc định SDK không ký Content-Type nên nhà cung cấp không ép; phải ký tường minh.
        signableHeaders: new Set(['content-type']),
      },
    );
  }

  async getPresignedUrl(
    key: string,
    expiresInSeconds = 900,
    options: PresignGetOptions = {},
  ): Promise<string> {
    assertSafeKey(key);
    const plan = planSigning(
      expiresInSeconds,
      MAX_GET_URL_TTL_SECONDS,
      Date.now(),
      options.signingWindowSeconds,
    );
    return getSignedUrl(
      this.presignClient,
      new GetObjectCommand({
        Bucket: this.settings.bucket,
        Key: key,
        ResponseContentType: options.responseContentType,
        ResponseContentDisposition: options.responseContentDisposition,
      }),
      { expiresIn: plan.expiresIn, signingDate: plan.signingDate },
    );
  }

  private makeClient(endpoint: string): S3Client {
    return new S3Client({
      region: this.settings.region,
      endpoint,
      forcePathStyle: this.settings.forcePathStyle,
      credentials: {
        accessKeyId: this.settings.accessKeyId,
        secretAccessKey: this.settings.secretAccessKey,
      },
      // R2 và một số nhà cung cấp không chấp nhận checksum mặc định mới của SDK.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      maxAttempts: 3,
      requestHandler: {
        connectionTimeout: this.settings.requestTimeoutMs,
        requestTimeout: this.settings.requestTimeoutMs,
      },
    });
  }

  private async ensureCors(): Promise<void> {
    const { bucket, corsOrigins } = this.settings;
    if (corsOrigins.length === 0) {
      this.logger.warn(
        'Chưa có origin nào cho CORS của bucket (S3_CORS_ORIGINS / CORS_ORIGINS)',
      );
      return;
    }
    try {
      await this.client.send(
        new PutBucketCorsCommand({
          Bucket: bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'PUT', 'HEAD'],
                AllowedOrigins: corsOrigins,
                ExposeHeaders: ['ETag'],
                MaxAgeSeconds: 3000,
              },
            ],
          },
        }),
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'NotImplemented') {
        // MinIO bỏ qua CORS theo bucket; CORS của MinIO đặt ở mức máy chủ (MINIO_API_CORS_ALLOW_ORIGIN).
        this.logger.log('Nhà cung cấp không hỗ trợ CORS theo bucket, bỏ qua');
        return;
      }
      this.logger.warn(`Chưa đặt được CORS cho bucket: ${errorName(error)}`);
    }
  }

  private async ensureBucket(): Promise<void> {
    try {
      await this.ping();
    } catch (error) {
      if (!isNotFound(error)) throw error;
      await this.client.send(
        new CreateBucketCommand({ Bucket: this.settings.bucket }),
      );
    }
  }
}

function isNotFound(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'NotFound' ||
    error.name === 'NoSuchBucket' ||
    error.name === 'NoSuchKey'
  );
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'lỗi không rõ';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
