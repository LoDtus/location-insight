---
## name: seo-eeat-content-quality
description: >
Đánh giá và tối ưu chất lượng nội dung theo tiêu chuẩn E-E-A-T của
Google: phân bổ từ khoá, semantic clustering, phòng tránh keyword
cannibalization, readability, và các tín hiệu chứng minh chuyên môn.
Dùng khi viết bài, review nội dung, hoặc audit content strategy cho
bất kỳ chủ đề / ngành nào.
version: 1.1.0
updated: 2026-09-11
category: seo
scope: universal
stack: any
import-mode: reference-by-path
license: MIT

<!-- Updated: 2026-09-11 -->
<!-- CONTENT WATCH: Google Quality Rater Guidelines cập nhật không định kỳ.
 Kiểm tra https://static.googleusercontent.com/media/guidelines/
 mỗi 6 tháng để phát hiện thay đổi về E-E-A-T. -->

# SEO E-E-A-T & Content Quality

Vai trò của bạn trong file này: **biên tập viên nội dung SEO cấp cao**.
Khi review hoặc viết nội dung, áp dụng đồng thời cả hai lens:

- **Lens 1 — Người dùng:** Nội dung này có thực sự giúp ích người đọc
  không? Họ có câu trả lời họ cần sau khi đọc xong không?
- **Lens 2 — Google:** Nội dung này có đủ tín hiệu để Google tin đây là
  nguồn đáng tin cậy, có chuyên môn, và xứng đáng được xếp hạng cao không?

Hai lens này không mâu thuẫn nhau — nội dung tốt cho người dùng là nền
tảng, E-E-A-T là lớp tín hiệu được xây dựng trên nền đó.

---

## 1. E-E-A-T — Khung đánh giá

E-E-A-T là viết tắt của **Experience, Expertise, Authoritativeness,
Trustworthiness** — bốn chiều Google dùng để đánh giá chất lượng nội dung
thông qua Quality Raters và thuật toán.

### 1.1 Experience (Trải nghiệm thực tế)

Người viết có **kinh nghiệm trực tiếp** với chủ đề không?

**Tín hiệu cần có:**

```
✓ Câu chuyện / case study từ thực tế của tác giả
  VD: "Khi triển khai cho dự án affiliate catalog của chúng tôi,
       chúng tôi nhận thấy..."

✓ Ảnh chụp thực tế, screenshot từ công cụ tác giả dùng

✓ Số liệu cụ thể từ dự án thực (không phải số liệu chung từ internet)
  VD: "Sau khi fix redirect chain, crawl budget giảm 40% trong 2 tuần"

✓ Lỗi thực tế tác giả từng mắc phải và cách khắc phục

✓ So sánh giữa các cách làm dựa trên thử nghiệm thực tế
```

**Tín hiệu yếu / cần tránh:**

```
✗ "Theo các chuyên gia..." mà không dẫn nguồn cụ thể
✗ Nội dung hoàn toàn lý thuyết, không có ví dụ thực tế
✗ Ảnh stock, screenshot từ website người khác
```

### 1.2 Expertise (Chuyên môn)

Tác giả có **kiến thức chuyên sâu** về lĩnh vực không?

**Tín hiệu on-page cần thêm:**

Author bio phải **hiển thị trên trang** (tên, vai trò, credentials,
link hồ sơ). Schema tác giả dùng **JSON-LD** — xem `Article.author` /
`Person` trong `seo-structured-data.md`. Không dùng Microdata
(`itemscope`, `itemprop`) song song.

```html
<!-- Author bio — nội dung visible. Schema nằm ở JSON-LD, không gắn vào HTML. -->
<div class="author-bio">
  <img src="/images/author.jpg" alt="Tên Tác Giả" />
  <h3>Tên Tác Giả</h3>
  <p>Senior SEO Engineer tại TênCôngTy</p>
  <p>
    5 năm kinh nghiệm technical SEO, đã tối ưu cho 30+ dự án
    e-commerce và SaaS. Chứng chỉ Google Analytics, Google Ads.
  </p>
  <a href="https://linkedin.com/in/ten-tac-gia">LinkedIn</a>
</div>
```

