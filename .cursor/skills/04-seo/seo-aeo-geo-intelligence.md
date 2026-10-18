---
## name: seo-aeo-geo-intelligence
description: >
Tối ưu nội dung và cấu trúc trang để xuất hiện trong AI-generated
answers: Google AI Overviews, AI Mode, Perplexity, ChatGPT, Claude.
Bao gồm citability scoring, Q&A content model, data table formatting,
và entity presence. Dùng khi viết hoặc review nội dung nhắm đến
visibility trên AI search engines.
version: 1.1.0
updated: 2026-09-11
category: seo
scope: universal
stack: any
import-mode: reference-by-path
license: MIT

<!-- Updated: 2026-09-11 -->
<!-- AEO/GEO WATCH: Lĩnh vực này thay đổi nhanh nhất trong bộ skill.
 Kiểm tra lại mỗi 3 tháng:
 - https://developers.google.com/search/docs/appearance/ai-overviews
 - https://blog.google (filter: Search)
 - https://www.perplexity.ai/hub/blog
 Đánh dấu ngày review vào comment này. -->

# SEO AEO / GEO — AI Search Intelligence

Vai trò của bạn trong file này: **AI search optimization specialist**.

**Nền tảng tư duy quan trọng nhất của file này:**

> AEO (Answer Engine Optimization) và GEO (Generative Engine Optimization)
> không phải kỷ luật riêng biệt — Google chính thức xác nhận AI Overviews
> và AI Mode dùng cùng ranking system với Classic Search. Trang phải được
> index và eligible cho snippet mới có thể xuất hiện trong AI features.
> 
> **Ý nghĩa thực tiễn:** Làm tốt SEO truyền thống (file 1-4 trong bộ
> skill này) là điều kiện cần. File này là điều kiện đủ — các tín hiệu
> bổ sung giúp AI engines ưu tiên trích dẫn trang của bạn.

---

## 1. Ba Myth cần bác bỏ ngay

Trước khi làm bất cứ điều gì, loại bỏ các hiểu lầm phổ biến:

| Myth                                                  | Thực tế                                                                                               | Nguồn                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------- |
| "Thêm llms.txt là AI sẽ cite trang tôi hơn"           | llms.txt là permission file cho LLM training, KHÔNG phải citation signal cho search engines           | Google Search Central, 2025             |
| "Cần viết lại content theo kiểu AI để rank trên AI"   | Synonym understanding của LLM đủ tốt — không cần keyword rewriting. Focus vào structure và citability | Google AI Optimization Guide            |
| "Chunking nội dung thành đoạn ngắn sẽ tốt hơn cho AI" | Không có bằng chứng. Ưu tiên đoạn tự đứng vững và trả lời trực tiếp — không cắt theo số từ cố định     | Nguyên tắc citability (file này, §2)    |

---

## 2. Citability Score — Đo khả năng được AI trích dẫn

AI engines ưu tiên trích dẫn các passages đáp ứng đồng thời:

### 2.1 Self-contained Passage (Đoạn văn tự đứng vững)

Một passage "self-contained" là đoạn văn mà người đọc hiểu được **mà
không cần đọc context xung quanh**. AI engines scrape và trích dẫn
theo passage, không theo toàn trang.

Không tối ưu theo số từ cố định. Đoạn đủ dài để định nghĩa thuật ngữ,
nêu claim, và chốt ý — đủ ngắn để không phụ thuộc đoạn trước/sau.

```
✓ Passage tốt — tự đứng vững:
  "Redirect 301 (Moved Permanently) báo hiệu cho Googlebot rằng trang
   đã di chuyển vĩnh viễn đến URL mới. Khác với 302 (tạm thời), 301
   chuyển toàn bộ link equity sang URL đích. Khi đổi domain hoặc cấu
   trúc lại URL, bắt buộc dùng 301 để không mất ranking đã xây dựng.
   Chuỗi redirect (A→B→C) làm giảm link equity qua mỗi bước — luôn
   redirect thẳng từ URL cũ đến URL mới cuối cùng."

✗ Passage phụ thuộc context:
  "Như đã đề cập ở phần trên, phương pháp này cũng áp dụng cho trường
   hợp đó. Tuy nhiên có một ngoại lệ quan trọng cần lưu ý..."
  [Không ai hiểu "phương pháp này" hay "trường hợp đó" là gì]
```

