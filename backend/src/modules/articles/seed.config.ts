import type { ArticleFormat, ArticleTopic } from './article-rules.js';
import { extraArticleBody, handWrittenBody } from './seed-article-bodies.js';

export type SeedArticle = {
  slug: string;
  title: string;
  lede: string;
  topic: ArticleTopic;
  publishedAt: string;
  coverImage: string;
  body: string;
  /** Mặc định standard; bài nhiều ảnh minh họa đánh dấu photo để có mục "Video / Ảnh" khi xem thử. */
  format?: ArticleFormat;
};

const SEED_ARTICLE_BASE: readonly SeedArticle[] = [
  {
    slug: 'ban-kinh-500-met',
    title: 'Bán kính 500 mét đang đo cái gì',
    lede: 'Vòng tròn quanh ghim là đường chim bay, không phải quãng đi bộ qua ngõ.',
    topic: 'cach-doc',
    publishedAt: '2026-10-12T01:00:00.000Z',
    coverImage: '/images/temp-002.jpg',
    body: handWrittenBody('ban-kinh-500-met') ?? '',
    format: 'photo',
  },
  {
    slug: 'ghim-lech',
    title: 'Ghim lệch thì mọi khoảng cách lệch theo',
    lede: 'Địa chỉ chỉ đưa tới gần. Báo cáo bám ô đất bạn kéo ghim tới.',
    topic: 'cach-doc',
    publishedAt: '2026-10-02T01:00:00.000Z',
    coverImage: '/images/temp-003.jpg',
    body: handWrittenBody('ghim-lech') ?? '',
  },
  {
    slug: 'khung-gia',
    title: 'Khung giá không phải giá bán',
    lede: 'Đó là khoảng ước lượng khi đủ dữ liệu, không phải số chủ nhà đang chào.',
    topic: 'gia',
    publishedAt: '2026-08-21T01:00:00.000Z',
    coverImage: '/images/temp-004.jpg',
    body: handWrittenBody('khung-gia') ?? '',
    format: 'photo',
  },
];

const COVERS = ['/images/temp-002.jpg', '/images/temp-003.jpg', '/images/temp-004.jpg'] as const;

const EXTRA: ReadonlyArray<readonly [string, string, string, ArticleTopic]> = [
  ['mat-tien', 'Mặt tiền không nằm trong vòng tròn', 'Vòng quanh ghim không nói căn nhà quay ra đường nào.', 'cach-doc'],
  ['ngo-cut', 'Ngõ cụt làm khoảng đi bộ dài hơn', 'Điểm trong vòng vẫn có thể phải quay đầu.', 'khu-vuc'],
  ['ga-sat-meo', 'Ga sát mép vòng chưa có lối vào', 'Khoảng cách tới ga không phải phút ra khỏi nhà.', 'khu-vuc'],
  ['ho-va-duong', 'Hồ chặn đường chim bay', 'Một mép hồ gần ghim vẫn có thể phải đi vòng.', 'khu-vuc'],
  ['mat-do-tien-ich', 'Đếm tiện ích không phải đếm phút', 'Nhiều chấm trong vòng chưa nói được lối đi.', 'du-lieu'],
  ['thieu-phap-ly', 'Thiếu pháp lý thì khung giá rộng ra', 'Trang không chốt một mức khi hồ sơ còn trống.', 'gia'],
  ['gia-chao', 'Giá chào không phải khung giá', 'Số chủ nhà ghi trên tin là một nguồn khác.', 'gia'],
  ['mot-luot-dinh-gia', 'Một lượt định giá không phải một gói', 'Trả một lần chỉ mở một lần xem khung giá.', 'gia'],
  ['du-lieu-cu', 'Dữ liệu cũ không tự thành tin mới', 'Ngày cập nhật nguồn nằm cạnh con số.', 'du-lieu'],
  ['tim-dia-chi', 'Ô tìm địa chỉ chỉ đưa tới gần', 'Ngõ Hà Nội hay làm điểm rơi lệch khỏi ô đất.', 'cach-doc'],
  ['so-sanh-hai-ghim', 'Hai ghim là hai báo cáo', 'Đừng đọc số của ghim này cho ô đất kia.', 'cach-doc'],
  ['duong-lon', 'Đường lớn có thể cắt vòng tròn', 'Sang đường không nằm trong phép đo chim bay.', 'khu-vuc'],
  ['truong-hoc', 'Trường trong vòng chưa phải cổng trường', 'Cổng có thể nằm phía đường khác.', 'khu-vuc'],
  ['cho-sang', 'Chợ sáng không hiện trên vòng đêm', 'Giờ hoạt động không được vẽ thành khoảng cách.', 'du-lieu'],
  ['doc-truoc-khi-chot', 'Đọc giới hạn trước khi chốt một số', 'Một con số thiếu nguồn thì chưa dùng để quyết định.', 'du-lieu'],
];

function extraSeedArticles(): SeedArticle[] {
  return EXTRA.map(([slug, title, lede, topic], index) => {
    const month = String((index % 9) + 1).padStart(2, '0');
    const day = String((index % 27) + 1).padStart(2, '0');
    return {
      slug,
      title,
      lede,
      topic,
      publishedAt: `2026-${month}-${day}T01:00:00.000Z`,
      coverImage: COVERS[index % COVERS.length],
      body: extraArticleBody({ title, lede, topic, index }),
    };
  });
}

export const SEED_ARTICLES: readonly SeedArticle[] = [
  ...SEED_ARTICLE_BASE,
  ...extraSeedArticles(),
];
