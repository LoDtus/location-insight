import type { ArticleTopic } from './article-rules.js';

/**
 * Nội dung mẫu (Markdown) cho bài seed ở máy dev. Mỗi bài dùng một kiểu bố cục khác nhau để xem được đủ khối
 * mà trang bài viết hiển thị: tiêu đề mục h2/h3 (mục lục), danh sách gạch đầu dòng và đánh số, trích dẫn,
 * đường kẻ, chữ đậm/nghiêng/gạch ngang, liên kết nội bộ. Bài không có tiêu đề mục để xem trang khi không có mục lục.
 */

const HAND_WRITTEN: Record<string, string> = {
  'ban-kinh-500-met': `Khi bạn ghim một điểm, vòng 500 mét là **đường thẳng trên bản đồ**. Nó không đo phút đi bộ và không biết ngõ cụt hay đường lớn chắn lối.

Đọc vòng tròn trước khi đọc số tiện ích. Một hiệu thuốc nằm trong vòng vẫn có thể phải vòng qua ngã tư. Một ga nằm sát mép vòng chưa nói được lối vào.

## Vòng tròn đo gì, không đo gì

Bán kính là khoảng cách chim bay từ ghim tới từng điểm. Phép đo này nhanh, ổn định và so sánh được giữa hai địa điểm. Đổi lại, nó bỏ qua mọi thứ nằm giữa hai đầu đoạn thẳng.

Những thứ vòng tròn **có** cho biết:

- Có bao nhiêu tiện ích thuộc từng nhóm trong phạm vi đã chọn.
- Tiện ích gần nhất của mỗi nhóm cách ghim bao xa theo đường thẳng.
- Mật độ tiện ích dày hay thưa so với các khu lân cận.

Những thứ vòng tròn **không** cho biết:

- Quãng đi bộ thật, số lần sang đường hay thời gian chờ đèn.
- Cổng vào, giờ mở cửa và việc nơi đó còn hoạt động hay không.
- Cảm giác an toàn khi đi bộ buổi tối.

## Ba tình huống hay đọc nhầm

### Hiệu thuốc bên kia đường lớn

Trên bản đồ, hiệu thuốc cách ghim 180 mét. Ngoài thực tế, giữa hai điểm là một trục sáu làn có dải phân cách, lối sang gần nhất ở nút giao cách đó 400 mét. Quãng đi bộ vì thế dài gần gấp ba.

### Ga nằm sát mép vòng

Một ga cách ghim 480 mét vẫn được đếm là "trong vòng 500 mét". Nhưng nếu cửa lên ga nằm ở phía xa, quãng tới cửa có thể vượt 700 mét. Hãy mở bản đồ và tìm *lối vào*, không chỉ tìm chấm của ga.

### Công viên sau dãy nhà liền kề

Mép công viên chỉ cách 120 mét, nhưng dãy nhà liền kề không có ngõ xuyên. Đường tới cổng công viên phải vòng hết dãy phố.

> Vòng tròn trả lời câu "có gì quanh đây". Còn câu "đi tới đó mất bao lâu" thì phải tự kiểm tra trên đường.

## Cách đọc báo cáo trong năm bước

1. Kéo ghim vào **đúng ô đất**, không dừng ở điểm rơi của ô tìm địa chỉ.
2. Chọn bán kính theo cách đi lại: 500 mét cho đi bộ, 1–2 km cho xe máy.
3. Xem tiện ích gần nhất của từng nhóm trước, tổng số đếm sau.
4. Với điểm sát mép vòng, mở bản đồ để xem có sông, đường lớn hay ngõ cụt chắn giữa không.
5. Đối chiếu với tin đang rao trước khi dùng con số để quyết định.

---

Muốn đối chiếu với một tin đang rao, mở [danh sách nhà đất](/nha-dat) và kéo ghim đúng ô đất của tin đó. Đọc thêm vì sao [ghim lệch làm mọi khoảng cách lệch theo](/bai-viet/ghim-lech).`,

  'ghim-lech': `Ô tìm địa chỉ mở đúng khu, nhất là ở Hà Nội. Với ngõ, điểm rơi có thể lệch vài chục đến vài trăm mét. Lệch ghim là lệch mọi khoảng cách phía sau, từ hiệu thuốc tới mép hồ.

## Vì sao địa chỉ không đưa tới đúng ô đất

Dịch vụ tìm địa chỉ trả về một tọa độ đại diện. Với số nhà mặt phố, điểm này thường khá sát. Với địa chỉ trong ngõ, nhất là ngõ nhiều nhánh như *ngõ 12/34/5*, tọa độ có thể rơi vào đầu ngõ, giữa ngõ hoặc một nhánh khác.

Mức lệch thường gặp:

- Số nhà mặt phố: khoảng 0–30 m.
- Ngõ một cấp: khoảng 30–150 m.
- Ngõ nhiều nhánh: khoảng 100–400 m.

Các mức trên chỉ để hình dung. Cách chắc chắn nhất vẫn là **nhìn bản đồ và kéo ghim bằng tay**.

## Lệch ghim ảnh hưởng tới những gì

- **Khoảng cách**: mọi khoảng cách trong báo cáo đều tính từ ghim.
- **Số tiện ích**: điểm ở mép vòng có thể rơi ra ngoài hoặc lọt vào trong.
- **So sánh**: hai ghim lệch theo hai hướng khác nhau làm phép so sánh mất ý nghĩa.

> Chuỗi chữ trên biển số nhà không phải tọa độ của thửa đất.

## Cách kéo ghim cho đúng

1. Tìm địa chỉ để bản đồ mở đúng khu.
2. Phóng to tới mức thấy từng dãy nhà.
3. Đối chiếu hình dạng ngõ và các công trình gần đó.
4. Kéo ghim vào giữa ô đất rồi mới đọc báo cáo.

Cách trang ghi các giới hạn này nằm trong [tài liệu pháp lý](/phap-ly). Đọc phần tuyên bố dữ liệu trước khi dùng một con số để quyết định.`,

  'khung-gia': `Khung giá là một khoảng, không phải một mức chủ nhà đang chào và không phải giá giao dịch. Thiếu pháp lý hoặc mặt tiền thì khoảng rộng ra, hoặc trang không kết luận.

## Ba con số dễ bị nhầm với nhau

1. **Giá chào**: số chủ nhà hoặc môi giới ghi trên tin rao.
2. **Giá giao dịch**: số tiền hai bên thực sự chốt, thường không công khai.
3. **Khung giá**: khoảng ước lượng từ dữ liệu so sánh, có ghi rõ nguồn và độ tin cậy.

Ba con số này có thể chênh nhau đáng kể. Đặt chúng cạnh nhau là việc nên làm; ~~coi chúng là một~~ thì không.

## Khi nào khung giá rộng ra

### Thiếu thông tin về căn nhà

Không rõ pháp lý, diện tích công nhận hay hướng mặt tiền thì có ít căn đủ giống để so sánh. Khoảng ước lượng vì vậy rộng hơn.

### Ít giao dịch tương tự

Khu có ít tin rao hoặc tin rao đã cũ cũng làm khoảng rộng ra. Trang ghi ngày cập nhật nguồn cạnh con số để bạn biết dữ liệu mới tới đâu.

### Trang không kết luận

Khi dữ liệu quá mỏng, trang **không đưa ra khung giá** thay vì bịa thêm nguồn.

> Một khoảng rộng nhưng trung thực hữu ích hơn một con số đẹp mà không có căn cứ.

## Gói nào mở khung giá

- Gói miễn phí và gói không giới hạn lượt: chưa mở bước định giá.
- Gói có định giá: mở theo số lượt của gói.
- Một lượt lẻ 10.000 đồng: mở một lần xem khung giá cho một địa điểm.

Giá trên bảng là số tiền phải trả cho gói, *không phải giá căn nhà*.

---

Xem điều kiện trong [tài liệu về giá và thanh toán](/phap-ly) trước khi kỳ vọng một con số chốt. Đọc thêm: [giá chào không phải khung giá](/bai-viet/gia-chao).`,
};

