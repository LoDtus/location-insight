import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import { DiscussionLikeEntity } from './entities/discussion-like.entity.js';
import { DiscussionMediaEntity } from './entities/discussion-media.entity.js';
import { DiscussionPostEntity } from './entities/discussion-post.entity.js';
import { DiscussionReportEntity } from './entities/discussion-report.entity.js';
import { DiscussionTopicEntity } from './entities/discussion-topic.entity.js';
import { SEED_JPEG, SEED_TOPICS } from './seed.config.js';

@Injectable()
export class SeedDiscussionService implements OnModuleInit {
  private readonly logger = new Logger(SeedDiscussionService.name);

  constructor(
    private readonly storage: StorageService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(DiscussionTopicEntity)
    private readonly topics: Repository<DiscussionTopicEntity>,
    @InjectRepository(DiscussionPostEntity)
    private readonly posts: Repository<DiscussionPostEntity>,
    @InjectRepository(DiscussionMediaEntity)
    private readonly media: Repository<DiscussionMediaEntity>,
    @InjectRepository(DiscussionLikeEntity)
    private readonly likes: Repository<DiscussionLikeEntity>,
    @InjectRepository(DiscussionReportEntity)
    private readonly reports: Repository<DiscussionReportEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'production') return;
    const existing = await this.topics.findOne({ where: { slug: 'ho-tay' } });
    if (existing) return;

    const people = await this.users.find({
      where: {
        email: In([
          'user@location-insight.local',
          'lan-anh@location-insight.local',
          'minh-duc@location-insight.local',
        ]),
      },
    });
    const byEmail = new Map(people.map((user) => [user.email, user]));
    const user = byEmail.get('user@location-insight.local');
    const lan = byEmail.get('lan-anh@location-insight.local');
    const minh = byEmail.get('minh-duc@location-insight.local');
    if (!user || !lan || !minh) {
      this.logger.warn('Bỏ qua seed diễn đàn vì thiếu tài khoản mẫu.');
      return;
    }

    const topics = new Map<string, DiscussionTopicEntity>();
    for (const seed of SEED_TOPICS) {
      const saved = await this.topics.save(
        this.topics.create({
          authorId: user.id,
          name: seed.name,
          slug: seed.slug,
          summary: seed.summary,
          status: 'status' in seed ? seed.status : 'open',
        }),
      );
      topics.set(seed.slug, saved);
    }

    const hoTay = topics.get('ho-tay');
    const gia = topics.get('gia-nha');
    const ngo = topics.get('ngo-cu');
    if (!hoTay || !gia || !ngo) return;

    const question = await this.posts.save(
      this.posts.create({
        authorId: user.id,
        topicId: hoTay.id,
        rootId: null,
        parentId: null,
        kind: 'question',
        body: 'Đoạn kè phía đường Thanh Niên đang sửa thì đi vòng ngõ nào cho gần?',
        status: 'visible',
        replyCount: 1,
        likeCount: 1,
      }),
    );
    await this.posts.save(
      this.posts.create({
        authorId: lan.id,
        topicId: hoTay.id,
        rootId: question.id,
        parentId: question.id,
        kind: 'reply',
        body: 'Đi phía trong vẫn vòng được. Ra đến cửa hồ thì hỏi lại người bán nước.',
        status: 'visible',
        replyCount: 0,
        likeCount: 0,
      }),
    );
    await this.likes.save(
      this.likes.create({ postId: question.id, userId: lan.id }),
    );
    await this.reports.save(
      this.reports.create({
        postId: question.id,
        reporterId: minh.id,
        reason: 'Báo cáo mẫu để màn duyệt có một dòng đang mở.',
        status: 'open',
      }),
    );

    const note = await this.posts.save(
      this.posts.create({
        authorId: minh.id,
        topicId: gia.id,
        rootId: null,
        parentId: null,
        kind: 'note',
        body: 'Khung giá trên trang là khoảng ước lượng, không phải giá chủ nhà đang chào.',
        status: 'visible',
        replyCount: 0,
        likeCount: 0,
      }),
    );
    await this.attachJpeg(minh.id, note.id);
    await this.posts.save(
      this.posts.create({
        authorId: user.id,
        topicId: ngo.id,
        rootId: null,
        parentId: null,
        kind: 'question',
        body: 'Ngõ này hẹp, ô tô không vào được. Chủ đề đã khóa nên không nhận thêm trả lời.',
        status: 'visible',
        replyCount: 0,
        likeCount: 0,
      }),
    );
    this.logger.log('Đã tạo chủ đề và bài mẫu cho diễn đàn.');
  }

  private async attachJpeg(authorId: string, postId: string): Promise<void> {
    const id = uuidv7();
    const objectKey = `discussions/${authorId}/${id}`;
    try {
      await this.storage.putObject(objectKey, SEED_JPEG, 'image/jpeg');
    } catch (error) {
      this.logger.warn(
        `Bỏ qua ảnh mẫu: ${error instanceof Error ? error.message : 'lỗi không rõ'}`,
      );
      return;
    }
    await this.media.save(
      this.media.create({
        id,
        postId,
        authorId,
        objectKey,
        contentType: 'image/jpeg',
        byteSize: SEED_JPEG.length,
        kind: 'image',
        status: 'ready',
        sortOrder: 0,
      }),
    );
  }
}