**Cách viết để tạo self-contained passages:**

- Mỗi đoạn văn định nghĩa thuật ngữ kỹ thuật khi lần đầu dùng trong
  đoạn đó (dù đã định nghĩa ở section trước)
- Không dùng pronoun mơ hồ: "nó", "điều này", "phương pháp đó" mà không
  có antecedent rõ ràng trong cùng đoạn
- Kết thúc đoạn văn bằng câu chốt (takeaway) thay vì câu chuyển tiếp

### 2.2 Question-based Heading Hierarchy

AI engines đặc biệt ưa thích cấu trúc H2/H3 dạng câu hỏi + câu trả lời
trực tiếp ngay đầu đoạn:

```markdown
## Redirect 301 và 302 khác nhau như thế nào?

Redirect 301 là chuyển hướng vĩnh viễn — dùng khi URL đã đổi
vĩnh viễn và chuyển toàn bộ link equity. Redirect 302 là tạm thời —
dùng cho maintenance, A/B test, và không chuyển link equity.

Quy tắc đơn giản: nếu trang cũ sẽ không bao giờ hoạt động lại,
dùng 301. Nếu có thể sẽ quay lại URL cũ, dùng 302.
```

**Pattern "Direct Answer First":**

```
[H2/H3 — câu hỏi hoặc câu chủ đề rõ ràng]
[Câu 1-2: Câu trả lời trực tiếp, đầy đủ]
[Câu 3-5: Giải thích chi tiết, ví dụ, context]
[Câu 6-7 (tuỳ chọn): Edge cases, ngoại lệ]
```

AI Overviews thường lấy **2 câu đầu tiên sau heading** làm snippet.
Nếu 2 câu đầu không trả lời được câu hỏi, passage đó ít có cơ hội
được trích dẫn.

### 2.3 Attribution Density

AI engines đánh giá cao nội dung có **nguồn có thể kiểm chứng**:

```markdown
✓ Cao — dẫn primary source cụ thể:
  "Theo Google Search Central Blog (tháng 4/2026), INP đã chính thức
   thay thế FID làm Core Web Vital từ tháng 3/2024..."
  [Nguồn + ngày + fact cụ thể]

✓ Tốt — số liệu có nguồn:
  "Nghiên cứu Ahrefs 2025 trên 1 triệu domain cho thấy 73% trang
   không có backlink nào từ domain khác."

✗ Thấp — không thể kiểm chứng:
  "Các nghiên cứu cho thấy SEO kỹ thuật quan trọng hơn bao giờ hết."
```

**Mục tiêu:** Mỗi section ít nhất 1 attribution đến primary source
(Google docs, peer-reviewed study, official report).

---

## 3. Data Tables & Lists — Ưu tiên hàng đầu của AI

AI engines scrape và parse structured data rất tốt. Khi nội dung có thể
diễn đạt dưới dạng bảng hoặc danh sách, **ưu tiên format này** thay vì
prose.

### 3.1 Bảng HTML (`<table>`)

```html
<!-- Format bảng HTML chuẩn — AI đọc tốt hơn Markdown table -->
<table>
  <caption>So sánh Redirect 301 và 302</caption>
  <thead>
    <tr>
      <th scope="col">Tiêu chí</th>
      <th scope="col">301 Permanent</th>
      <th scope="col">302 Temporary</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Link equity</td>
      <td>Chuyển 100%</td>
      <td>Không chuyển</td>
    </tr>
    <tr>
      <td>Dùng khi</td>
      <td>Đổi URL vĩnh viễn</td>
      <td>A/B test, maintenance</td>
    </tr>
    <tr>
      <td>Ảnh hưởng indexing</td>
      <td>Google index URL mới</td>
      <td>Google giữ index URL cũ</td>
    </tr>
  </tbody>
</table>
```

**Dùng bảng khi:**

- So sánh 2+ options theo nhiều tiêu chí
- Liệt kê specifications / thông số kỹ thuật
- Mapping giữa hai tập hợp (ví dụ: tình huống → giải pháp)
- Data có cấu trúc hàng-cột rõ ràng

**Không dùng bảng khi:**

- Chỉ có 2 cột và nội dung là prose → dùng definition list hoặc H3+paragraph
- Data không có mối quan hệ hàng-cột thực sự

### 3.2 Ordered và Unordered Lists

