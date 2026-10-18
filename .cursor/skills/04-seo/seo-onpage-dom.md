---
## name: seo-onpage-dom
description: >
Kiểm tra và tối ưu hoá cấu trúc HTML/DOM cho SEO on-page: meta tags,
heading hierarchy, internal/external links, canonical, và media
optimization. Dùng khi người dùng yêu cầu review hoặc generate HTML,
JSX, template cho bất kỳ stack nào (Next.js, NestJS SSR, Astro, Hugo,
WordPress, v.v.).
version: 1.0.0
updated: 2026-06-25
category: seo
scope: universal
stack: any
import-mode: reference-by-path
license: MIT

<!-- Updated: 2026-06-25 -->

# SEO On-Page DOM

Vai trò của bạn trong file này: **kỹ sư SEO on-page**.
Khi được yêu cầu review HTML, generate code, hoặc audit trang, áp dụng
toàn bộ quy tắc dưới đây. Ưu tiên theo mức độ tác động: `[CRITICAL]` → `[HIGH]` → `[MEDIUM]` → `[LOW]`.

Nguyên tắc cốt lõi: **mỗi quy tắc ở đây tồn tại vì Googlebot hoặc người
dùng cần nó — không phải vì convention**. Khi generate code, giải thích
ngắn lý do nếu rule đó không hiển nhiên.

---

## 1. Meta Tags

### 1.1 Title Tag

**Giới hạn:** 50–60 ký tự (bao gồm cả brand suffix nếu có).

```html
<!-- Đúng -->
<title>Hướng dẫn SEO kỹ thuật cho Next.js | BrandName</title>
<!-- 52 ký tự ✓ -->

<!-- Sai — quá dài, bị cắt trên SERP -->
<title>Hướng dẫn đầy đủ và chi tiết về cách tối ưu SEO kỹ thuật cho ứng dụng Next.js từ A đến Z | BrandName</title>

<!-- Sai — thiếu từ khoá chính -->
<title>Bài viết số 42 | BrandName</title>
```

**Quy tắc bắt buộc:**

- Từ khoá chính xuất hiện càng gần đầu title càng tốt
- Mỗi trang có title **duy nhất** trên toàn site
- Không dùng ALL CAPS, không nhồi từ khoá
- Brand suffix (`| BrandName` hoặc `– BrandName`) ở cuối, không ở đầu
- Trang chủ: `BrandName — Tagline ngắn` (brand đứng đầu là ngoại lệ hợp lý)

**Kiểm tra khi audit:**

| Tình trạng                     | Mức độ       |
| ------------------------------ | ------------ |
| Thiếu `<title>`                | `[CRITICAL]` |
| Title trùng lặp với trang khác | `[HIGH]`     |
| Title > 60 ký tự               | `[MEDIUM]`   |
| Title < 30 ký tự               | `[MEDIUM]`   |
| Thiếu từ khoá chính            | `[MEDIUM]`   |

### 1.2 Meta Description

**Giới hạn:** 150–160 ký tự.

```html
<!-- Đúng -->
<meta name="description" content="Hướng dẫn thiết lập robots.txt, sitemap XML và xử lý redirect 301 đúng chuẩn cho dự án Next.js. Bao gồm checklist đầy đủ và ví dụ thực tế." />
<!-- 158 ký tự ✓ -->
```

**Quy tắc:**

- Phải chứa từ khoá chính (tự nhiên, không nhồi)
- Viết như một CTA ngắn — mô tả người dùng nhận được gì khi click
- Mỗi trang có description **duy nhất**
- Google không dùng description làm ranking signal trực tiếp, nhưng ảnh
  hưởng CTR → gián tiếp ảnh hưởng ranking

| Tình trạng              | Mức độ     |
| ----------------------- | ---------- |
| Thiếu meta description  | `[HIGH]`   |
| Description trùng lặp   | `[HIGH]`   |
| Description > 160 ký tự | `[MEDIUM]` |
| Description < 80 ký tự  | `[LOW]`    |

### 1.3 Meta Robots

```html
<!-- Mặc định — không cần khai báo nếu muốn index -->
<meta name="robots" content="index, follow" />

<!-- Chặn index trang này -->
<meta name="robots" content="noindex, follow" />

<!-- Chặn theo dõi link -->
<meta name="robots" content="index, nofollow" />

<!-- Chặn hoàn toàn -->
<meta name="robots" content="noindex, nofollow" />

<!-- Ngăn Google lấy snippet từ trang này -->
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
```

**Lưu ý quan trọng:** `noindex` phải nằm trong `<head>` và trang **không
được bị `Disallow`** trong robots.txt. Nếu bị Disallow, Googlebot không
vào đọc được thẻ noindex → trang có thể vẫn xuất hiện trong kết quả
không có snippet.

