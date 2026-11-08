import { describe, expect, it } from 'vitest';
import {
  articleIssues,
  cleanCommentBody,
  foldText,
  likePattern,
  slugifyTitle,
  type ArticleDraft,
} from './article-rules.js';

function draft(overrides: Partial<ArticleDraft> = {}): ArticleDraft {
  return {
    title: 'Bán kính 500 mét đang đo cái gì',
    slug: 'ban-kinh-500-met',
    lede: 'Vòng tròn quanh ghim là đường chim bay, không phải quãng đi bộ qua ngõ.',
    body: 'Đọc bán kính trước khi kết luận về một ô đất. Vòng tròn là đường chim bay, nên một cửa hàng trong vòng vẫn có thể khuất sau ngõ. Xem thêm trên [danh sách nhà](/nha-dat) khi cần một điểm cụ thể để đối chiếu.',
    topic: 'cach-doc',
    status: 'published',
    publishedAt: new Date('2026-10-12T00:00:00.000Z'),
    coverImage: '/images/temp-002.jpg',
    seoTitle: null,
    seoDescription: null,
    format: 'standard',
    videoUrl: null,
    ...overrides,
  };
}

describe('article rules', () => {
  it('bỏ dấu khi tạo slug và chuỗi tìm', () => {
    expect(slugifyTitle('Hồ Tây: đi bộ')).toBe('ho-tay-di-bo');
    expect(foldText('Khung giá')).toBe('khung gia');
    expect(likePattern('100%')).toBe('%100\\%%');
  });

  it('cho đăng khi đủ đoạn dẫn, nội dung và liên kết nội bộ', () => {
    expect(articleIssues(draft())).toEqual([]);
  });

  it('giữ lỗi khi bài đăng thiếu liên kết nội bộ', () => {
    const issues = articleIssues(draft({ body: 'Chỉ một đoạn đủ dài để qua ngưỡng ký tự nhưng không trỏ tới trang nào trong site nên chưa được đăng.' }));
    expect(issues.some((issue) => issue.includes('liên kết nội bộ'))).toBe(true);
  });

  it('cho nháp ngắn', () => {
    expect(articleIssues(draft({ status: 'draft', body: 'Nháp', lede: '' }))).toEqual([]);
  });
});

describe('cleanCommentBody', () => {
  it('bỏ ký tự điều khiển, gộp dòng trống và cắt hai đầu', () => {
    expect(cleanCommentBody('  xin\u0000 chào\r\n\r\n\r\n\r\nbạn  ')).toBe('xin chào\n\nbạn');
  });
  it('chuỗi chỉ có khoảng trắng thành rỗng', () => {
    expect(cleanCommentBody(' \n\t ')).toBe('');
  });
});

describe('liên kết video nhúng', () => {
  it('chỉ nhận YouTube/Vimeo https với mã hợp lệ', async () => {
    const { videoEmbedUrl } = await import('./article-rules.js');
    expect(videoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(videoEmbedUrl('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(videoEmbedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(videoEmbedUrl('https://vimeo.com/76979871')).toBe('https://player.vimeo.com/video/76979871');
    expect(videoEmbedUrl('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(videoEmbedUrl('https://evil.example/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(videoEmbedUrl('https://youtu.be/abc"><script>')).toBeNull();
    expect(videoEmbedUrl('javascript:alert(1)')).toBeNull();
  });

  it('bài dạng video bắt buộc có liên kết hợp lệ', () => {
    expect(articleIssues(draft({ format: 'video', videoUrl: null }))).toContain('Bài dạng video cần liên kết video.');
    expect(articleIssues(draft({ format: 'video', videoUrl: 'https://example.com/a.mp4' }))).toContain('Video phải là liên kết YouTube hoặc Vimeo (https).');
  });
});