**Nội dung chứng minh expertise:**

- Định nghĩa thuật ngữ chuyên ngành đúng và đủ
- Giải thích cơ chế hoạt động (tại sao), không chỉ hướng dẫn (làm gì)
- Đề cập đến edge cases, ngoại lệ, trường hợp không áp dụng được
- Cập nhật kịp thời khi có thay đổi (ghi rõ ngày cập nhật)

### 1.3 Authoritativeness (Uy tín)

Nguồn nào xác nhận uy tín của tác giả / site?

**Checklist:**

- [ ] Backlink từ các site uy tín trong ngành trỏ đến trang này

- [ ] Tác giả được trích dẫn hoặc phỏng vấn bởi site khác

- [ ] Trang About / Author có liên kết đến portfolio, publications

- [ ] Trích dẫn từ nghiên cứu, báo cáo có nguồn gốc rõ ràng:
  
  ```
  ✓ Theo Google Search Central Blog (tháng 5/2026)...✓ Nghiên cứu của Ahrefs (2025) trên 1 triệu từ khoá cho thấy...✗ Theo các nghiên cứu...  ← quá mơ hồ
  ```

- [ ] Không có nội dung bị kiểm tra thực tế và sai

### 1.4 Trustworthiness (Độ tin cậy)

Người dùng và Google có **tin tưởng** site này không?

**Tín hiệu kỹ thuật (cross với file 1):**

- HTTPS bắt buộc
- Privacy Policy, Terms of Service tồn tại và dễ tìm
- Contact page với thông tin thực

**Tín hiệu nội dung:**

- Nội dung trung thực, thừa nhận giới hạn và ngoại lệ
- Không có clickbait title — headline phải khớp với nội dung
- Ngày publish và ngày cập nhật ghi rõ, chính xác
- Nguồn trích dẫn có thể kiểm chứng (link đến primary source)
- Nội dung YMYL (Your Money Your Life: sức khoẻ, tài chính, pháp lý)
  cần level E-E-A-T cao hơn đáng kể — thêm disclaimer và review bởi
  chuyên gia có chứng chỉ

**YMYL topics — cần xử lý đặc biệt:**

```
Y-M-Y-L bao gồm: y tế / sức khoẻ, tài chính / đầu tư, pháp lý,
tin tức quan trọng, an toàn, hạnh phúc của người dùng.

Nếu trang thuộc YMYL:
→ Bắt buộc có author credentials rõ ràng (bác sĩ, luật sư, CFA...)
→ Bắt buộc có medical/legal/financial disclaimer
→ Review định kỳ để đảm bảo thông tin không lỗi thời
→ Cân nhắc: có nên viết về topic này không nếu không có chuyên môn thực?
```

---

## 2. Keyword Optimization

### 2.1 Phân tích intent trước khi viết

Trước khi viết bất kỳ nội dung nào, xác định **search intent** của từ
khoá mục tiêu:

| Intent            | Dấu hiệu nhận biết                             | Loại nội dung phù hợp      |
| ----------------- | ---------------------------------------------- | -------------------------- |
| **Informational** | "là gì", "tại sao", "cách", "hướng dẫn"        | Blog post, guide, tutorial |
| **Navigational**  | Tên brand, tên sản phẩm cụ thể                 | Landing page, homepage     |
| **Commercial**    | "tốt nhất", "so sánh", "review", "nên dùng gì" | Comparison post, review    |
| **Transactional** | "mua", "giá", "đặt hàng", "download"           | Product page, pricing page |

> Viết sai loại content cho intent = không bao giờ rank được dù chất
> lượng content tốt. Kiểm tra SERP thực tế của từ khoá để confirm intent.

### 2.2 Phân bổ từ khoá tự nhiên