### 1.4 Open Graph & Social Tags

```html
<!-- Open Graph — bắt buộc cho sharing đúng trên Facebook, LinkedIn -->
<meta property="og:title" content="Tiêu đề trang" />
<meta property="og:description" content="Mô tả 150-300 ký tự cho social" />
<meta property="og:image" content="https://domain.com/og-image.jpg" />
<!-- og:image tối thiểu 1200×630px, tối đa 8MB -->
<meta property="og:url" content="https://domain.com/slug/" />
<meta property="og:type" content="article" />
<!-- og:type: website | article | product | video.other -->

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Tiêu đề trang" />
<meta name="twitter:description" content="Mô tả ngắn" />
<meta name="twitter:image" content="https://domain.com/og-image.jpg" />
```

| Tình trạng                             | Mức độ     |
| -------------------------------------- | ---------- |
| Thiếu `og:image`                       | `[HIGH]`   |
| `og:image` < 600×315px                 | `[HIGH]`   |
| Thiếu `og:title` hoặc `og:description` | `[MEDIUM]` |
| Thiếu Twitter Card                     | `[LOW]`    |

---

## 2. Heading Hierarchy

### 2.1 Quy tắc cứng

- **Duy nhất 1 thẻ `<h1>` mỗi trang** — vi phạm → `[HIGH]`
- **Không được nhảy cấp:** H1 → H3 (bỏ H2) → `[MEDIUM]`
- Thứ tự hợp lệ: H1 → H2 → H3 → H4 (mỗi cấp có thể có nhiều thẻ)
- H1 phải chứa từ khoá chính của trang
- H2–H6 mô tả đúng nội dung section bên dưới

```html
<!-- Đúng -->
<h1>Hướng dẫn SEO kỹ thuật cho Next.js</h1>
  <h2>1. Cấu hình robots.txt</h2>
    <h3>1.1 Quy tắc Allow và Disallow</h3>
    <h3>1.2 Khai báo Sitemap</h3>
  <h2>2. XML Sitemap</h2>
    <h3>2.1 Cấu trúc chuẩn</h3>

<!-- Sai — nhảy cấp từ H1 → H3 -->
<h1>Hướng dẫn SEO kỹ thuật</h1>
  <h3>robots.txt</h3>   ← thiếu H2

<!-- Sai — 2 H1 -->
<h1>Hướng dẫn SEO</h1>
...
<h1>Kết luận</h1>   ← thừa H1
```

### 2.2 Heading và keyword

- **H1:** Chứa từ khoá chính, viết tự nhiên, không nhồi
- **H2:** Chứa từ khoá phụ / biến thể semantic — giúp Google hiểu subtopic
- **H3–H6:** Mô tả chi tiết — không cần ép từ khoá
- Không dùng heading chỉ để styling (dùng CSS class thay thế)

---

## 3. Internal & External Links

### 3.1 Internal Links

**Tầm quan trọng:** Internal linking là cơ chế chuyển link equity và
giúp Google khám phá trang mới. Trang không có internal link nào trỏ
đến = "orphan page" → Googlebot khó tìm thấy.

```html
<!-- Đúng — anchor text mô tả đích đến -->
<a href="/blog/seo-ky-thuat-nextjs/">hướng dẫn SEO kỹ thuật Next.js</a>

<!-- Sai — anchor text generic -->
<a href="/blog/seo-ky-thuat-nextjs/">xem thêm</a>
<a href="/blog/seo-ky-thuat-nextjs/">tại đây</a>
<a href="/blog/seo-ky-thuat-nextjs/">click here</a>
```

**Checklist internal link:**

- [ ] Anchor text mô tả đúng nội dung trang đích (không dùng "xem thêm",
  "click here", "tại đây")
- [ ] Không có orphan page (mỗi trang quan trọng phải có ít nhất 1 trang
  khác trong site trỏ đến)
- [ ] Link trỏ đến URL canonical (không trỏ đến URL redirect)
- [ ] Không có broken internal link (trả về 404)
- [ ] Trang quan trọng được link từ trang có authority cao (homepage,
  category page)

| Tình trạng                                   | Mức độ     |
| -------------------------------------------- | ---------- |
| Orphan page (không có internal link trỏ đến) | `[HIGH]`   |
| Internal link trỏ đến URL 404                | `[HIGH]`   |
| Internal link trỏ đến URL redirect (301)     | `[MEDIUM]` |
| Toàn bộ anchor text là "xem thêm" / generic  | `[MEDIUM]` |

### 3.2 External Links