/** Đoạn theo chủ đề, ghép vào các bài phụ để mỗi bài có thân dài và khác nhau. */
const TOPIC_PARAGRAPHS: Record<ArticleTopic, readonly string[]> = {
  'cach-doc': [
    'Báo cáo bám đúng ô đất đã ghim. Mọi con số phía sau, từ khoảng cách tới số tiện ích, đều tính từ điểm đó.',
    'Đọc theo thứ tự: vị trí ghim, bán kính, tiện ích gần nhất của từng nhóm, rồi mới tới tổng số đếm.',
    'Hai báo cáo chỉ so sánh được khi cùng bán kính và cùng cách đặt ghim.',
  ],
  'khu-vuc': [
    'Vòng tròn không biết sông, đường sắt hay một trục đường lớn có dải phân cách. Những thứ đó quyết định quãng đi thật.',
    'Một khu có nhiều tiện ích trên bản đồ vẫn có thể khó đi bộ nếu ngõ hẹp và không có vỉa hè.',
    'Ghé khu đó vào hai khung giờ khác nhau cho biết nhiều hơn mọi con số trên màn hình.',
  ],
  gia: [
    'Mọi con số về giá trên trang đều ghi nguồn và ngày cập nhật. Thiếu một trong hai thì đừng dùng nó để quyết định.',
    'Giá chào, giá giao dịch và khung giá là ba nguồn khác nhau, đặt cạnh nhau để thấy khoảng chênh.',
    'Khoảng rộng không có nghĩa là trang tính sai, mà là dữ liệu so sánh còn mỏng.',
  ],
  'du-lieu': [
    'Mỗi lớp dữ liệu có ngày cập nhật riêng. Lớp tiện ích có thể mới hơn lớp giá vài tháng.',
    'Dữ liệu mở như bản đồ cộng đồng có thể thiếu điểm mới mở hoặc còn giữ điểm đã đóng cửa.',
    'Trang không tự lấp khoảng trống bằng ước đoán. Thiếu dữ liệu thì báo cáo ghi rõ là thiếu.',
  ],
};

