export type Side = 'a' | 'b';

export interface SeedMessage {
  from: Side;
  /** Phút trước thời điểm khởi động; số lớn hơn là cũ hơn. */
  ago: number;
  text?: string;
  /** Trả lời tin thứ n (đếm từ 1) trong cùng hội thoại. */
  reply?: number;
  reactions?: Array<[Side, string]>;
  /** Chia sẻ một bài ở diễn đàn (lấy bài hiển thị mới nhất). */
  share?: boolean;
  /** Tin đã thu hồi. */
  unsent?: boolean;
}

export interface SeedConversation {
  a: string;
  b: string;
  state?: 'pending' | 'active';
  /** Số tin cuối chưa đọc của mỗi phía. */
  unread?: Partial<Record<Side, number>>;
  mutedBy?: Side;
  messages: SeedMessage[];
}

const H = 60;
const D = 24 * 60;

export const SEED_CONVERSATIONS: SeedConversation[] = [
  {
    a: 'user@email.com',
    b: 'lan-anh@email.com',
    messages: [
      { from: 'a', ago: 3 * D + 5 * H, text: 'Chào Lan Anh, mình thấy bạn hay hỏi về ngõ quanh phố cổ. Bạn đã xem căn ở Hàng Bông chưa?' },
      { from: 'b', ago: 3 * D + 4 * H, text: 'Chào bạn! Mình xem rồi, ngõ rộng khoảng 3 mét, ô tô nhỏ vào được.', reactions: [['a', '👍']] },
      { from: 'b', ago: 3 * D + 4 * H - 1, text: 'Nhưng giờ cao điểm thì khá đông, bạn nên đi vào buổi tối.' },
      { from: 'a', ago: 3 * D + 3 * H, text: 'Cảm ơn bạn. Còn giá thì sao, chủ nhà có thương lượng không?', reply: 2 },
      { from: 'b', ago: 3 * D + 2 * H, text: 'Mình nghe nói có thể bớt khoảng 3 đến 5% nếu thanh toán nhanh.' },
      { from: 'a', ago: 2 * D + 6 * H, text: 'Hay quá. Mình gửi bạn bài này ở diễn đàn, có người phân tích khung giá khá kỹ.' },
      { from: 'a', ago: 2 * D + 6 * H - 1, share: true },
      { from: 'b', ago: 2 * D + 5 * H, text: 'Mình đọc rồi, hữu ích thật.', reactions: [['a', '❤️']] },
      { from: 'b', ago: 1 * D + 3 * H, text: 'Mai mình hẹn xem nhà lúc 9 giờ, bạn đi cùng không?' },
      { from: 'a', ago: 1 * D + 2 * H, text: 'Đi chứ! Hẹn gặp ở đầu ngõ nhé.', reply: 9 },
      { from: 'b', ago: 1 * D + 2 * H - 2, text: 'Ok bạn. Mình gửi nhầm một tin lúc nãy nên thu hồi.', },
      { from: 'b', ago: 1 * D + 2 * H - 3, text: 'Địa chỉ nhầm, bỏ qua nhé.', unsent: true },
      { from: 'b', ago: 40, text: 'Mình tới sớm rồi, đang đứng ở đầu ngõ. Bạn tới chưa?' },
      { from: 'b', ago: 12, text: 'Nhà này ánh sáng tốt hơn mình nghĩ, tầng 3 còn có ban công 😀' },
    ],
    unread: { a: 2 },
  },
  {
    a: 'user@email.com',
    b: 'minh-duc@email.com',
    messages: [
      { from: 'b', ago: 5 * D, text: 'Chào bạn, mình thấy bạn trả lời bài về Hồ Tây. Bạn ở khu đó lâu chưa?' },
      { from: 'a', ago: 5 * D - 30, text: 'Mình ở gần 4 năm rồi. Khu kè hồ yên tĩnh, nhưng mùa mưa một số ngõ hay ngập.' },
      { from: 'b', ago: 5 * D - 90, text: 'Cảm ơn bạn, đúng thứ mình cần biết.', reactions: [['a', '🙏']] },
      { from: 'b', ago: 2 * H, text: 'Bạn có biết văn phòng công chứng nào gần Quảng An không?' },
    ],
    unread: { a: 1 },
  },
  {
    a: 'ha-my@email.com',
    b: 'user@email.com',
    state: 'pending',
    unread: { b: 1 },
    messages: [
      { from: 'a', ago: 3 * H, text: 'Chào anh/chị, em đang tìm căn hộ gần đường Láng. Em xin phép hỏi anh/chị một chút về khu này được không ạ?' },
    ],
  },
  {
    a: 'user@email.com',
    b: 'quoc-bao@email.com',
    state: 'pending',
    messages: [
      { from: 'a', ago: 1 * D + 4 * H, text: 'Chào Quốc Bảo, mình thấy bạn hay so sánh giá nhà mặt phố. Bạn cho mình hỏi cách bạn lấy mốc giá với?' },
    ],
  },
  {
    a: 'lan-anh@email.com',
    b: 'minh-duc@email.com',
    messages: [
      { from: 'a', ago: 4 * D, text: 'Chào Minh Đức, bạn còn nhà nào gần Hồ Hoàn Kiếm không?' },
      { from: 'b', ago: 4 * D - 20, text: 'Còn một căn tầng 4, 55 m², hướng đông nam. Mình gửi thông tin sau nhé.' },
      { from: 'a', ago: 4 * D - 25, text: 'Ok bạn, cảm ơn.', reactions: [['b', '👍']] },
    ],
  },
  {
    a: 'thu-ha@email.com',
    b: 'lan-anh@email.com',
    state: 'pending',
    unread: { b: 1 },
    messages: [
      { from: 'a', ago: 20 * H, text: 'Chào chị, em là Thu Hà. Em thấy chị trả lời bài về giá nhà. Em nhờ chị góp ý giúp em một căn ở Mỹ Đình với ạ.' },
    ],
  },
  {
    a: 'user@email.com',
    b: 'duc-anh@email.com',
    mutedBy: 'a',
    messages: [
      { from: 'b', ago: 6 * D, text: 'Chào bạn, mình mới đăng ký dùng thử gói định giá. Bạn dùng thấy thế nào?' },
      { from: 'a', ago: 6 * D - 40, text: 'Mình thấy khung giá khá sát, nhưng nhớ đối chiếu thêm tin rao quanh khu đó.' },
      { from: 'b', ago: 6 * D - 60, text: 'Mình hiểu rồi, cảm ơn bạn nhiều!' },
    ],
  },
];

