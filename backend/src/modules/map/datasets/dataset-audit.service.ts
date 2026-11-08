import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AdminAuditLogEntity } from '../../rbac/entities/admin-audit-log.entity.js';

export interface DatasetActor {
  userId: string;
  sessionId: string | null;
  ip: string | null;
}

/** Nhật ký kiểm toán cho thao tác dữ liệu nền (threat model T4). Lỗi ghi nhật ký không làm hỏng thao tác chính. */
@Injectable()
export class DatasetAuditService {
  private readonly logger = new Logger(DatasetAuditService.name);

  constructor(@InjectRepository(AdminAuditLogEntity) private readonly audits: Repository<AdminAuditLogEntity>) {}

  async record(actor: DatasetActor, action: string, targetId: string, after: Record<string, unknown> | null, reason: string | null = null): Promise<void> {
    try {
      await this.audits.save(
        this.audits.create({
          actorId: actor.userId,
          actorType: 'admin',
          action: action.slice(0, 40),
          targetType: 'map_dataset',
          targetId: targetId.slice(0, 64),
          before: null,
          after,
          reason: reason ? reason.slice(0, 255) : null,
          ipAddress: actor.ip,
          sessionId: actor.sessionId,
        }),
      );
    } catch (error) {
      this.logger.error(`Không ghi được nhật ký ${action} ${targetId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