const CHECKLIST: Record<ArticleTopic, readonly string[]> = {
  'cach-doc': ['Ghim đã nằm đúng ô đất chưa?', 'Bán kính có hợp với cách đi lại không?', 'Điểm gần nhất có nằm sát mép vòng không?'],
  'khu-vuc': ['Có sông, đường sắt hay đường lớn chắn giữa không?', 'Lối vào nằm ở phía nào?', 'Đường đi có vỉa hè và đèn không?'],
  gia: ['Con số này là giá chào, giá giao dịch hay khung giá?', 'Nguồn và ngày cập nhật là gì?', 'Hồ sơ pháp lý đã đủ chưa?'],
  'du-lieu': ['Lớp dữ liệu cập nhật lần cuối khi nào?', 'Nguồn là dữ liệu mở hay khảo sát?', 'Có điểm nào đã đóng cửa mà vẫn hiện không?'],
};

const LINKS: Record<ArticleTopic, string> = {
  'cach-doc': '[cách đọc bán kính 500 mét](/bai-viet/ban-kinh-500-met)',
  'khu-vuc': '[danh sách nhà đất](/nha-dat)',
  gia: '[khung giá không phải giá bán](/bai-viet/khung-gia)',
  'du-lieu': '[tuyên bố về dữ liệu](/phap-ly)',
};

/**
 * Bài phụ: bốn kiểu bố cục xoay vòng theo thứ tự bài.
 * 0: h2 + danh sách đánh số + trích dẫn; 1: h2/h3 + gạch đầu dòng + đường kẻ;
 * 2: chỉ đoạn văn và trích dẫn (không mục lục); 3: dạng hỏi đáp với nhiều h3.
 */
export function extraArticleBody(input: { title: string; lede: string; topic: ArticleTopic; index: number }): string {
  const [p1, p2, p3] = TOPIC_PARAGRAPHS[input.topic];
  const checks = CHECKLIST[input.topic];
  const link = LINKS[input.topic];
  const closing = `Đối chiếu tin đang rao tại [danh sách nhà đất](/nha-dat) trước khi dùng con số này để quyết định. Đọc thêm: ${link}.`;

  switch (input.index % 4) {
    case 0:
      return [
        `${input.lede} ${p1}`,
        `## Điều cần biết`,
        `${p2} Đây là lý do tiêu đề bài viết nói rằng **${input.title.toLocaleLowerCase('vi')}**.`,
        `## Ba câu hỏi trước khi kết luận`,
        checks.map((item, at) => `${at + 1}. ${item}`).join('\n'),
        `> ${p3}`,
        closing,
      ].join('\n\n');
    case 1:
      return [
        input.lede,
        p1,
        `## Đọc con số thế nào`,
        `### Trên màn hình`,
        `${p2} Con số trên màn hình là *điểm khởi đầu*, không phải câu trả lời.`,
        `### Ngoài thực tế`,
        checks.map((item) => `- ${item}`).join('\n'),
        `---`,
        `${p3} ${closing}`,
      ].join('\n\n');
    case 2:
      return [
        `${input.lede} ${p1}`,
        `${p2} Nhiều người đọc nhanh phần tóm tắt rồi bỏ qua phần ghi chú về nguồn. Phần ghi chú đó mới cho biết con số đáng tin tới đâu.`,
        `> ${p3}`,
        `Trước khi chốt, hãy tự hỏi: ${checks.map((item) => item.toLocaleLowerCase('vi')).join(' ')}`,
        closing,
      ].join('\n\n');
    default:
      return [
        input.lede,
        `## Hỏi nhanh, đáp gọn`,
        `### ${checks[0]}`,
        p1,
        `### ${checks[1]}`,
        p2,
        `### ${checks[2]}`,
        `${p3} Nếu chưa trả lời được, **đừng dùng con số này để quyết định**.`,
        `## Tóm lại`,
        `- ${input.title}.\n- Mọi con số đều cần nguồn và ngày cập nhật.\n- Kiểm tra ngoài thực tế trước khi chốt.`,
        closing,
      ].join('\n\n');
  }
}

export function handWrittenBody(slug: string): string | undefined {
  return HAND_WRITTEN[slug];
}
