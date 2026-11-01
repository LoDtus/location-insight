import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly presignClient: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    const endpoint = config.getOrThrow<string>('S3_ENDPOINT');
    const credentials = {
      accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
      secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
    };
    const region = config.get<string>('S3_REGION') || 'us-east-1';
    const forcePathStyle = config.get<string>('S3_FORCE_PATH_STYLE') !== 'false';
    this.client = this.makeClient(endpoint, region, forcePathStyle, credentials);
    this.presignClient = this.makeClient(
      publicEndpoint(endpoint, config.get<string>('S3_PUBLIC_ENDPOINT')),
      region,
      forcePathStyle,
      credentials,
    );
  }

  async onModuleInit(): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      try {
        await this.ensureBucket();
        await this.ensureCors();
        this.logger.log(`MinIO bucket "${this.bucket}" is ready`);
        return;
      } catch (error) {
        lastError = error;
        this.logger.warn(`MinIO chưa sẵn sàng (${attempt}/10)`);
        await delay(3000);
      }
    }

    throw lastError;
  }

  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  async putObject(
    key: string,
    body: Buffer | Uint8Array | string,
    contentType?: string,
  ): Promise<{ bucket: string; key: string }> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return { bucket: this.bucket, key };
  }

  async getObject(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await response.Body?.transformToByteArray();
    return Buffer.from(bytes ?? []);
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async objectSize(key: string): Promise<number | null> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return response.ContentLength ?? null;
    } catch {
      return null;
    }
  }

  async getObjectRange(key: string, bytes: number): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
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
    expiresInSeconds = 600,
  ): Promise<string> {
    return getSignedUrl(
      this.presignClient,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async getPresignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    return getSignedUrl(
      this.presignClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  private makeClient(
    endpoint: string,
    region: string,
    forcePathStyle: boolean,
    credentials: { accessKeyId: string; secretAccessKey: string },
  ): S3Client {
    return new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  private async ensureCors(): Promise<void> {
    try {
      await this.client.send(
        new PutBucketCorsCommand({
          Bucket: this.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'PUT', 'HEAD'],
                AllowedOrigins: [
                  'http://127.0.0.1:22360',
                  'http://localhost:22360',
                ],
                ExposeHeaders: ['ETag'],
                MaxAgeSeconds: 3000,
              },
            ],
          },
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Chưa đặt được CORS cho bucket: ${error instanceof Error ? error.message : 'lỗi không rõ'}`,
      );
    }
  }

  private async ensureBucket(): Promise<void> {
    try {
      await this.ping();
    } catch (error) {
      if (!isMissingBucket(error)) throw error;
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }
}

function isMissingBucket(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'NotFound' || error.name === 'NoSuchBucket';
}

function publicEndpoint(internal: string, configured?: string): string {
  if (configured) return configured;
  return internal.replace('://minio:9000', '://127.0.0.1:22374');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
