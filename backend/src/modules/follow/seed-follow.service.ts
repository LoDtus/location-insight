import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserEntity } from '../auth/entities/user.entity.js';
import { UserFollowEntity } from './entities/user-follow.entity.js';
import { FollowService } from './follow.service.js';

const H = 60 * 60 * 1000;

/** [người theo dõi, người được theo dõi, giờ trước] giữa các tài khoản mẫu. */
const EDGES: Array<[string, string, number]> = [
  ['user', 'lan-anh', 200],
  ['user', 'minh-duc', 150],
  ['user', 'quoc-bao', 90],
  ['lan-anh', 'user', 180],
  ['lan-anh', 'minh-duc', 120],
  ['lan-anh', 'ha-my', 70],
  ['minh-duc', 'user', 100],
  ['minh-duc', 'lan-anh', 60],
  ['ha-my', 'user', 48],
  ['ha-my', 'lan-anh', 30],
  ['quoc-bao', 'user', 24],
  ['thu-ha', 'lan-anh', 12],
  ['thu-ha', 'user', 10],
  ['duc-anh', 'user', 5],
  ['duc-anh', 'minh-duc', 3],
];

/** Quan hệ theo dõi mẫu cho môi trường dev, chỉ chạy khi chưa có quan hệ nào. */
@Injectable()
export class SeedFollowService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedFollowService.name);

  constructor(
    private readonly follows: FollowService,
    @InjectRepository(UserFollowEntity) private readonly edges: Repository<UserFollowEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === 'production') return;
    try {
      if ((await this.edges.count()) > 0) return;
      const names = [...new Set(EDGES.flatMap(([a, b]) => [a, b]))];
      const people = await this.users.find({
        where: { email: In(names.map((name) => `${name}@email.com`)) },
      });
      const byName = new Map(people.map((user) => [user.email.split('@')[0] as string, user.id]));
      const now = Date.now();
      let created = 0;
      for (const [from, to, hoursAgo] of EDGES) {
        const follower = byName.get(from);
        const followee = byName.get(to);
        if (!follower || !followee) continue;
        await this.edges.insert({ followerId: follower, followeeId: followee, createdAt: new Date(now - hoursAgo * H) });
        created += 1;
      }
      await this.follows.reconcile();
      if (created) this.logger.log(`Đã tạo ${created} quan hệ theo dõi mẫu.`);
    } catch (error) {
      this.logger.warn(`Chưa tạo được quan hệ theo dõi mẫu: ${error instanceof Error ? error.message : 'không rõ'}`);
    }
  }
}
