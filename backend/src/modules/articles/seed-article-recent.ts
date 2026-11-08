import type { ArticleFormat, ArticleTopic } from './article-rules.js';

/**
 * Bài mẫu "gần đây" cho trang /bai-viet ở máy dev: ngày đăng tính lùi từ lúc seed chạy lần đầu (giờ trước), nên mục
 * Mới nhất, Nổi bật 7 ngày và khối theo chủ đề luôn có bài mới để xem thử. Trộn bài có ảnh bìa, bài chỉ có chữ, bài
 * dạng Ảnh và bài dài/ngắn để các bố cục được thử với nội dung đa dạng.
 */
export type RecentSeed = {
  slug: string;
  title: string;
  lede: string;
  topic: ArticleTopic;
  /** Đăng cách lúc seed bao nhiêu giờ. */
  hoursAgo: number;
  /** null: bài không có ảnh bìa. */
  cover: string | null;
  format?: ArticleFormat;
  /** Bài dài: thêm các mục phân tích để thời gian đọc dài hơn. */
  long?: boolean;
};

const A = '/images/temp-001.png';
const B = '/images/temp-002.jpg';
const C = '/images/temp-003.jpg';
const D = '/images/temp-004.jpg';

export const RECENT_SEEDS: readonly RecentSeed[] = [
  { slug: 'tuyen-metro-moi-va-ban-kinh', title: 'Tuyến metro mới chưa đổi được phút đi bộ', lede: 'Ga vừa mở nằm trong vòng 1 km, nhưng cửa lên gần nhất vẫn cách hơn hai ngã tư.', topic: 'khu-vuc', hoursAgo: 2, cover: B, long: true },
  { slug: 'gia-chao-thang-11', title: 'Giá chào tháng 11 dao động ra sao quanh các trục lớn', lede: 'Tin rao ven trục chính chênh nhau tới 30% chỉ trong một đoạn phố, phần lớn vì mặt tiền và pháp lý.', topic: 'gia', hoursAgo: 5, cover: D, format: 'photo' },
  { slug: 'lop-tien-ich-cap-nhat', title: 'Lớp tiện ích vừa cập nhật: thêm 1.200 điểm, bỏ 340 điểm đã đóng', lede: 'Bản cập nhật tháng này làm thay đổi số đếm ở nhiều khu nội đô. Đây là những gì nên xem lại.', topic: 'du-lieu', hoursAgo: 9, cover: null },
  { slug: 'doc-bao-cao-trong-5-phut', title: 'Đọc một báo cáo địa điểm trong 5 phút', lede: 'Thứ tự đọc giúp bạn không bị cuốn vào tổng số đếm: ghim, bán kính, điểm gần nhất, rồi mới đến tổng.', topic: 'cach-doc', hoursAgo: 14, cover: C },
  { slug: 'ngo-sau-va-xe-cuu-hoa', title: 'Ngõ sâu, xe cứu hỏa và những thứ bản đồ không vẽ', lede: 'Bề rộng ngõ không có trong lớp dữ liệu nào của trang. Hãy đo nó khi đi xem nhà.', topic: 'khu-vuc', hoursAgo: 20, cover: A, format: 'photo' },
  { slug: 'khung-gia-rong-bat-thuong', title: 'Khi khung giá rộng bất thường', lede: 'Một khoảng ước lượng rộng gấp đôi khu bên cạnh thường là dấu hiệu dữ liệu so sánh còn mỏng.', topic: 'gia', hoursAgo: 27, cover: null, long: true },
  { slug: 'so-sanh-ba-dia-diem', title: 'So sánh ba địa điểm mà không tự đánh lừa mình', lede: 'Bảng so sánh chỉ công bằng khi các địa điểm cùng bán kính, cùng tiêu chí và cùng trọng số.', topic: 'cach-doc', hoursAgo: 33, cover: B },
  { slug: 'du-lieu-mo-thieu-diem-moi', title: 'Dữ liệu mở hay thiếu những điểm vừa khai trương', lede: 'Quán mở tuần trước có thể chưa có trên bản đồ cộng đồng. Đừng coi khoảng trống là không có.', topic: 'du-lieu', hoursAgo: 41, cover: D },
  { slug: 'ven-song-va-cau', title: 'Ven sông: gần trên bản đồ, xa khi phải tìm cầu', lede: 'Bên kia sông có thể chỉ cách 300 mét đường chim bay nhưng gần 3 km đường đi.', topic: 'khu-vuc', hoursAgo: 52, cover: C, format: 'photo', long: true },
  { slug: 'chi-phi-an-sau-gia', title: 'Chi phí nằm ngoài giá chào', lede: 'Phí sang tên, sửa chữa và thời gian chờ hồ sơ không có trong con số trên tin rao.', topic: 'gia', hoursAgo: 60, cover: null },
  { slug: 'tieu-chi-trong-so', title: 'Trọng số tiêu chí thay đổi kết quả thế nào', lede: 'Đặt nặng trường học hay chợ có thể đảo thứ hạng hai địa điểm. Hãy thử trước khi chốt.', topic: 'cach-doc', hoursAgo: 75, cover: A },
  { slug: 'ngay-cap-nhat-tung-lop', title: 'Mỗi lớp dữ liệu có một ngày cập nhật riêng', lede: 'Lớp giá có thể cũ hơn lớp tiện ích vài tháng. Ngày nằm ngay cạnh con số, hãy đọc nó.', topic: 'du-lieu', hoursAgo: 90, cover: null },
  { slug: 'khu-cong-nghiep-gio-cao-diem', title: 'Gần khu công nghiệp: đẹp lúc 10 giờ, kẹt lúc 17 giờ', lede: 'Bản đồ không biết giờ tan ca. Ghé khu này vào hai khung giờ trước khi quyết định.', topic: 'khu-vuc', hoursAgo: 110, cover: B, format: 'photo' },
  { slug: 'gia-giao-dich-va-gia-chao', title: 'Giá giao dịch thường thấp hơn giá chào bao nhiêu', lede: 'Khoảng chênh thay đổi theo khu và theo thời điểm. Trang đặt hai nguồn cạnh nhau để bạn tự thấy.', topic: 'gia', hoursAgo: 130, cover: C, long: true },
  { slug: 'ghim-tren-mai-nha', title: 'Đặt ghim trên mái nhà hay ở cổng?', lede: 'Với nhà sâu trong ngõ, vài chục mét lệch ghim đủ đổi tiện ích gần nhất.', topic: 'cach-doc', hoursAgo: 150, cover: null },
  { slug: 'benh-vien-trong-vong-tron', title: 'Bệnh viện trong vòng tròn chưa chắc là cổng cấp cứu', lede: 'Khu khám bệnh, cổng cấp cứu và bãi gửi xe thường nằm ở ba phía khác nhau.', topic: 'khu-vuc', hoursAgo: 170, cover: D },
  { slug: 'nguon-du-lieu-quy-hoach', title: 'Dữ liệu quy hoạch: đọc ngày ban hành trước', lede: 'Một lớp quy hoạch cũ có thể đã được điều chỉnh. Trang ghi rõ nguồn và ngày ban hành.', topic: 'du-lieu', hoursAgo: 200, cover: A, format: 'photo' },
  { slug: 'mua-de-o-hay-de-cho-thue', title: 'Mua để ở hay để cho thuê đọc báo cáo khác nhau', lede: 'Người ở cần trường và chợ; người cho thuê cần ga, văn phòng và quán ăn khuya.', topic: 'cach-doc', hoursAgo: 240, cover: B, long: true },
  { slug: 'gia-theo-tang', title: 'Căn hộ: giá theo tầng có thật sự tuyến tính?', lede: 'Tầng cao thường đắt hơn, nhưng tầng sát mái và tầng thấp gần đường lớn có quy luật riêng.', topic: 'gia', hoursAgo: 280, cover: null },
  { slug: 'cong-vien-va-mat-do', title: 'Một công viên lớn hay mười vườn hoa nhỏ', lede: 'Số đếm tiện ích xanh không nói được diện tích. Hãy nhìn bản đồ trước khi tin con số.', topic: 'khu-vuc', hoursAgo: 330, cover: C, format: 'photo' },
  { slug: 'sai-so-toa-do', title: 'Sai số tọa độ: vì sao điểm nhảy vài mét', lede: 'Tọa độ từ địa chỉ, từ GPS điện thoại và từ bản đồ nền có thể lệch nhau.', topic: 'du-lieu', hoursAgo: 380, cover: null, long: true },
  { slug: 'xem-nha-luc-troi-mua', title: 'Xem nhà lúc trời mưa', lede: 'Ngập cục bộ không có trên bản đồ tiện ích. Một buổi mưa cho biết nhiều điều.', topic: 'khu-vuc', hoursAgo: 430, cover: D, format: 'photo' },
  { slug: 'dat-coc-truoc-khi-doc', title: 'Đừng đặt cọc trước khi đọc phần giới hạn', lede: 'Mọi báo cáo đều có phần nói rõ những gì nó không đo. Phần đó quan trọng như con số.', topic: 'gia', hoursAgo: 500, cover: A },
  { slug: 'ban-kinh-1km-hay-500m', title: 'Chọn bán kính 500 mét hay 1 km', lede: 'Đi bộ, xe máy hay ô tô cho ra ba vùng sống khác nhau quanh cùng một ghim.', topic: 'cach-doc', hoursAgo: 560, cover: B },
  { slug: 'diem-dong-cua-van-hien', title: 'Điểm đã đóng cửa vẫn hiện: báo lỗi thế nào', lede: 'Mỗi báo lỗi được đối chiếu trước khi sửa lớp dữ liệu. Đây là cách gửi báo lỗi có ích.', topic: 'du-lieu', hoursAgo: 640, cover: null },
  { slug: 'pho-di-bo-cuoi-tuan', title: 'Phố đi bộ cuối tuần đổi nhịp cả khu', lede: 'Ồn ào hai ngày cuối tuần, yên tĩnh năm ngày còn lại. Báo cáo chỉ thấy một bản đồ.', topic: 'khu-vuc', hoursAgo: 720, cover: C, format: 'photo' },
  { slug: 'gia-thue-va-gia-ban', title: 'Tỷ suất cho thuê: phép chia đơn giản dễ nhầm', lede: 'Chia giá thuê cho giá chào cho ra con số đẹp hơn thực tế. Hãy dùng giá giao dịch.', topic: 'gia', hoursAgo: 800, cover: null, long: true },
  { slug: 'doc-ban-do-nhiet', title: 'Đọc bản đồ nhiệt mật độ tiện ích', lede: 'Màu đậm là nhiều điểm, không phải điểm tốt. Thang màu luôn nằm ở góc bản đồ.', topic: 'cach-doc', hoursAgo: 900, cover: D },
  { slug: 'dan-so-va-tien-ich', title: 'Tiện ích tính trên đầu người khác tổng số đếm', lede: 'Mười trường học cho 5.000 người khác mười trường cho 50.000 người.', topic: 'du-lieu', hoursAgo: 1000, cover: A },
  { slug: 'hem-xe-hoi', title: 'Hẻm xe hơi: định nghĩa mỗi nơi một kiểu', lede: 'Tin rao ghi "hẻm xe hơi" nhưng xe vào được tới đâu thì phải tự đi thử.', topic: 'khu-vuc', hoursAgo: 1150, cover: B },
  { slug: 'lich-su-gia-mot-khu', title: 'Lịch sử giá một khu: đọc xu hướng, đừng đọc điểm', lede: 'Một giao dịch lớn có thể kéo trung bình tháng lên cao. Nhìn đường xu hướng nhiều tháng.', topic: 'gia', hoursAgo: 1300, cover: C, format: 'photo' },
  { slug: 'mau-tieu-chi-trong-bao-cao', title: 'Màu xanh, vàng, đỏ trong báo cáo nghĩa là gì', lede: 'Màu là mức so với các khu lân cận, không phải đánh giá tốt hay xấu tuyệt đối.', topic: 'cach-doc', hoursAgo: 1440, cover: null },
];