// Hội thoại của tài khoản quản trị (xem ở /admin/messages).
const ADMIN = 'admin@email.com';

export const SEED_ADMIN_CONVERSATIONS: SeedConversation[] = [
  {
    a: 'user@email.com',
    b: ADMIN,
    unread: { b: 2 },
    messages: [
      { from: 'a', ago: 2 * D + 3 * H, text: 'Chào quản trị viên, bài của mình ở diễn đàn bị ẩn mà mình không rõ lý do. Bạn xem giúp mình được không?' },
      { from: 'b', ago: 2 * D + 2 * H, text: 'Chào bạn. Mình đã kiểm tra: bài có chứa số điện thoại cá nhân nên bị ẩn theo quy định. Bạn có thể đăng lại sau khi bỏ số.' },
      { from: 'a', ago: 2 * D + 1 * H, text: 'À mình hiểu rồi, cảm ơn bạn đã giải thích.', reactions: [['b', '👍']] },
      { from: 'a', ago: 5 * H, text: 'Mình đã đăng lại bài, bạn xem giúp xem đã đúng chưa nhé.' },
      { from: 'a', ago: 5 * H - 2, text: 'Link bài: https://example.com/feed/bai-moi', reply: 4 },
    ],
  },
  {
    a: 'thu-ha@email.com',
    b: ADMIN,
    state: 'pending',
    unread: { b: 1 },
    messages: [
      { from: 'a', ago: 4 * H, text: 'Chào anh/chị, em muốn hỏi gói định giá có dùng thử miễn phí không ạ? Em đã thử 3 lượt phân tích.' },
    ],
  },
  {
    a: ADMIN,
    b: 'lan-anh@email.com',
    messages: [
      { from: 'b', ago: 3 * D + 6 * H, text: 'Chào admin, mình muốn đề xuất thêm chủ đề "Căn hộ chung cư" cho diễn đàn.' },
      { from: 'a', ago: 3 * D + 5 * H, text: 'Cảm ơn Lan Anh. Ý tưởng hay, mình sẽ trao đổi với nhóm và báo lại bạn.' },
      { from: 'a', ago: 3 * D + 5 * H - 1, share: true },
      { from: 'b', ago: 3 * D + 4 * H, text: 'Mình thấy bài này đang hỏi đúng chủ đề đó đó ạ.', reply: 3, reactions: [['a', '❤️']] },
      { from: 'a', ago: 1 * D, text: 'Đã mở chủ đề mới rồi, bạn vào thử nhé!' },
      { from: 'b', ago: 1 * D - 30, text: 'Tuyệt vời, cảm ơn admin 🙏' },
    ],
  },
  {
    a: ADMIN,
    b: 'duc-anh@email.com',
    state: 'pending',
    messages: [
      { from: 'a', ago: 1 * D + 2 * H, text: 'Chào Đức Anh, mình là quản trị viên. Bạn vừa báo lỗi định giá, mình cần thêm ảnh chụp màn hình để kiểm tra, bạn gửi giúp nhé.' },
    ],
  },
  {
    a: 'ha-my@email.com',
    b: ADMIN,
    mutedBy: 'b',
    messages: [
      { from: 'a', ago: 8 * D, text: 'Chào admin, mình không đăng nhập được bằng Google từ hôm qua.' },
      { from: 'b', ago: 8 * D - 60, text: 'Chào Hà My, bạn thử đăng nhập lại bằng email và mật khẩu, hoặc dùng chức năng quên mật khẩu nhé.' },
      { from: 'a', ago: 8 * D - 90, text: 'Được rồi ạ, em cảm ơn.' },
    ],
  },
  {
    a: 'quoc-bao@email.com',
    b: ADMIN,
    unread: { b: 2 },
    messages: [
      { from: 'a', ago: 90, text: 'Admin ơi, mình thấy một tin rao có dấu hiệu giả mạo ảnh, mình nên báo ở đâu?' },
      { from: 'a', ago: 85, text: 'Tin ở khu Mỹ Đình, giá thấp hơn thị trường khá nhiều.' },
    ],
  },
];
