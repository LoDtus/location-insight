import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Lượt đọc gộp theo ngày (giờ Việt Nam) của mỗi bài: một hàng/bài/ngày thay vì một hàng/lượt, nên bảng nhỏ và truy vấn
 * "đọc nhiều nhất 7/30 ngày" nhanh. Mỗi người đọc chỉ tính một lần/bài/ngày (khử trùng bằng Redis).
 */
@Entity('article_view_daily')
@Index('idx_article_view_daily_day', ['day'])
export class ArticleViewDailyEntity {
  @PrimaryColumn({ type: 'uuid', name: 'article_id' })
  articleId: string;

  @PrimaryColumn({ type: 'date' })
  day: string;

  @Column({ type: 'integer', default: 0 })
  views: number;
}