```html
<!-- Link đến nguồn bên ngoài — thêm rel attribute phù hợp -->

<!-- Nguồn đáng tin cậy, muốn chuyển link equity -->
<a href="https://developers.google.com/search/docs" target="_blank" rel="noopener noreferrer">
  Google Search Documentation
</a>

<!-- Link thương mại, được trả tiền, hoặc không muốn chuyển equity -->
<a href="https://affiliate-partner.com" rel="nofollow noopener noreferrer">
  Xem sản phẩm
</a>

<!-- Link do user generated content (comment, forum) -->
<a href="https://example.com" rel="ugc noopener noreferrer">
  Link từ user
</a>
```

**Quy tắc `rel` attribute:**

| Trường hợp                        | `rel` value                |
| --------------------------------- | -------------------------- |
| Link đến nguồn tin cậy, editorial | Không cần `nofollow`       |
| Link quảng cáo / sponsored        | `nofollow sponsored`       |
| Link affiliate                    | `nofollow sponsored`       |
| Link do user tạo ra               | `ugc nofollow`             |
| Mọi external link mở tab mới      | Thêm `noopener noreferrer` |

> `noopener noreferrer` là bảo mật, không liên quan SEO — nhưng nên dùng
> khi có `target="_blank"` để tránh lỗ hổng tab-napping.

---

## 4. Canonical Tag

```html
<!-- Self-referencing canonical — bắt buộc trên mọi trang được index -->
<link rel="canonical" href="https://domain.com/blog/ten-bai-viet/" />
```

**Các trường hợp thường bị bỏ sót:**

```html
<!-- Trang phân trang — canonical trỏ về trang đầu nếu nội dung giống nhau -->
<!-- URL: /blog/?page=3 -->
<link rel="canonical" href="https://domain.com/blog/" />

<!-- Trang có query string tracking -->
<!-- URL: /san-pham/?utm_source=facebook -->
<link rel="canonical" href="https://domain.com/san-pham/" />

<!-- Trang được syndicate (đăng lại ở nơi khác) -->
<!-- Site đăng gốc vẫn dùng self-referencing canonical -->
<link rel="canonical" href="https://domain.com/bai-goc/" />
```

| Tình trạng                                             | Mức độ       |
| ------------------------------------------------------ | ------------ |
| Thiếu canonical hoàn toàn                              | `[HIGH]`     |
| Canonical trỏ sai (đến trang redirect hoặc 404)        | `[CRITICAL]` |
| Canonical và URL thực tế khác protocol (http vs https) | `[HIGH]`     |
| Canonical trỏ đến URL không nhất quán trailing slash   | `[MEDIUM]`   |

---

## 5. Media Optimization

### 5.1 Alt Text cho ảnh

```html
<!-- Đúng — mô tả nội dung ảnh, chứa từ khoá tự nhiên -->
<img src="/images/seo-checklist-2026.webp"
     alt="SEO technical checklist cho website Next.js năm 2026"
     width="1200"
     height="630" />

<!-- Sai — alt rỗng (chỉ dùng cho ảnh thuần trang trí) -->
<img src="/images/seo-checklist.webp" alt="" />

<!-- Sai — alt nhồi từ khoá -->
<img src="/images/seo.webp" alt="SEO SEO kỹ thuật SEO tốt nhất SEO 2026" />

<!-- Sai — alt mô tả file thay vì nội dung -->
<img src="/images/img-003.jpg" alt="img-003" />
```

**Quy tắc alt text:**

- Mô tả **nội dung thực tế** của ảnh trong 5–15 từ
- Chèn từ khoá chỉ khi từ khoá đó thực sự liên quan đến nội dung ảnh
- Ảnh trang trí thuần tuý (icon, divider, background): dùng `alt=""` (rỗng, không bỏ hẳn attribute)
- Không bắt đầu bằng "Ảnh của..." hay "Hình ảnh..." — Googlebot và
  screen reader đã biết đó là ảnh

| Tình trạng                        | Mức độ     |
| --------------------------------- | ---------- |
| Ảnh content thiếu alt             | `[HIGH]`   |
| Alt nhồi từ khoá                  | `[HIGH]`   |
| Alt là tên file (`image-001.jpg`) | `[MEDIUM]` |

### 5.2 Width & Height — ngăn CLS

```html
<!-- Bắt buộc khai báo để tránh Cumulative Layout Shift -->
<img src="/images/hero.webp"
     alt="Dashboard affiliate product catalog"
     width="1200"
     height="630" />

<!-- Với CSS responsive — vẫn cần khai báo attribute để browser
     tính aspect ratio trước khi ảnh load xong -->
<img src="/images/hero.webp"
     alt="Dashboard"
     width="1200"
     height="630"
     style="width: 100%; height: auto;" />
```

Thiếu `width`/`height` → browser không biết trước không gian cần dành →
layout shift khi ảnh load → CLS tăng → `[HIGH]` nếu ảnh above the fold.

### 5.3 Lazy Loading