```html
<!-- Dùng <ol> khi thứ tự quan trọng (steps, ranking, timeline) -->
<ol>
  <li>Kiểm tra robots.txt không chặn Googlebot</li>
  <li>Submit sitemap trong Google Search Console</li>
  <li>Yêu cầu indexing cho các trang quan trọng</li>
</ol>

<!-- Dùng <ul> khi thứ tự không quan trọng -->
<ul>
  <li>Technical SEO</li>
  <li>On-page SEO</li>
  <li>Link building</li>
</ul>
```

**Nested list — giới hạn 2 cấp:**

```html
<ul>
  <li>Core Web Vitals
    <ul>
      <li>LCP (Largest Contentful Paint)</li>
      <li>CLS (Cumulative Layout Shift)</li>
      <li>INP (Interaction to Next Paint)</li>
    </ul>
  </li>
</ul>
<!-- Quá 2 cấp → chuyển thành heading + list riêng -->
```

### 3.3 Definition Lists — underused nhưng hiệu quả

```html
<!-- Cực tốt cho AI — cấu trúc term + definition rõ ràng -->
<dl>
  <dt>Crawl budget</dt>
  <dd>Số lượng trang Googlebot crawl trong một khoảng thời gian nhất
      định. Phụ thuộc vào crawl rate limit (server capacity) và crawl
      demand (importance của trang). Tối ưu bằng cách loại bỏ URL rác
      khỏi sitemap và dùng robots.txt đúng cách.</dd>

  <dt>Link equity (PageRank)</dt>
  <dd>Giá trị "uy tín" được truyền qua internal và external links.
      Trang có nhiều high-quality inbound links → link equity cao →
      dễ rank hơn. Bị pha loãng khi có quá nhiều outbound links trên
      một trang.</dd>
</dl>
```

---

## 4. Entity Presence — Xây dựng thực thể

AI engines không chỉ hiểu từ khoá mà hiểu **entities** (thực thể):
người, tổ chức, địa điểm, khái niệm. Trang có entity presence mạnh
hơn được cite nhiều hơn.

### 4.1 Entity Signals on-page

```markdown
✓ Mention tên tác giả đầy đủ (không chỉ "Admin")
✓ Liên kết đến Wikipedia page nếu tác giả hoặc tổ chức có entry
✓ Nhắc đến các entities liên quan có uy tín:
  "Theo hướng dẫn từ Google Search Central và Bing Webmaster Tools..."
✓ Sử dụng proper nouns cụ thể thay vì generic terms:
  "Google Search Console" thay vì "công cụ webmaster"
  "Ahrefs" hoặc "Semrush" thay vì "SEO tool"
```

### 4.2 Entity Presence trên nền tảng khác

AI engines cross-reference với nhiều nguồn. Để được cite nhiều hơn:

| Nền tảng      | Hành động                                                    |
| ------------- | ------------------------------------------------------------ |
| **Wikipedia** | Tạo entry nếu đủ notability; liên kết trong `sameAs` Schema  |
| **Reddit**    | Tham gia discussion trong subreddit liên quan, không spam    |
| **YouTube**   | Video về chủ đề bạn viết — AI cite video cùng với text       |
| **LinkedIn**  | Author profile đầy đủ, post về topic                         |
| **GitHub**    | Repository nếu là tech content — Perplexity cite GitHub mạnh |

> Không cần có mặt ở tất cả — chọn 2-3 nền tảng phù hợp với ngành và
> duy trì nhất quán.

---

## 5. llms.txt — Hiểu đúng vai trò

```
File llms.txt đặt tại: https://domain.com/llms.txt
```

**llms.txt là gì:**

File plain text cung cấp context về site để LLM (khi training hoặc
browsing) hiểu site nhanh hơn. Cú pháp gợi ý bởi Jeremy Howard (2024).

**llms.txt KHÔNG phải:**

- Citation lever cho AI search (Perplexity, Google AI Overviews)
- Robots.txt cho LLM — LLM training crawler vẫn phải tuân theo `robots.txt`
- Ranking signal được Google xác nhận

**Nên có llms.txt không?**

→ Tùy chọn. Chi phí tạo thấp, có thể hữu ích khi LLM browsing cần
tóm tắt site. **Không phải việc ưu tiên**, không đưa vào checklist
tính điểm — đừng làm file này thay cho content và technical SEO.