**Vị trí ưu tiên** (xếp theo tầm quan trọng giảm dần):

```
1. Title tag (H1 và <title>)          — bắt buộc, từ khoá chính
2. 100 từ đầu của bài viết            — xuất hiện sớm
3. H2 đầu tiên                        — từ khoá chính hoặc biến thể gần
4. Meta description                    — tự nhiên, không ép
5. Alt text của ảnh chính             — nếu liên quan
6. URL slug                            — dạng rút gọn của từ khoá
7. Trong body                          — xuất hiện tự nhiên khi đúng ngữ cảnh
```

Không tối ưu theo **mật độ %**. Google không rank theo tỉ lệ từ khoá /
tổng số từ. Viết xong, đọc lại: nếu câu chỉ tồn tại để nhét từ khoá thì
xóa hoặc viết lại.

**Keyword stuffing — nhận diện và tránh:**

```
✗ "Dịch vụ SEO Hà Nội của chúng tôi cung cấp dịch vụ SEO Hà Nội
   tốt nhất. Nếu bạn cần dịch vụ SEO Hà Nội, hãy liên hệ dịch vụ
   SEO Hà Nội ngay hôm nay."

✓ "Chúng tôi cung cấp dịch vụ tối ưu công cụ tìm kiếm tại Hà Nội,
   với hơn 5 năm kinh nghiệm giúp các doanh nghiệp địa phương tăng
   visibility trên Google."
```

### 2.3 Semantic Clustering (Gom cụm ngữ nghĩa)

Thay vì nhắm một từ khoá đơn lẻ, xây dựng **topic cluster** để cover
toàn bộ semantic space của chủ đề:

```
Pillar Page (trang trụ cột):
  "Hướng dẫn SEO kỹ thuật đầy đủ 2026"
  → Target: "seo kỹ thuật", "technical seo"
  → 3000-5000+ từ, cover toàn bộ topic

Cluster Pages (trang vệ tinh):
  → "robots.txt là gì và cách cấu hình"
  → "XML sitemap: hướng dẫn tạo và submit"
  → "301 redirect vs 302: khi nào dùng cái nào"
  → "Core Web Vitals là gì: LCP, CLS, INP"

Internal linking:
  Mỗi cluster page → link về pillar page
  Pillar page → link đến tất cả cluster pages
```

**Phủ chủ đề (topical / entity coverage):**

Khi viết về một chủ đề, cover các khái niệm và thực thể liên quan mà
người đọc (và máy tìm kiếm) kỳ vọng thấy — không phải danh sách từ
đồng nghĩa để nhồi. Ví dụ: bài về "robots.txt" nên tự nhiên nhắc đến:
`Googlebot`, `crawl budget`, `sitemap`, `disallow`, `user-agent`,
`indexing`, `Search Console`.

Không dùng khung "LSI keywords". Nếu các khái niệm cốt lõi vắng mặt
hoàn toàn → nội dung nông, thiếu coverage → khó rank cho từ khoá cạnh
tranh.

### 2.4 Keyword Cannibalization — phát hiện và xử lý

**Cannibalization xảy ra khi:** nhiều trang cùng site target cùng một từ
khoá / intent → Google không biết trang nào nên rank → cả hai đều rank
kém.

**Cách phát hiện:**

```
Tìm kiếm: site:domain.com "từ khoá mục tiêu"
→ Nếu có > 1 trang xuất hiện → kiểm tra xem chúng có overlap intent không

Hoặc trong Google Search Console:
Performance → Queries → lọc theo từ khoá → xem có nhiều URL cùng hiển
thị cho từ khoá đó không
```

**Cách xử lý:**

| Tình huống                                | Giải pháp                                          |
| ----------------------------------------- | -------------------------------------------------- |
| Trang A và B gần giống nội dung           | Merge thành một trang, 301 trang còn lại           |
| Trang A = informational, B = commercial   | Giữ cả hai, differentiate rõ intent                |
| Blog post cũ và bài mới cùng topic        | Cập nhật bài cũ hoặc canonical bài cũ → bài mới    |
| Trang category và trang pillar trùng nhau | Differentiate nội dung hoặc noindex trang category |

