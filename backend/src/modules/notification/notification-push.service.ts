import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { HttpStatus, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { notFound, tooMany, unavailable } from '../messaging/messaging-errors.js';
import { PushOutboxEntity } from './entities/push-outbox.entity.js';
import { PushSubscriptionEntity, type PushPlatform, type SuspendReason } from './entities/push-subscription.entity.js';
import { NotificationPreferenceEntity } from './entities/notification-preference.entity.js';
import { NotificationEntity } from './entities/notification.entity.js';
import { allowedPushEndpoint, keyByteLength, plain } from './notification.rules.js';

interface WebPushClient {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
    options: { TTL: number; urgency: string; topic?: string },
  ): Promise<unknown>;
}

const webpush = createRequire(import.meta.url)('web-push') as WebPushClient;

interface SubscribeInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  deviceId: string;
  label?: string;
  installedPwa?: boolean;
  expirationTime?: number | null;
  vapidPublicKey?: string;
}

@Injectable()
export class NotificationPushService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationPushService.name);
  private timer: NodeJS.Timeout | null = null;
  private configured = false;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    @InjectRepository(PushSubscriptionEntity)
    private readonly devices: Repository<PushSubscriptionEntity>,
    @InjectRepository(PushOutboxEntity)
    private readonly outbox: Repository<PushOutboxEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notifications: Repository<NotificationEntity>,
    @InjectRepository(NotificationPreferenceEntity)
    private readonly preferences: Repository<NotificationPreferenceEntity>,
  ) {}

  onModuleInit(): void {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY') ?? '';
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY') ?? '';
    if (publicKey && privateKey) {
      webpush.setVapidDetails(
        this.config.get<string>('VAPID_SUBJECT') || 'mailto:admin@location-insight.local',
        publicKey,
        privateKey,
      );
      this.configured = true;
    }
    this.timer = setInterval(() => void this.tick(), 5000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  configView(): { enabled: boolean; vapidPublicKey?: string } {
    const vapidPublicKey = this.config.get<string>('VAPID_PUBLIC_KEY') ?? '';
    if (!this.configured || !vapidPublicKey) return { enabled: false };
    return { enabled: true, vapidPublicKey };
  }

  async list(userId: string, currentDeviceId?: string) {
    const rows = await this.devices.find({
      where: { userId, deletedAt: IsNull() },
      order: { lastSeenAt: 'DESC' },
    });
    return rows.map((row) => ({
      id: row.id,
      platform: row.platform,
      label: row.label,
      installedPwa: row.installedPwa,
      pushEnabled: row.pushEnabled,
      suspended: Boolean(row.suspendedAt),
      current: currentDeviceId === row.deviceId,
      lastSeenAt: row.lastSeenAt.toISOString(),
      lastSuccessAt: row.lastSuccessAt ? row.lastSuccessAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async subscribe(userId: string, input: SubscribeInput) {
    await this.guard(`ratelimit:notif:sub:user_${userId}`, 20, 3600);
    if (!allowedPushEndpoint(input.endpoint) || keyByteLength(input.keys.p256dh) !== 65 || keyByteLength(input.keys.auth) !== 16) {
      throw new BusinessException(ErrorCode.VALIDATION_ERROR, 'Đăng ký push không hợp lệ.', null, HttpStatus.BAD_REQUEST);
    }
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY') ?? '';
    const hash = publicKey.slice(0, 16);
    if (input.vapidPublicKey && input.vapidPublicKey !== publicKey) {
      throw new BusinessException(ErrorCode.CONFLICT, 'Khóa thông báo đã đổi. Hãy bật lại.', null, HttpStatus.CONFLICT);
    }
    const endpointHash = createHash('sha256').update(input.endpoint).digest('hex');
    const now = new Date();
    let row =
      (await this.devices.findOne({ where: { userId, deviceId: input.deviceId, deletedAt: IsNull() } })) ??
      (await this.devices.findOne({ where: { endpointHash } }));
    if (!row) {
      const count = await this.devices.count({ where: { userId, deletedAt: IsNull() } });
      if (count >= 10) {
        const oldest = await this.devices.find({
          where: { userId, deletedAt: IsNull() },
          order: { lastSeenAt: 'ASC' },
          take: count - 9,
        });
        for (const extra of oldest) extra.deletedAt = now;
        await this.devices.save(oldest);
      }
      row = this.devices.create({ id: uuidv7(), userId, deviceId: input.deviceId });
    }
    row.userId = userId;
    row.deviceId = input.deviceId;
    row.endpointHash = endpointHash;
    row.endpointEnc = this.encrypt(input.endpoint);
    row.keysEnc = this.encrypt(JSON.stringify(input.keys));
    row.vapidKeyHash = hash.padEnd(16, '0').slice(0, 16);
    row.platform = this.platform(input.label);
    row.label = input.label ? plain(input.label, 80) : row.label;
    row.installedPwa = Boolean(input.installedPwa);
    row.pushEnabled = true;
    row.suspendedAt = null;
    row.suspendReason = null;
    row.lastSeenAt = now;
    row.expiresAt = input.expirationTime ? new Date(input.expirationTime) : null;
    row.deletedAt = null;
    await this.devices.save(row);
    const listed = await this.list(userId, input.deviceId);
    return listed.find((item) => item.id === row.id) ?? listed[0];
  }

  async updateDevice(userId: string, id: string, patch: { pushEnabled?: boolean; label?: string }) {
    const row = await this.devices.findOne({ where: { id, userId, deletedAt: IsNull() } });
    if (!row) notFound('Không tìm thấy thiết bị.');
    if (patch.pushEnabled !== undefined) row.pushEnabled = patch.pushEnabled;
    if (patch.label !== undefined) row.label = plain(patch.label, 80);
    await this.devices.save(row);
    const listed = await this.list(userId, row.deviceId);
    return listed.find((item) => item.id === row.id);
  }

  async removeDevice(userId: string, id: string): Promise<void> {
    const row = await this.devices.findOne({ where: { id, userId, deletedAt: IsNull() } });
    if (!row) notFound('Không tìm thấy thiết bị.');
    row.deletedAt = new Date();
    await this.devices.save(row);
  }

  async suspendDevice(userId: string, deviceId: string, reason: SuspendReason): Promise<void> {
    await this.devices.update(
      { userId, deviceId, deletedAt: IsNull() },
      { suspendedAt: new Date(), suspendReason: reason },
    );
  }

  async suspendAll(userId: string, reason: SuspendReason): Promise<void> {
    await this.devices.update(
      { userId, deletedAt: IsNull(), suspendedAt: IsNull() },
      { suspendedAt: new Date(), suspendReason: reason },
    );
  }

  async removeByEndpoint(userId: string, endpoint: string): Promise<void> {
    const endpointHash = createHash('sha256').update(endpoint).digest('hex');
    await this.devices.update({ userId, endpointHash, deletedAt: IsNull() }, { deletedAt: new Date() });
  }

  async sendTest(userId: string): Promise<void> {
    await this.guard(`ratelimit:notif:test:user_${userId}`, 3, 3600);
    const row = this.notifications.create({
      id: uuidv7(),
      userId,
      type: 'system.announcement',
      category: 'system',
      icon: 'megaphone',
      tone: 'info',
      title: 'Thông báo thử',
      subtitle: 'Thiết bị này nhận được thông báo đẩy.',
      link: '/app/notification',
      count: 1,
      readAt: null,
      deletedAt: new Date(),
    });
    await this.notifications.save(row);
    const now = new Date();
    await this.outbox.save(
      this.outbox.create({
        id: uuidv7(),
        notificationId: row.id,
        userId,
        status: 'queued',
        urgency: 'high',
        ttlSeconds: 120,
        topic: 'system-test',
        attempts: 0,
        notBefore: now,
        nextAttemptAt: now,
      }),
    );
  }

  private async tick(): Promise<void> {
    if (!this.configured) return;
    const due = await this.outbox
      .createQueryBuilder('o')
      .where("o.status = 'queued'")
      .andWhere('o.nextAttemptAt <= now()')
      .orderBy('o.nextAttemptAt', 'ASC')
      .take(10)
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .getMany()
      .catch(() => [] as PushOutboxEntity[]);
    for (const job of due) await this.deliver(job);
  }

  private async deliver(job: PushOutboxEntity): Promise<void> {
    job.status = 'sending';
    await this.outbox.save(job);
    const note = await this.notifications.findOne({ where: { id: job.notificationId } });
    if (!note || (note.readAt && note.type !== 'system.announcement')) {
      job.status = 'skipped';
      job.skipReason = 'read_before_send';
      await this.outbox.save(job);
      return;
    }
    const active = await this.redis.getClient().get(`notif:active:${job.userId}`).catch(() => null);
    if (active && job.urgency !== 'high') {
      job.status = 'skipped';
      job.skipReason = 'user_active';
      await this.outbox.save(job);
      return;
    }
    const devices = await this.devices.find({
      where: { userId: job.userId, deletedAt: IsNull(), suspendedAt: IsNull(), pushEnabled: true },
    });
    if (!devices.length) {
      job.status = 'skipped';
      job.skipReason = 'no_subscription';
      await this.outbox.save(job);
      return;
    }
    const prefs = await this.preferences.findOne({ where: { userId: job.userId } });
    const generic = Boolean(prefs?.hideContentOnLockScreen);
    const payload = JSON.stringify({
      v: 1,
      id: note.deletedAt ? undefined : note.id,
      type: note.type,
      title: generic ? 'Bạn có thông báo mới' : note.title,
      body: generic ? '' : (note.subtitle ?? ''),
      url: note.link,
      tag: job.topic ?? note.type,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      ts: note.createdAt.getTime(),
      renotify: false,
      generic,
    });
    let sent = false;
    for (const device of devices) {
      try {
        const keys = JSON.parse(this.decrypt(device.keysEnc)) as { p256dh: string; auth: string };
        await webpush.sendNotification(
          { endpoint: this.decrypt(device.endpointEnc), keys },
          payload,
          { TTL: job.ttlSeconds, urgency: job.urgency, topic: job.topic ?? undefined },
        );
        device.lastSuccessAt = new Date();
        device.failureCount = 0;
        sent = true;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        device.failureCount += 1;
        device.lastFailureAt = new Date();
        if (status === 404 || status === 410) device.deletedAt = new Date();
        this.logger.warn(`Push lỗi nhóm ${status ?? 'network'}`);
      }
      await this.devices.save(device);
    }
    job.attempts += 1;
    if (sent) {
      job.status = 'sent';
      job.sentAt = new Date();
    } else if (job.attempts >= 5) {
      job.status = 'dead';
      job.lastError = 'retry_exhausted';
    } else {
      job.status = 'queued';
      job.nextAttemptAt = new Date(Date.now() + 30_000 * 2 ** job.attempts);
      job.lastError = 'temporary';
    }
    await this.outbox.save(job);
  }

  private platform(label?: string): PushPlatform {
    const value = (label ?? '').toLowerCase();
    if (value.includes('edg')) return 'edge';
    if (value.includes('firefox')) return 'firefox';
    if (value.includes('safari')) return 'safari';
    if (value.includes('chrome')) return 'chrome';
    return 'other';
  }

  private encrypt(value: string): Buffer {
    const key = this.encKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]);
  }

  private decrypt(payload: Buffer): string {
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const data = payload.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.encKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  private encKey(): Buffer {
    const raw = this.config.get<string>('NOTIFICATION_PUSH_ENC_KEY') ?? '';
    const key = Buffer.from(raw, 'hex');
    if (key.length !== 32) unavailable();
    return key;
  }

  private async guard(key: string, max: number, ttl: number): Promise<void> {
    try {
      const used = Number(
        await this.redis.getClient().eval(
          "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n",
          1,
          key,
          String(ttl),
        ),
      );
      if (used > max) tooMany(ttl);
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      unavailable();
    }
  }
}
