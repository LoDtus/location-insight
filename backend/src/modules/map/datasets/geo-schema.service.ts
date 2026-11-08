import { HttpStatus, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BusinessException } from '../../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../../shared/constants/error-code.constant.js';
import { GEO_MIGRATIONS } from './geo-migrations.js';

/** Khóa advisory của tiến trình migration `geo` (một số cố định, không phụ thuộc dữ liệu người dùng). */
const MIGRATION_LOCK_KEY = 180_001;

/**
 * Chạy migration SQL của `geo` lúc khởi động, có khóa advisory để nhiều instance không chạy chồng.
 * Không làm sập ứng dụng khi thiếu PostGIS: các chức năng dữ liệu nền trả lỗi rõ ràng, phần còn lại vẫn chạy.
 */
@Injectable()
export class GeoSchemaService implements OnModuleInit {
  private readonly logger = new Logger(GeoSchemaService.name);
  private readyPromise: Promise<boolean> | null = null;

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.ensure();
  }

  /** Chạy migration một lần cho mỗi tiến trình; trả về `false` nếu `geo` không dùng được. */
  ensure(): Promise<boolean> {
    this.readyPromise ??= this.migrate();
    return this.readyPromise;
  }

  async assertReady(): Promise<void> {
    if (await this.ensure()) return;
    throw new BusinessException(
      ErrorCode.SERVICE_UNAVAILABLE,
      'Database chưa sẵn sàng cho dữ liệu nền (cần PostGIS, image postgis/postgis). Xem log backend.',
      { code: 'GEO_UNAVAILABLE' },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private async migrate(): Promise<boolean> {
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
      try {
        await runner.query('CREATE SCHEMA IF NOT EXISTS geo');
        await runner.query(
          'CREATE TABLE IF NOT EXISTS geo.schema_migrations (id varchar(80) PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
        );
        const rows = (await runner.query('SELECT id FROM geo.schema_migrations')) as Array<{ id: string }>;
        const applied = new Set(rows.map((row) => row.id));
        for (const migration of GEO_MIGRATIONS) {
          if (applied.has(migration.id)) continue;
          await runner.startTransaction();
          try {
            await runner.query(migration.sql);
            await runner.query('INSERT INTO geo.schema_migrations (id) VALUES ($1)', [migration.id]);
            await runner.commitTransaction();
            this.logger.log(`Đã chạy migration geo ${migration.id}`);
          } catch (error) {
            await runner.rollbackTransaction();
            throw error;
          }
        }
      } finally {
        await runner.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
      }
      return true;
    } catch (error) {
      this.logger.error(
        `Không chạy được migration geo: ${error instanceof Error ? error.message : String(error)}. ` +
          'Kiểm tra image Postgres có PostGIS (postgis/postgis:17) và quyền CREATE EXTENSION.',
      );
      return false;
    } finally {
      await runner.release();
    }
  }
}