```html
<!-- Ảnh above the fold (hiển thị ngay khi load trang) — KHÔNG lazy load -->
<img src="/images/hero.webp" alt="..." width="1200" height="630" />
<!-- Không có loading="lazy" — đây là đúng -->

<!-- Ảnh below the fold — BẮT BUỘC lazy load -->
<img src="/images/section-2.webp"
     alt="..."
     width="800"
     height="400"
     loading="lazy" />
```

**Quy tắc:**

- Tất cả ảnh below the fold → `loading="lazy"`
- LCP image (ảnh lớn nhất above the fold) → KHÔNG lazy load,
  thêm `fetchpriority="high"` để load sớm hơn:

```html
<img src="/images/hero.webp"
     alt="..."
     width="1200"
     height="630"
     fetchpriority="high" />
```

| Tình trạng                                 | Mức độ                  |
| ------------------------------------------ | ----------------------- |
| LCP image có `loading="lazy"`              | `[HIGH]` — làm chậm LCP |
| Ảnh below fold không có `loading="lazy"`   | `[MEDIUM]`              |
| Thiếu `width`/`height` trên ảnh above fold | `[HIGH]`                |

### 5.4 Format ảnh

Thứ tự ưu tiên format:

```
AVIF > WebP > JPEG (ảnh chụp) / PNG (ảnh có transparency)
GIF → thay bằng WebP animated hoặc video <video autoplay muted loop>
```

```html
<!-- Cung cấp fallback cho browser cũ không hỗ trợ AVIF/WebP -->
<picture>
  <source srcset="/images/hero.avif" type="image/avif" />
  <source srcset="/images/hero.webp" type="image/webp" />
  <img src="/images/hero.jpg" alt="..." width="1200" height="630" />
</picture>
```

**Ngưỡng cảnh báo kích thước file:**

| Kích thước | Mức độ                              |
| ---------- | ----------------------------------- |
| > 500KB    | `[CRITICAL]`                        |
| 200–500KB  | `[HIGH]`                            |
| 100–200KB  | `[MEDIUM]` — cân nhắc compress thêm |
| < 100KB    | ✓                                   |

---

## 6. Preload & Resource Hints

```html
<!-- Preload LCP image — đặt trong <head> càng sớm càng tốt -->
<link rel="preload" as="image" href="/images/hero.webp" fetchpriority="high" />

<!-- Preload font quan trọng — tránh FOUT (Flash of Unstyled Text) -->
<link rel="preload" as="font" type="font/woff2"
      href="/fonts/inter-var.woff2" crossorigin />

<!-- Preconnect đến domain third-party (analytics, fonts) -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

<!-- DNS prefetch cho domain ít quan trọng hơn -->
<link rel="dns-prefetch" href="https://www.google-analytics.com" />
```

**Không lạm dụng preload** — mỗi `<link rel="preload">` không được dùng
sẽ tạo warning trong DevTools và lãng phí bandwidth. Chỉ preload những
resource thực sự critical cho above-the-fold.

---

## 7. Checklist Tổng hợp — Output Format

Khi audit on-page, xuất kết quả theo format:

```
## On-Page DOM Audit — [URL]
Ngày: YYYY-MM-DD

### Meta Tags
- Title: "[nội dung]" — XX ký tự — [✓ / MEDIUM / HIGH / CRITICAL]
- Description: "[nội dung]" — XX ký tự — [trạng thái]
- Canonical: [URL] — [✓ / vấn đề]
- Meta robots: [giá trị] — [✓ / vấn đề]
- OG tags: [✓ đầy đủ / liệt kê thiếu]

### Heading Structure
H1 (x1): "[nội dung]" — [✓ / vấn đề]
H2 (xN): [liệt kê các H2]
Hierarchy: [✓ sequential / nhảy cấp tại H? → H?]

### Links
Internal: [N links, N orphan pages, N broken]
External: [N links, N thiếu rel attribute]

### Images
[Tổng N ảnh]
- Thiếu alt: N ảnh [mức độ]
- Thiếu width/height: N ảnh [mức độ]
- Thiếu lazy loading: N ảnh [mức độ]
- Format nên chuyển sang WebP/AVIF: N ảnh
- Ảnh > 200KB: [danh sách file]
```

---

## 8. Giới hạn phạm vi file này

File này **chỉ xử lý** tầng HTML/DOM on-page. Các chủ đề sau thuộc
file khác:

- Crawlability, robots.txt, sitemap, redirects → `seo-technical-infrastructure.md`
- Schema / JSON-LD / Structured Data → `seo-structured-data.md`
- Content quality, E-E-A-T, keyword strategy → `seo-eeat-content-quality.md`
- AEO / GEO / AI search optimization → `seo-aeo-geo-intelligence.md`