---

## 3. Readability — Chuẩn đọc

### 3.1 Cấu trúc bài viết

**Mô hình chuẩn cho long-form content:**

```
[Hook — 2-3 câu đầu]
Câu hỏi hoặc vấn đề người đọc đang gặp phải.
Cam kết rõ: bài này giúp họ giải quyết gì.

[TL;DR / Key Takeaways — tuỳ chọn nhưng nên có cho bài > 1500 từ]
→ 3-5 điểm chính của bài, đặt sau intro

[Body — chia section rõ ràng bằng H2/H3]
Mỗi section giải quyết một khía cạnh của topic.

[Conclusion — tóm tắt + CTA]
Tóm lại điều quan trọng nhất.
Bước tiếp theo họ nên làm.
```

### 3.2 Đoạn văn và câu

**Quy tắc:**

- Mỗi đoạn văn: **3-5 câu**, tối đa 7 câu
- Câu dài phức tạp → tách thành 2 câu ngắn hơn
- Một ý = một đoạn văn
- Xen kẽ đoạn văn với bullet list, table, code block để tránh "wall of text"
- Mỗi 300-500 từ nên có một visual break (heading mới, list, hoặc image)

**Khoảng cách dòng và typography (cross với on-page DOM):**

```css
/* Tối thiểu cho readability tốt */
body {
  font-size: 16px;        /* tối thiểu, 17-18px là tốt hơn */
  line-height: 1.6;       /* tối thiểu 1.5, lý tưởng 1.7-1.8 */
  max-width: 720px;       /* measure lý tưởng: 65-75 ký tự mỗi dòng */
}
```

### 3.3 Bullet Points — dùng đúng

```
✓ Dùng bullet khi:
  → Liệt kê 3+ items không có thứ tự
  → Checklist hoặc steps
  → So sánh nhanh giữa các options
  → Tóm tắt key points

✗ Không dùng bullet khi:
  → Chỉ có 2 items (viết thành câu: "A và B")
  → Items cần giải thích dài (viết thành đoạn văn với H3)
  → Cố ý phá vỡ luồng narrative liền mạch
  → Toàn bộ bài viết chỉ là bullet points
```

### 3.4 Độ dài nội dung theo page type

Không có "độ dài chuẩn" tuyệt đối — độ dài phải phù hợp với intent và
đủ để cover topic đầy đủ hơn top competitors. Tuy nhiên:

| Page type         | Tối thiểu | Lý tưởng      | Ghi chú              |
| ----------------- | --------- | ------------- | -------------------- |
| Blog post / Guide | 800 từ    | 1500-3000 từ  | Tuỳ theo topic depth |
| Pillar page       | 2000 từ   | 3000-5000+ từ | Cover toàn bộ topic  |
| Product page      | 300 từ    | 500-800 từ    | Quality > quantity   |
| Landing page      | 200 từ    | 400-600 từ    | Conversion-focused   |
| Category page     | 150 từ    | 200-400 từ    | Avoid thin content   |
| Homepage          | —         | 300-600 từ    | Brand + UVP          |

**Thin content threshold** (nội dung quá mỏng → cần bổ sung):

```
< 200 từ trên trang quan trọng (trừ intentional minimal pages) → [HIGH]
< 100 từ                                                         → [CRITICAL]
Trang chỉ có boilerplate text, không có unique value            → [CRITICAL]
```

---

## 4. Freshness — Độ tươi của nội dung

Google ưu tiên nội dung cập nhật cho các query nhạy cảm với thời gian
(news, tutorials, pricing, statistics).

**Dấu hiệu freshness Google đọc được:**

```html
<!-- Trong Schema Article -->
"dateModified": "2026-06-25T10:00:00+07:00"

<!-- Trên trang (visible text) -->
<time datetime="2026-06-25">Cập nhật: 25 tháng 6, 2026</time>
```

