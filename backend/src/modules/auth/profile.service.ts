import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { UserRole } from '../rbac/authorization.types.js';
import { UpdateProfileDto } from './dto/profile.dto.js';
import { UserEntity, UserStatus } from './entities/user.entity.js';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async getOwn(userId: string) {
    const user = await this.requireUser(userId);
    return this.view(user, true);
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
    if (
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
    user.avatarUrl = avatarUrl;
    user.city = input.city?.trim() || null;
    user.bio = input.bio?.trim() || '';
    await this.users.save(user);
    return this.view(user, true);
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
      avatarUrl: user.avatarUrl,
      city: user.city,
      bio: user.bio,
      role: user.role === UserRole.ADMIN ? 'admin' : 'user',
      joinedAt: user.createdAt,
      ...(own ? { email: user.email } : {}),
    };
  }
}
