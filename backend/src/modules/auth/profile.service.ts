import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { v7 as uuidv7 } from 'uuid';
import { Repository } from 'typeorm';
import sharp from 'sharp';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { UserRole } from '../rbac/authorization.types.js';
import { presentAvatarUrl, sniffAvatar } from './avatar-url.js';
import { PrepareAvatarDto, UpdateProfileDto } from './dto/profile.dto.js';
import { UserEntity, UserStatus } from './entities/user.entity.js';

const AVATAR_BYTES = 8 * 1024 * 1024;
const AVATAR_EDGE = 512;

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly storage: StorageService,
  ) {}

  async getOwn(userId: string) {
    const user = await this.requireUser(userId);
    return this.view(user, true);
  }

  async getById(userId: string) {
    const user = await this.users.findOne({
      where: { id: userId, status: UserStatus.ACTIVE },
    });
    if (!user) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Không tìm thấy hồ sơ này.',
        undefined,
        HttpStatus.NOT_FOUND,
      );
    }
    return this.view(user, false);
  }

  async getSharedAvatar(fileId: string) {
    const id = fileId.toLowerCase();
    const user = await this.users
      .createQueryBuilder('user')
      .where('user.status = :status', { status: UserStatus.ACTIVE })
      .andWhere('user.avatarUrl LIKE :tail', { tail: `%/${id}.webp` })
      .getOne();
    const key = user ? `avatars/${user.id}/${id}.webp` : '';
    if (!user || user.avatarUrl !== key) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Không tìm thấy ảnh đại diện.',
        undefined,
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      fileId: id,
      avatarUrl: presentAvatarUrl(user.avatarUrl) ?? '',
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
    };
  }

  async getPublic(username: string) {
    const user = await this.users.findOne({
      where: {
        username: username.trim().toLowerCase(),
        status: UserStatus.ACTIVE,
      },
    });
    if (!user) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Không tìm thấy hồ sơ này.',
        undefined,
        HttpStatus.NOT_FOUND,
      );
    }
    return this.view(user, false);
  }

  async update(userId: string, input: UpdateProfileDto) {
    const user = await this.requireUser(userId);
    const username = input.username.trim().toLowerCase();
    const duplicate = await this.users.findOne({ where: { username } });
    if (duplicate && duplicate.id !== user.id) {
      throw new BusinessException(
        ErrorCode.CONFLICT,
        'Username này đã được sử dụng.',
        undefined,
        HttpStatus.CONFLICT,
      );
    }

    const avatarUrl = input.avatarUrl?.trim() || null;
    const keepStored =
      avatarUrl !== null && presentAvatarUrl(user.avatarUrl) === avatarUrl.split('?')[0];
    if (
      !keepStored &&
      avatarUrl &&
      !avatarUrl.startsWith('/images/') &&
      !avatarUrl.startsWith('https://')
    ) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Ảnh đại diện phải là đường dẫn /images/ hoặc URL https.',
      );
    }

    user.displayName = input.displayName.trim();
    user.username = username;
    if (!keepStored) {
      await this.deleteStoredAvatar(user.avatarUrl);
      user.avatarUrl = avatarUrl;
    }
    user.city = input.city?.trim() || null;
    user.bio = input.bio?.trim() || '';
    await this.users.save(user);
    return this.view(user, true);
  }

  async prepareAvatar(userId: string, input: PrepareAvatarDto) {
    await this.requireUser(userId);
    const uploadUrl = await this.storage.getPresignedPutUrl(
      this.incomingKey(userId),
      input.contentType,
    );
    return { uploadUrl };
  }

  async completeAvatar(userId: string) {
    const user = await this.requireUser(userId);
    const incoming = this.incomingKey(userId);
    const size = await this.storage.objectSize(incoming);
    if (size === null) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Chưa thấy ảnh vừa tải lên.',
        undefined,
        HttpStatus.NOT_FOUND,
      );
    }
    if (size > AVATAR_BYTES) {
      await this.deleteStoredAvatar(incoming);
      throw new BusinessException(
        ErrorCode.FILE_TOO_LARGE,
        'Ảnh vượt 8 MB.',
        undefined,
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
    const raw = await this.storage.getObject(incoming);
    if (!sniffAvatar(raw)) {
      await this.deleteStoredAvatar(incoming);
      throw new BusinessException(
        ErrorCode.INVALID_FILE_TYPE,
        'Chỉ nhận ảnh JPEG, PNG hoặc WebP.',
        undefined,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    let encoded: Buffer;
    try {
      encoded = await sharp(raw, { limitInputPixels: 16_000_000, failOn: 'error' })
        .rotate()
        .resize(AVATAR_EDGE, AVATAR_EDGE, { fit: 'cover', position: 'centre' })
        .webp({ quality: 80 })
        .toBuffer();
    } catch (error) {
      await this.deleteStoredAvatar(incoming);
      this.logger.warn(`Không xử lý được ảnh đại diện: ${errorName(error)}`);
      throw new BusinessException(
        ErrorCode.INVALID_FILE_TYPE,
        'Không đọc được ảnh này.',
        undefined,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const fileId = uuidv7();
    const nextKey = `avatars/${user.id}/${fileId}.webp`;
    const previous = user.avatarUrl;
    await this.storage.putObject(nextKey, encoded, 'image/webp');
    user.avatarUrl = nextKey;
    await this.users.save(user);
    await this.deleteStoredAvatar(incoming);
    if (previous && previous !== nextKey) await this.deleteStoredAvatar(previous);
    return this.view(user, true);
  }

  async readAvatar(userId: string, fileId: string): Promise<Buffer> {
    const key = `avatars/${userId}/${fileId}.webp`;
    try {
      const bytes = await this.storage.getObject(key);
      if (bytes.length > 0) return bytes;
    } catch (error) {
      if (!isMissingObject(error)) throw error;
    }
    throw new BusinessException(
      ErrorCode.NOT_FOUND,
      'Không tìm thấy ảnh đại diện.',
      undefined,
      HttpStatus.NOT_FOUND,
    );
  }

  private incomingKey(userId: string): string {
    return `avatars/${userId}/incoming`;
  }

  private async deleteStoredAvatar(key: string | null): Promise<void> {
    if (!key?.startsWith('avatars/')) return;
    try {
      await this.storage.deleteObject(key);
    } catch (error) {
      this.logger.warn(`Không xóa được ảnh đại diện: ${errorName(error)}`);
    }
  }

  private async requireUser(userId: string): Promise<UserEntity> {
    const user = await this.users.findOne({
      where: { id: userId, status: UserStatus.ACTIVE },
    });
    if (!user) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Không tìm thấy người dùng.',
        undefined,
        HttpStatus.NOT_FOUND,
      );
    }
    return user;
  }

  private view(user: UserEntity, own: boolean) {
    return {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: presentAvatarUrl(user.avatarUrl),
      city: user.city,
      bio: user.bio,
      role: user.role === UserRole.ADMIN ? 'admin' : 'user',
      joinedAt: user.createdAt,
      ...(own ? { email: user.email } : {}),
    };
  }
}

function errorName(error: unknown): string {
  if (error instanceof Error) return error.name;
  return 'Error';
}

function isMissingObject(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error ? String(error.name) : '';
  return name === 'NoSuchKey' || name === 'NotFound';
}
