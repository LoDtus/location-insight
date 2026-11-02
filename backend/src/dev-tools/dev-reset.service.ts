import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import { evaluateDevResetPolicy } from './dev-reset.policy.js';
import { SEED_STEPS } from './dev-reset.seed-order.js';

export interface DevResetStepResult {
  name: string;
  ms: number;
}

export interface DevResetResult {
  database: string;
  durationMs: number;
  steps: DevResetStepResult[];
}

interface LifecycleHooks {
  onModuleInit?: () => Promise<void> | void;
  onApplicationBootstrap?: () => Promise<void> | void;
}

const COOLDOWN_MS = 10_000;

/** Xóa toàn bộ database (bảng, kiểu, chỉ mục), dựng lại từ entity, flush Redis rồi seed lại. */
@Injectable()
export class DevResetService {
  private readonly logger = new Logger(DevResetService.name);
  private running = false;
  private lastFinishedAt = 0;

  constructor(
    private readonly dataSource: DataSource,
    private readonly moduleRef: ModuleRef,
    private readonly config: ConfigService,
  ) {}

  async run(): Promise<DevResetResult> {
    const policy = evaluateDevResetPolicy(process.env);
    if (!policy.allowed) {
      throw new HttpException('Không tồn tại.', HttpStatus.NOT_FOUND);
    }
    if (this.running) {
      throw new HttpException('Đang reset.', HttpStatus.CONFLICT);
    }
    if (Date.now() - this.lastFinishedAt < COOLDOWN_MS) {
      throw new HttpException('Vui lòng đợi vài giây.', HttpStatus.TOO_MANY_REQUESTS);
    }

    this.running = true;
    const startedAt = Date.now();
    const steps: DevResetStepResult[] = [];
    const database = this.config.getOrThrow<string>('DATABASE_NAME');
    try {
      await this.assertConnectedDatabase(database);
      this.logger.warn(`RESET database "${database}" (chỉ môi trường dev)`);

      await this.step(steps, 'drop', () => this.dataSource.dropDatabase());
      await this.step(steps, 'schema', () => this.dataSource.synchronize());
      await this.step(steps, 'redis', () => this.flushRedis());
      for (const seed of SEED_STEPS) {
        await this.step(steps, `seed:${seed.name}`, () => this.runHook(seed.provider));
      }
      return { database, durationMs: Date.now() - startedAt, steps };
    } finally {
      this.running = false;
      this.lastFinishedAt = Date.now();
    }
  }

  /** Chỉ xóa khi database đang kết nối đúng với cấu hình (chặn trường hợp trỏ nhầm). */
  private async assertConnectedDatabase(expected: string): Promise<void> {
    const rows = (await this.dataSource.query('SELECT current_database() AS name')) as Array<{
      name: string;
    }>;
    if (rows[0]?.name !== expected) {
      throw new HttpException('Database không khớp cấu hình.', HttpStatus.CONFLICT);
    }
  }

  private async step(
    steps: DevResetStepResult[],
    name: string,
    action: () => Promise<unknown>,
  ): Promise<void> {
    const started = Date.now();
    try {
      await action();
    } catch (error) {
      this.logger.error(`Reset lỗi ở bước ${name}: ${error instanceof Error ? error.message : 'không rõ'}`);
      throw new HttpException(`Reset lỗi ở bước ${name}.`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    steps.push({ name, ms: Date.now() - started });
  }

  private async runHook(provider: (typeof SEED_STEPS)[number]['provider']): Promise<void> {
    const instance = this.moduleRef.get<LifecycleHooks>(provider as never, { strict: false });
    if (instance.onModuleInit) await instance.onModuleInit();
    if (instance.onApplicationBootstrap) await instance.onApplicationBootstrap();
  }

  /** Xóa phiên, bộ đệm và giới hạn tần suất còn trỏ tới người dùng cũ. Dùng kết nối riêng, không đụng mã production. */
  private async flushRedis(): Promise<void> {
    const client = new Redis({
      host: this.config.getOrThrow<string>('REDIS_HOST'),
      port: Number(this.config.getOrThrow<string>('REDIS_PORT')),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      maxRetriesPerRequest: 2,
      family: 4,
    });
    try {
      await client.flushdb();
    } finally {
      client.disconnect();
    }
  }
}