/** Các mục phân tích thêm cho bài dài, theo chủ đề. */
export const LONG_SECTIONS: Record<ArticleTopic, string> = {
  'cach-doc': `## Một ví dụ đọc từ đầu tới cuối

Bắt đầu bằng việc phóng to bản đồ tới mức thấy được mái nhà. Kéo ghim vào đúng ô đất, không phải giữa đường. Sau đó chọn bán kính theo cách bạn đi lại hằng ngày.

Tiếp theo, đọc tiện ích gần nhất của từng nhóm trước tổng số đếm. Tổng số đếm dễ gây ấn tượng nhưng ít khi trả lời câu hỏi "sáng mai đi đâu mua đồ ăn".

Cuối cùng, mở phần giới hạn của báo cáo. Phần đó nói những gì trang không đo được, và thường là những thứ bạn cần tự kiểm tra khi đi xem nhà.`,
  'khu-vuc': `## Đi thử một vòng

Không có lớp dữ liệu nào thay được một vòng đi bộ thật. Chọn hai khung giờ: một buổi sáng ngày thường và một buổi tối cuối tuần.

Ghi lại thời gian đi từ cửa nhà tới ba điểm bạn sẽ dùng nhiều nhất. So với khoảng cách chim bay trong báo cáo, bạn sẽ thấy hệ số chênh của khu đó.

Hệ số này khác nhau giữa các khu: khu ô bàn cờ thường chênh ít, khu nhiều ngõ cụt hoặc bị sông, đường sắt cắt ngang chênh nhiều.`,
  gia: `## Đặt ba con số cạnh nhau

Giá chào là số chủ nhà mong muốn. Giá giao dịch là số đã trả thật, thường có độ trễ vài tuần tới vài tháng. Khung giá là khoảng ước lượng khi đủ dữ liệu so sánh.

Khi ba con số gần nhau, thị trường khu đó tương đối minh bạch. Khi chúng xa nhau, hãy tìm lý do: pháp lý, mặt tiền, hướng nhà hay đơn giản là ít giao dịch.

Đừng lấy trung bình của ba con số. Mỗi con số trả lời một câu hỏi khác nhau.`,
  'du-lieu': `## Kiểm tra một lớp dữ liệu

Mở phần nguồn của lớp đó và đọc ngày cập nhật. Chọn ba điểm bạn biết rõ trong khu và đối chiếu: còn hoạt động không, đúng vị trí không, đúng nhóm không.

Nếu cả ba đều đúng, lớp dữ liệu khu đó đáng tin ở mức tham khảo. Nếu có điểm sai, hãy gửi báo lỗi kèm ảnh hoặc liên kết để đội ngũ đối chiếu.

Dữ liệu tốt lên nhờ những báo lỗi cụ thể, không nhờ những đánh giá chung chung.`,
};

