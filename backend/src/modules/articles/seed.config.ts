import type { ArticleTopic } from './article-rules.js';

export type SeedArticle = {
  slug: string;
  title: string;
  lede: string;
  topic: ArticleTopic;
  publishedAt: string;
  coverImage: string;
  body: string;
};

export const SEED_ARTICLES: readonly SeedArticle[] = [
  {
    slug: 'ban-kinh-500-met',
    title: 'Bán kính 500 mét đang đo cái gì',
    lede: 'Vòng tròn quanh ghim là đường chim bay, không phải quãng đi bộ qua ngõ.',
    topic: 'cach-doc',
    publishedAt: '2026-10-12T01:00:00.000Z',
    coverImage: '/images/temp-002.jpg',
    body: [
      'Khi bạn ghim một điểm, vòng 500 mét là đường thẳng trên bản đồ. Nó không đo phút đi bộ và không biết ngõ cụt hay đường lớn chắn lối.',
      'Đọc vòng tròn trước khi đọc số tiện ích. Một hiệu thuốc nằm trong vòng vẫn có thể phải vòng qua ngã tư. Một ga nằm sát mép vòng chưa nói được lối vào.',
      'Muốn đối chiếu với một tin đang rao, mở [danh sách nhà đất](/nha-dat) và kéo ghim đúng ô đất của tin đó. Báo cáo bám ghim, không bám câu địa chỉ.',
    ].join('\n\n'),
  },
  {
    slug: 'ghim-lech',
    title: 'Ghim lệch thì mọi khoảng cách lệch theo',
    lede: 'Địa chỉ chỉ đưa tới gần. Báo cáo bám ô đất bạn kéo ghim tới.',
    topic: 'cach-doc',
    publishedAt: '2026-10-02T01:00:00.000Z',
    coverImage: '/images/temp-003.jpg',
    body: [
      'Ô tìm địa chỉ mở đúng khu, nhất là ở Hà Nội. Với ngõ, điểm rơi có thể lệch vài chục đến vài trăm mét. Lệch ghim là lệch mọi khoảng cách phía sau, từ hiệu thuốc tới mép hồ.',
      'Kéo ghim vào đúng ô đất rồi mới đọc. Chuỗi chữ trên biển số nhà không phải tọa độ của thửa.',
      'Cách trang ghi các giới hạn này nằm trong [tài liệu pháp lý](/phap-ly). Đọc phần tuyên bố dữ liệu trước khi dùng một con số để quyết định.',
    ].join('\n\n'),
  },
  {
    slug: 'khung-gia',
    title: 'Khung giá không phải giá bán',
    lede: 'Đó là khoảng ước lượng khi đủ dữ liệu, không phải số chủ nhà đang chào.',
    topic: 'gia',
    publishedAt: '2026-08-21T01:00:00.000Z',
    coverImage: '/images/temp-004.jpg',
    body: [
      'Khung giá là một khoảng, không phải một mức chủ nhà đang chào và không phải giá giao dịch. Thiếu pháp lý hoặc mặt tiền thì khoảng rộng ra, hoặc trang không kết luận.',
      'Gói miễn phí và gói không giới hạn lượt chưa mở bước này. Gói có định giá, hoặc một lượt 10.000 đồng, mới mở. Giá trên bảng là số tiền phải trả cho gói, không phải giá căn nhà.',
      'Xem điều kiện trong [tài liệu về giá và thanh toán](/phap-ly) trước khi kỳ vọng một con số chốt. Trang không bịa thêm nguồn khi dữ liệu chưa có.',
    ].join('\n\n'),
  },
];