**Template llms.txt tối giản:**

```markdown
# TênSite

> Mô tả 1-2 câu về site là gì và phục vụ ai.

## Trang quan trọng nhất

- [Trang chủ](https://domain.com/): Điểm vào chính
- [Blog](https://domain.com/blog/): Tất cả bài viết kỹ thuật
- [About](https://domain.com/about/): Thông tin về tác giả và tổ chức

## Chủ đề chính

Site chủ yếu cover: [topic 1], [topic 2], [topic 3].
Ngôn ngữ: Tiếng Việt (chính), Tiếng Anh (phụ).
Cập nhật: [tần suất cập nhật].

## Tác giả

[Tên tác giả], [chức danh], [brief credentials].
Contact: [email hoặc link profile]
```

---

## 6. Scoring Checklist — AEO/GEO Readiness

Dùng checklist này để đánh giá một trang trước khi publish hoặc khi audit:

```
## AEO/GEO Readiness — [URL]
Ngày: YYYY-MM-DD

### Nền tảng (phải đạt 100% — từ các file khác trong bộ skill)
[ ] Trang được index (không bị noindex, không bị Disallow)
[ ] Page load < 3s (LCP < 2.5s)
[ ] Mobile-friendly
[ ] HTTPS
[ ] Canonical đúng

### Citability Structure
[ ] Headings dạng câu hỏi hoặc câu chủ đề rõ ràng
[ ] Direct answer trong 1-2 câu đầu mỗi section
[ ] Passages self-contained (không phụ thuộc context ngoài đoạn)

### Data Formatting
[ ] Thông tin dạng so sánh → đã dùng <table>
[ ] Danh sách có thứ tự → đã dùng <ol>
[ ] Danh sách không thứ tự → đã dùng <ul>
[ ] Định nghĩa thuật ngữ → đã dùng <dl> hoặc H3+paragraph

### Attribution & Entity
[ ] Mỗi claim quan trọng có source cụ thể (tên nguồn + ngày)
[ ] Author bio đầy đủ với credentials
[ ] Proper nouns cụ thể (không generic "các nghiên cứu", "các tool")
[ ] Entity sameAs trong Schema trỏ đến Wikipedia / LinkedIn

llms.txt không tính điểm. Có hay không không ảnh hưởng score.

### Score tổng
Đạt: X / 16 checks
→ 14-16: Tốt — sẵn sàng cho AI visibility
→ 11-13: Trung bình — cần cải thiện trước khi expect AI citations
→  < 11: Cần làm lại cơ bản
```

---

## 7. Tracking AI Visibility

AI Overviews và citations không hiển thị trong Google Search Console
một cách trực tiếp. Các cách track khả thi hiện tại:

```
Cách 1 — Manual check
  Tìm kiếm query mục tiêu trong Google AI Mode (hoặc Google với AI
  Overviews bật) → xem site có được cite không

Cách 2 — Google Search Console (gián tiếp)
  Performance → Search type: "Web" → filter "Show AI Overviews"
  (chức năng này đang được Google rollout dần)

Cách 3 — Third-party tools
  DataForSEO, Semrush AI Toolkit, Ahrefs AI Overview tracking
  (tính năng đang phát triển nhanh — kiểm tra availability tại thời
   điểm sử dụng)

Cách 4 — Perplexity / ChatGPT manual check
  Query trực tiếp trên các AI engine → xem có được cite không
  Ghi lại date, query, kết quả để track theo thời gian
```

---

## 8. Giới hạn phạm vi file này

File này **chỉ xử lý** tối ưu cho AI search engines. Các chủ đề nền
tảng (bắt buộc phải đúng trước khi file này có tác dụng) thuộc các
file khác:

- Crawlability, robots.txt, sitemap, redirects → `seo-technical-infrastructure.md`
- Meta tags, heading, canonical, images → `seo-onpage-dom.md`
- Schema / JSON-LD / Structured Data → `seo-structured-data.md`
- Content quality, E-E-A-T, keyword strategy → `seo-eeat-content-quality.md`

**Thứ tự ưu tiên khi có conflict về effort:**

```
File 1 (Technical) → File 2 (On-page) → File 3 (Schema)
→ File 4 (E-E-A-T) → File 5 (AEO/GEO, file này)

Không nên: Dành 80% effort vào AEO/GEO mà bỏ qua technical SEO cơ bản.
```