/** Bình luận mẫu (theo chủ đề) cho các bài được tương tác nhiều ở máy dev. */
export const SEED_COMMENTS: Record<ArticleTopic, readonly string[]> = {
  'cach-doc': [
    'Mình từng tin tổng số tiện ích, đọc xong mới hiểu phải nhìn điểm gần nhất trước.',
    'Có cách nào lưu cài đặt bán kính mặc định không ạ? Mình hay dùng 1 km.',
    'Bài dễ hiểu, gửi cho bố mẹ đọc trước khi đi xem nhà cuối tuần này.',
    'Phần giới hạn báo cáo nên để nổi bật hơn, nhiều người bỏ qua lắm.',
  ],
  'khu-vuc': [
    'Đúng thật, nhà mình cách ga 400 m chim bay mà đi bộ gần 15 phút.',
    'Khu mình ngập mỗi lần mưa to, bản đồ không thể hiện được điều này.',
    'Ước gì có lớp dữ liệu về vỉa hè và đèn đường.',
    'Mẹo đi thử hai khung giờ rất hay, mình phát hiện khu đó tối rất vắng.',
  ],
  gia: [
    'Giá chào khu mình cao hơn giao dịch khoảng 15%, khớp với bài.',
    'Phí sang tên nhiều người quên tính, cảm ơn bài viết.',
    'Khung giá rộng quá thì nên tham khảo thêm ở đâu ạ?',
    'Bài nên có thêm ví dụ với nhà trong hẻm.',
  ],
  'du-lieu': [
    'Mình đã báo lỗi một tiệm thuốc đóng cửa, hai hôm sau đã được sửa.',
    'Ngày cập nhật để cạnh con số là rất hợp lý.',
    'Dữ liệu mở thiếu nhiều quán mới ở khu mình, mong được bổ sung.',
    'Có thể xuất dữ liệu ra bảng tính không?',
  ],
};
