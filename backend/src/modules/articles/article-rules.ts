export const ARTICLE_TOPICS = ['cach-doc', 'khu-vuc', 'gia', 'du-lieu'] as const;

export const ARTICLE_STATUSES = ['draft', 'scheduled', 'published', 'hidden'] as const;

export const ARTICLE_SOURCES = ['manual', 'ai'] as const;

/** Định dạng trình bày: bài thường, phóng sự ảnh, hoặc bài có video (YouTube/Vimeo) ở đầu bài. */
export const ARTICLE_FORMATS = ['standard', 'photo', 'video'] as const;

export type ArticleTopic = (typeof ARTICLE_TOPICS)[number];
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];
export type ArticleSource = (typeof ARTICLE_SOURCES)[number];
export type ArticleFormat = (typeof ARTICLE_FORMATS)[number];

const TOPIC_LABEL: Record<ArticleTopic, string> = {
  'cach-doc': 'cách đọc',
  'khu-vuc': 'khu vực',
  gia: 'khung giá',
  'du-lieu': 'dữ liệu',
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IDEMPOTENCY_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,79}$/;

export type ArticleDraft = {
  title: string;
  slug: string;
  lede: string;
  body: string;
  topic: string;
  status: ArticleStatus;
  publishedAt: Date | null;
  coverImage: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  format: ArticleFormat;
  videoUrl: string | null;
};

export function foldText(value: string): string {
  return value
    .replace(/đ/gi, 'd')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export function slugifyTitle(title: string): string {
  return foldText(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

export function isArticleTopic(value: string): value is ArticleTopic {
  return (ARTICLE_TOPICS as readonly string[]).includes(value);
}

export function searchTextOf(draft: Pick<ArticleDraft, 'title' | 'lede' | 'body' | 'topic'>): string {
  const label = isArticleTopic(draft.topic) ? TOPIC_LABEL[draft.topic] : draft.topic;
  return foldText(`${draft.title} ${draft.lede} ${draft.body} ${label}`);
}

export function likePattern(query: string): string {
  const folded = foldText(query.trim()).replace(/[\\%_]/g, (char) => `\\${char}`);
  return `%${folded}%`;
}

export function isIdempotencyKey(value: string): boolean {
  return IDEMPOTENCY_PATTERN.test(value);
}

export function articleIssues(draft: ArticleDraft, now = new Date()): string[] {
  const issues: string[] = [];

  if (draft.title.trim().length < 8 || draft.title.trim().length > 140) {
    issues.push('Tiêu đề cần từ 8 đến 140 ký tự.');
  }
  if (!SLUG_PATTERN.test(draft.slug) || draft.slug.length > 80) {
    issues.push('Slug chỉ gồm chữ thường, số và dấu gạch, tối đa 80 ký tự.');
  }
  if (!isArticleTopic(draft.topic)) {
    issues.push('Chủ đề không nằm trong danh sách.');
  }
  if (draft.coverImage && !isCoverImage(draft.coverImage)) {
    issues.push('Ảnh bìa phải là đường dẫn /images/ hoặc một URL https.');
  }
  if (!(ARTICLE_FORMATS as readonly string[]).includes(draft.format)) {
    issues.push('Định dạng bài không hợp lệ.');
  }
  if (draft.videoUrl && !videoEmbedUrl(draft.videoUrl)) {
    issues.push('Video phải là liên kết YouTube hoặc Vimeo (https).');
  }
  if (draft.format === 'video' && !draft.videoUrl) {
    issues.push('Bài dạng video cần liên kết video.');
  }
  if (draft.seoTitle && draft.seoTitle.length > 70) {
    issues.push('Tiêu đề tìm kiếm tối đa 70 ký tự.');
  }
  if (draft.seoDescription && draft.seoDescription.length > 160) {
    issues.push('Mô tả tìm kiếm tối đa 160 ký tự.');
  }

  if (draft.status === 'draft') return issues;

  if (draft.lede.trim().length < 20 || draft.lede.trim().length > 300) {
    issues.push('Đoạn dẫn cần từ 20 đến 300 ký tự trước khi đăng.');
  }
  if (draft.body.trim().length < 180) {
    issues.push('Nội dung cần ít nhất 180 ký tự trước khi đăng.');
  }
  if (!hasInternalLink(draft.body)) {
    issues.push('Bài cần một liên kết nội bộ tới /nha-dat, /phap-ly hoặc /bai-viet/.');
  }
  if (!draft.publishedAt) {
    issues.push('Cần thời điểm đăng.');
  } else if (draft.status === 'scheduled' && draft.publishedAt.getTime() <= now.getTime()) {
    issues.push('Giờ hẹn phải ở phía sau.');
  }

  return issues;
}

/**
 * Liên kết nhúng an toàn cho video: chỉ YouTube (bản không cookie) và Vimeo, mã video kiểm tra chặt.
 * Trả null nếu không phải liên kết được hỗ trợ.
 */
export function videoEmbedUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  let youtube: string | null = null;
  if (host === 'youtu.be') youtube = url.pathname.slice(1);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    youtube = url.pathname === '/watch' ? url.searchParams.get('v') : (/^\/(embed|shorts|live)\/([^/]+)/.exec(url.pathname)?.[2] ?? null);
  }
  if (youtube !== null) return /^[A-Za-z0-9_-]{11}$/.test(youtube) ? `https://www.youtube-nocookie.com/embed/${youtube}` : null;
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = /(\d{6,12})/.exec(url.pathname)?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

function isCoverImage(value: string): boolean {
  if (value.startsWith('/images/') && !value.includes('..')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function hasInternalLink(body: string): boolean {
  return /\]\((\/nha-dat|\/phap-ly|\/bai-viet\/)/.test(body);
}

/** Bình luận là văn bản thuần: bỏ ký tự điều khiển, gộp dòng trống thừa, cắt hai đầu. */
export function cleanCommentBody(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