**Chiến lược maintain freshness:**

```
Mỗi 6 tháng: Review lại các bài viết high-traffic
→ Cập nhật số liệu, statistics đã outdated
→ Thêm thông tin mới phát sinh
→ Xoá / update các tool, resource không còn tồn tại
→ Cập nhật dateModified trong Schema
→ Đổi ngày cập nhật visible trên trang
→ Submit lại URL trong Google Search Console
```

**Không được làm:**

```
✗ Đổi dateModified mà không cập nhật nội dung thực sự
  → Google phát hiện được và đây là tín hiệu tiêu cực
✗ Republish bài cũ với date mới hoàn toàn mà không có thay đổi đáng kể
```

---

## 5. Content Audit Workflow

Khi được yêu cầu audit nội dung, thực hiện theo thứ tự:

```
Bước 1 — Inventory
  Liệt kê tất cả trang/bài viết cần audit
  Thu thập: URL, title, word count, last updated, organic traffic (nếu có)

Bước 2 — Phân loại theo action cần thực hiện
  KEEP: Traffic tốt, E-E-A-T đủ, không cần sửa nhiều
  IMPROVE: Traffic thấp nhưng topic có tiềm năng → cập nhật
  MERGE: Cannibalization với trang khác → merge + 301
  DELETE: Thin content, no traffic, no backlink, no strategic value → 404 hoặc noindex

Bước 3 — Ưu tiên theo tác động
  High traffic + dễ cải thiện → làm trước
  Strategic topic cluster → làm sau

Bước 4 — Thực thi và track
  Theo dõi Google Search Console sau 2-4 tuần
  So sánh impressions, clicks, average position
```

---

## 6. Output Format — Content Review

Khi review một bài viết cụ thể:

```
## Content Quality Review — [URL hoặc tiêu đề]
Ngày: YYYY-MM-DD
Từ khoá mục tiêu: [primary keyword]
Search intent: [Informational / Commercial / Transactional / Navigational]

### E-E-A-T Score
Experience:        [Mạnh / Trung bình / Yếu] — [nhận xét ngắn]
Expertise:         [Mạnh / Trung bình / Yếu] — [nhận xét ngắn]
Authoritativeness: [Mạnh / Trung bình / Yếu] — [nhận xét ngắn]
Trustworthiness:   [Mạnh / Trung bình / Yếu] — [nhận xét ngắn]

### Keyword
Primary keyword xuất hiện: Title [✓/✗], H1 [✓/✗], 100 từ đầu [✓/✗],
                            Meta desc [✓/✗], URL [✓/✗]
Nhồi từ khoá: [Không / Có — trích câu]
Cannibalization risk: [Có / Không] — [URL trùng nếu có]
Khái niệm / thực thể còn thiếu: [danh sách]

### Readability
Độ dài: X từ — [đủ / thin / quá dài không cần thiết]
Đoạn văn trung bình: X câu
Cấu trúc heading: [✓ sequential / vấn đề]
Visual breaks: [đủ / thiếu]

### Freshness
Ngày publish: YYYY-MM-DD
Ngày update: YYYY-MM-DD
Cần cập nhật: [Có / Không] — [lý do]

### Hành động đề xuất (theo ưu tiên)
[CRITICAL] ...
[HIGH] ...
[MEDIUM] ...
```

---

## 7. Giới hạn phạm vi file này

File này **chỉ xử lý** chất lượng nội dung và E-E-A-T. Các chủ đề sau
thuộc file khác:

- Crawlability, robots.txt, sitemap, redirects → `seo-technical-infrastructure.md`
- Meta tags, heading, canonical, images → `seo-onpage-dom.md`
- Schema / JSON-LD / Structured Data → `seo-structured-data.md`
- AEO / GEO / tối ưu cho AI search engines → `seo-aeo-geo-intelligence.md`
