import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { SEED_ARTICLES } from '../articles/seed.config.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import { DiscussionLikeEntity } from './entities/discussion-like.entity.js';
import { DiscussionMediaEntity } from './entities/discussion-media.entity.js';
import { DiscussionPostEntity } from './entities/discussion-post.entity.js';
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
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'production') return;
    const existing = await this.topics.findOne({ where: { slug: 'ho-tay' } });
    if (existing) {
      await this.extraFeed();
      await this.articleFeed();
      await this.profileFeed();
      return;
    }

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
    await this.extraFeed();
    await this.articleFeed();
    await this.profileFeed();
  }

  private async profileFeed(): Promise<void> {
    const topics = await this.topics.find({
      where: { slug: In(['ho-tay', 'gia-nha']) },
    });
    const bySlug = new Map(topics.map((topic) => [topic.slug, topic]));
    const hoTay = bySlug.get('ho-tay');
    const gia = bySlug.get('gia-nha');
    if (!hoTay || !gia) return;
    const samples = [
      ['admin@location-insight.local', hoTay.id, 'Mẫu hồ sơ quản trị: tin mới nên đọc nguồn trước khi đưa lên diễn đàn.'],
      ['admin@location-insight.local', gia.id, 'Mẫu hồ sơ quản trị: khung giá trên trang chỉ để tham khảo, không thay hồ sơ nhà.'],
      ['user@location-insight.local', hoTay.id, 'Mẫu hồ sơ người dùng: sáng nay đi bộ ven hồ, gió mạnh phía đường Thanh Niên.'],
      ['user@location-insight.local', gia.id, 'Mẫu hồ sơ người dùng: mình đang so hai căn cùng một ngõ trước khi đi xem.'],
      ['lan-anh@location-insight.local', hoTay.id, 'Mẫu hồ sơ Lan Anh: quán sát hồ cuối tuần đông, đi sớm thì còn chỗ ngồi.'],
      ['lan-anh@location-insight.local', gia.id, 'Mẫu hồ sơ Lan Anh: giá chào và giá trên trang đang lệch, nên hỏi lại trước khi cọc.'],
      ['minh-duc@location-insight.local', hoTay.id, 'Mẫu hồ sơ Minh Đức: bãi xe Quảng An còn chỗ vào buổi trưa ngày thường.'],
      ['minh-duc@location-insight.local', gia.id, 'Mẫu hồ sơ Minh Đức: căn hướng tây nên xem nhà lúc chiều nếu ở tầng thấp.'],
      ['ha-my@location-insight.local', gia.id, 'Mẫu hồ sơ Hà My: căn gần đường Láng mình xem có ban công hướng đông.'],
      ['ha-my@location-insight.local', hoTay.id, 'Mẫu hồ sơ Hà My: từ đường Láng ra hồ mất khoảng hai mươi phút nếu không kẹt.'],
      ['quoc-bao@location-insight.local', gia.id, 'Mẫu hồ sơ Quốc Bảo: nhà mặt phố nên tách giá đất và giá nhà khi so sánh.'],
      ['quoc-bao@location-insight.local', hoTay.id, 'Mẫu hồ sơ Quốc Bảo: mặt phố ven hồ vắng người bán vào giữa tuần.'],
      ['thu-ha@location-insight.local', gia.id, 'Mẫu hồ sơ Thu Hà: mình đang dùng thử, chỉ xem khung giá chứ chưa đi cọc.'],
      ['thu-ha@location-insight.local', hoTay.id, 'Mẫu hồ sơ Thu Hà: hỏi người trong ngõ trước khi tin một bài rao trên mạng.'],
      ['duc-anh@location-insight.local', gia.id, 'Mẫu hồ sơ Đức Anh: định giá một lần chỉ mở một lần xem, không phải một gói.'],
      ['duc-anh@location-insight.local', hoTay.id, 'Mẫu hồ sơ Đức Anh: ghi lại ngày xem nhà để khỏi nhầm với tin cũ.'],
      ['ngoc-lan@location-insight.local', gia.id, 'Mẫu hồ sơ Ngọc Lan: vẫn đọc tin đến hết kỳ, chưa đăng bài rao mới.'],
      ['ngoc-lan@location-insight.local', hoTay.id, 'Mẫu hồ sơ Ngọc Lan: ngõ gần hồ tối sau chín giờ, nên đi cùng người quen.'],
      ['thanh-son@location-insight.local', gia.id, 'Mẫu hồ sơ Thanh Sơn: đã về gói miễn phí, vẫn xem tin công khai mỗi tuần.'],
      ['thanh-son@location-insight.local', hoTay.id, 'Mẫu hồ sơ Thanh Sơn: cuối hồ có lối ra đường lớn, dễ quay xe hơn giữa ngõ.'],
      ['my-linh@location-insight.local', gia.id, 'Mẫu hồ sơ Mỹ Linh: gói tháng trước hết hạn, các tin đã lưu vẫn còn trên máy.'],
      ['my-linh@location-insight.local', hoTay.id, 'Mẫu hồ sơ Mỹ Linh: sáng sớm hồ yên, chiều quán cà phê kín chỗ.'],
      ['hoang-nam@location-insight.local', gia.id, 'Mẫu hồ sơ Hoàng Nam: kỳ thanh toán quá hạn nên mình chỉ đọc, chưa đăng tin.'],
      ['hoang-nam@location-insight.local', hoTay.id, 'Mẫu hồ sơ Hoàng Nam: đường ven hồ hạn chế một chiều vào giờ tan tầm.'],
      ['phuong-anh@location-insight.local', gia.id, 'Mẫu hồ sơ Phương Anh: vừa nâng gói, đang xem thêm các căn cùng một phường.'],
      ['phuong-anh@location-insight.local', hoTay.id, 'Mẫu hồ sơ Phương Anh: muốn hỏi ngõ nào gần hồ mà ô tô vẫn quay đầu được.'],
      ['viet-anh@location-insight.local', gia.id, 'Mẫu hồ sơ Việt Anh: mới xem tin, chưa chọn gói và chưa đặt lịch đi xem nhà.'],
      ['viet-anh@location-insight.local', hoTay.id, 'Mẫu hồ sơ Việt Anh: ghi chú địa chỉ ngõ kẻo ô tìm kiếm thả sai điểm.'],
      ['khoa-nguyen@location-insight.local', gia.id, 'Mẫu hồ sơ Khoa Nguyễn: đang dùng gói có định giá, mỗi lượt xem là một báo cáo.'],
      ['khoa-nguyen@location-insight.local', hoTay.id, 'Mẫu hồ sơ Khoa Nguyễn: hai ghim gần nhau vẫn là hai ngôi nhà khác nhau.'],
      ['bao-chau@location-insight.local', gia.id, 'Mẫu hồ sơ Bảo Châu: tài khoản mới, mình đang đọc các bài quanh hồ trước.'],
      ['bao-chau@location-insight.local', hoTay.id, 'Mẫu hồ sơ Bảo Châu: hỏi lại sổ đứng tên ai trước khi hẹn xem nhà.'],
    ] as const;
    for (const [email, topicId, body] of samples) {
      const author = await this.users.findOne({ where: { email } });
      if (!author) continue;
      const found = await this.posts.findOne({ where: { body } });
      if (found) continue;
      await this.posts.save(
        this.posts.create({
          authorId: author.id,
          topicId,
          rootId: null,
          parentId: null,
          kind: 'note',
          body,
          status: 'visible',
          replyCount: 0,
          likeCount: 0,
        }),
      );
    }
  }

  private async extraFeed(): Promise<void> {
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
    const topics = await this.topics.find({
      where: { slug: In(['ho-tay', 'gia-nha', 'ngo-cu']) },
    });
    const bySlug = new Map(topics.map((topic) => [topic.slug, topic]));
    const samples = [
      ['user@location-insight.local', 'ho-tay', 'Sáng nay hồ Tây gió mạnh, đi bộ phía đường Thanh Niên nên mặc thêm áo.'],
      ['lan-anh@location-insight.local', 'gia-nha', 'Mình vừa xem một căn gần chợ. Giá chào và giá trang đang lệch khoảng một phần mười.'],
      ['minh-duc@location-insight.local', 'ngo-cu', 'Ngõ này xe máy tránh nhau được, ô tô thì phải quay đầu ở đầu ngõ.'],
      ['user@location-insight.local', 'gia-nha', 'Hỏi chủ nhà xem giá đã gồm thuế và phí môi giới chưa trước khi đặt cọc.'],
      ['lan-anh@location-insight.local', 'ho-tay', 'Cuối tuần quán cà phê sát hồ đông. Nếu cần yên thì đi sớm.'],
      ['minh-duc@location-insight.local', 'gia-nha', 'Căn hướng tây nóng buổi chiều. Nên xem nhà lúc 3 giờ nếu ở tầng thấp.'],
      ['user@location-insight.local', 'ngo-cu', 'Đèn ngõ tối sau 9 giờ. Người đi một mình nên chọn lối ra đường lớn.'],
      ['lan-anh@location-insight.local', 'ngo-cu', 'Nhà cuối ngõ yên hơn, nhưng mùa mưa nước rút chậm hơn mặt phố.'],
      ['minh-duc@location-insight.local', 'ho-tay', 'Bãi xe công cộng phía Quảng An còn chỗ vào buổi trưa ngày thường.'],
      ['user@location-insight.local', 'gia-nha', 'So giá theo mét vuông trong cùng một ngõ sẽ dễ hơn so với cả quận.'],
      ['lan-anh@location-insight.local', 'gia-nha', 'Tin rao ghi "sổ đỏ" thì nên hỏi lại sổ đứng tên ai trước khi đi xem.'],
      ['minh-duc@location-insight.local', 'ho-tay', 'Đường ven hồ đang hạn chế một chiều vào giờ tan tầm. Đi vòng sẽ lâu hơn.'],
    ] as const;
    for (const [email, slug, body] of samples) {
      const author = byEmail.get(email);
      const topic = bySlug.get(slug);
      if (!author || !topic) continue;
      const found = await this.posts.findOne({ where: { body } });
      if (found) continue;
      await this.posts.save(
        this.posts.create({
          authorId: author.id,
          topicId: topic.id,
          rootId: null,
          parentId: null,
          kind: 'note',
          body,
          status: 'visible',
          replyCount: 0,
          likeCount: 0,
        }),
      );
    }
  }

  private async articleFeed(): Promise<void> {
    const author = await this.users.findOne({
      where: { email: 'admin@location-insight.local' },
    });
    const topics = await this.topics.find({
      where: { slug: In(['ho-tay', 'gia-nha']) },
    });
    const bySlug = new Map(topics.map((topic) => [topic.slug, topic]));
    if (!author || bySlug.size === 0) return;
    for (const article of SEED_ARTICLES) {
      const topicSlug = article.topic === 'gia' || article.topic === 'du-lieu' ? 'gia-nha' : 'ho-tay';
      const topic = bySlug.get(topicSlug);
      if (!topic) continue;
      const body = `${article.title}\n\n${article.lede}`.slice(0, 2000);
      const found = await this.posts.findOne({ where: { body } });
      if (found) continue;
      await this.posts.save(
        this.posts.create({
          authorId: author.id,
          topicId: topic.id,
          rootId: null,
          parentId: null,
          kind: 'note',
          body,
          status: 'visible',
          replyCount: 0,
          likeCount: 0,
        }),
      );
    }
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
