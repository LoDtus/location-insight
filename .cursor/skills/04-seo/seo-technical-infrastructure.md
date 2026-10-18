---
name: seo-technical-infrastructure
description: >
  Kiểm tra và thiết lập hạ tầng kỹ thuật SEO: crawlability, indexing,
  URL architecture, redirects, và status code handling. Dùng khi người
  dùng yêu cầu audit kỹ thuật, kiểm tra robots.txt / sitemap, xử lý
  redirect, hoặc chuẩn hoá cấu trúc URL cho bất kỳ stack nào.
version: 1.1.0
updated: 2026-09-11
category: seo
scope: universal
stack: any
import-mode: reference-by-path
license: MIT
---

<!-- Updated: 2026-09-11 -->

# SEO Technical Infrastructure

Vai trò của bạn trong file này: **kiểm toán viên hạ tầng kỹ thuật SEO**.
Đọc toàn bộ nội dung trước khi thực hiện bất kỳ thao tác nào. Ưu tiên
phát hiện vấn đề có tác động lớn nhất trước, ghi nhãn mức độ:
`[CRITICAL]` → `[HIGH]` → `[MEDIUM]` → `[LOW]`.

---

## 1. Crawlability & Indexing

### 1.1 robots.txt

**Vị trí chuẩn:** `https://domain.com/robots.txt` — phải ở root, không
được đặt trong subfolder.

**Quy tắc cho phép/chặn:**

```
# Template chuẩn
User-agent: *
Disallow: /admin/
Disallow: /api/private/
Disallow: /*?*session*
Disallow: /checkout/
Allow: /api/public/

Sitemap: https://domain.com/sitemap.xml
```

Kiểm tra các lỗi phổ biến:

- `Disallow: /` — chặn toàn bộ site → `[CRITICAL]`
- Chặn nhầm thư mục chứa assets CSS/JS cần thiết cho rendering → `[HIGH]`
- Thiếu dòng `Sitemap:` → `[MEDIUM]`
- Dùng wildcard `*` không đúng cú pháp → `[MEDIUM]`
- Không có file robots.txt (Google mặc định cho phép crawl hết) → `[LOW]`

**Quy tắc không được vi phạm:**

- `noindex` trong `<meta robots>` và `Disallow` trong `robots.txt` là hai
  cơ chế độc lập. Trang bị `Disallow` mà Google vẫn có thể biết đến từ
  link ngoài sẽ không được index nhưng vẫn có thể xuất hiện trong kết quả
  không có snippet. Kết hợp đúng: `noindex` ở trong `<head>` + không bị
  `Disallow` (để Googlebot vào đọc thẻ noindex được).

### 1.2 XML Sitemap

**Cấu trúc sitemap đúng:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://domain.com/page/</loc>
    <lastmod>2026-06-01</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

**Phân cấp sitemap cho site lớn (>50.000 URL):**

```xml
<!-- sitemap-index.xml -->
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://domain.com/sitemap-pages.xml</loc>
    <lastmod>2026-06-25</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://domain.com/sitemap-blog.xml</loc>
    <lastmod>2026-06-25</lastmod>
  </sitemap>
</sitemapindex>
```

**Checklist bắt buộc:**

- [ ] Sitemap chỉ chứa URL canonical, không chứa URL bị `noindex`
- [ ] Không chứa URL trả về 4xx hoặc 3xx
- [ ] `<lastmod>` dùng format ISO 8601 (`YYYY-MM-DD` hoặc `YYYY-MM-DDTHH:MM:SSZ`)
- [ ] Mỗi file sitemap ≤ 50.000 URL và ≤ 50MB (uncompressed)
- [ ] Đã khai báo trong `robots.txt` và đã submit vào Google Search Console

**Tần suất cập nhật khuyến nghị:**

| Loại nội dung | changefreq | priority |
|---|---|---|
| Homepage | daily | 1.0 |
| Blog/article (mới) | weekly | 0.8 |
| Blog/article (cũ, ít update) | monthly | 0.5 |
| Category/tag pages | weekly | 0.6 |
| Static pages (About, Contact) | monthly | 0.4 |

> `changefreq` và `priority` là gợi ý, không phải lệnh bắt buộc với
> Google. Tập trung vào `lastmod` chính xác hơn.

---

## 2. URL Architecture

### 2.1 Quy tắc đặt slug

**Bắt buộc:**

- Chỉ dùng chữ thường (`lowercase`) — không dùng `CamelCase` hay `UPPER`
- Dùng dấu gạch ngang `-` để phân tách từ — tuyệt đối không dùng `_`
  (underscore) hoặc khoảng trắng
- Không chứa ký tự đặc biệt: `& ? # % + = @ ! $ , ; : ' " < > [ ] { }`
- Không chứa thông số tracking trong URL chính (dùng UTM chỉ trong
  campaign link, không để Google index)
- Độ dài URL hợp lý: ≤ 75 ký tự (bao gồm domain) là tốt nhất

**Chính sách trailing slash:**

Chọn một trong hai và duy trì nhất quán trên toàn site:

```
# Option A — có trailing slash
https://domain.com/blog/ten-bai-viet/   ✓
https://domain.com/blog/ten-bai-viet    ✗ (redirect về option A)

# Option B — không có trailing slash
https://domain.com/blog/ten-bai-viet    ✓
https://domain.com/blog/ten-bai-viet/   ✗ (redirect về option B)
```

> Không được để cả hai cùng tồn tại song song vì tạo ra duplicate content.
> Canonical phải trỏ về phiên bản được chọn.

**Cấu trúc URL theo loại nội dung:**

```
# Blog / Articles
/blog/{slug}
/blog/{category}/{slug}         # nếu cần phân loại

# Sản phẩm (E-commerce)
/products/{slug}
/products/{category}/{slug}     # tối đa 2 cấp category

# Trang tĩnh
/about
/contact
/pricing

# Tránh
/p=123                          # không mang ngữ nghĩa
/blog/2026/06/25/ten-bai        # ngày tháng làm URL dài và cứng
/category/subcategory/subsubcategory/product  # quá sâu (>4 cấp)
```

### 2.2 Canonicalization

Mỗi trang phải có đúng một `canonical` URL. Các trường hợp bắt buộc cần
khai báo canonical:

| Tình huống | Hành động |
|---|---|
| `http://` và `https://` cùng tồn tại | Canonical trỏ về `https://` |
| `www` và non-`www` | Chọn một, canonical + redirect 301 |
| Trailing slash inconsistency | Canonical trỏ về phiên bản chuẩn |
| Trang phân trang listing (`/blog/?page=2`) | **Self-canonical** — mỗi trang giữ canonical riêng vì nội dung khác nhau |
| Trang phân trang nội dung giống hệt trang 1 | Canonical trỏ về trang 1 (trường hợp hiếm) |
| URL có tracking params (`?utm_source=`) | Canonical trỏ về URL sạch |
| Nội dung được syndicate sang domain khác | Site đăng gốc dùng self-referencing canonical |

> **Lưu ý phân trang:** Trang `/blog/?page=3` liệt kê các bài viết khác
> trang 1 — đây là nội dung khác, phải self-canonical. Canonical về trang
> 1 sẽ ngăn Google index các trang listing tiếp theo, làm mất khả năng
> crawl các bài viết chỉ xuất hiện ở trang 2, 3, 4...

```html
<!-- Trong <head> -->
<link rel="canonical" href="https://domain.com/blog/ten-bai-viet/" />
```

### 2.3 Chính sách index cho URL do app sinh ra

**Nguyên tắc một dòng:** Index những URL có giá trị tìm kiếm độc lập —
`noindex` và loại khỏi sitemap tất cả những URL còn lại.

**Các nhóm URL phổ biến cần `noindex` + loại khỏi sitemap:**

```
# Tìm kiếm và lọc nội bộ
/search?q=...
/products?color=red&size=M&sort=price     ← filter/sort params
/blog?tag=seo&category=technical          ← kết hợp filter

# Trạng thái giao dịch — không có giá trị SEO
/checkout/
/checkout/success/
/checkout/payment/
/cart/
/thank-you/

# Tài khoản và dashboard người dùng
/account/
/account/orders/
/account/settings/
/dashboard/

# Nội dung chưa public
/preview/
/draft/
/admin/
/staging/

# Kỹ thuật
/api/
/wp-json/
/.well-known/
```

**Cách thực thi:**

```html
<!-- Trong <head> của các trang này -->
<meta name="robots" content="noindex, follow" />
```

```
# Trong robots.txt — chặn crawl hoàn toàn (không cần index)
Disallow: /admin/
Disallow: /api/private/
Disallow: /checkout/

# KHÔNG Disallow trang noindex cần Googlebot vào đọc thẻ
# (xem mục 1.1 — noindex + Disallow là lỗi phổ biến)
```

**Quy tắc phán định nhanh:**

```
Câu hỏi: "Nếu URL này xuất hiện trên Google, người dùng có tìm kiếm
          và click vào không?"

→ Có  → index, thêm vào sitemap
→ Không → noindex, loại khỏi sitemap
→ Không chắc → noindex cho đến khi có bằng chứng ngược lại
```

---

## 3. Redirects

### 3.1 Loại redirect và khi nào dùng

| Mã | Tên | Dùng khi | Ghi chú |
|---|---|---|---|
| `301` | Moved Permanently | Di chuyển vĩnh viễn trang/domain | Chuyển link equity |
| `302` | Found (Temporary) | Chuyển tạm thời (A/B test, maintenance) | Không chuyển link equity |
| `307` | Temporary Redirect | Như 302 nhưng giữ nguyên HTTP method | Dùng cho POST requests |
| `308` | Permanent Redirect | Như 301 nhưng giữ nguyên HTTP method | Ít phổ biến |

**Quy tắc bắt buộc:**

- Mọi chuyển hướng vĩnh viễn (đổi domain, xoá/đổi URL) → **bắt buộc dùng 301**
- KHÔNG bao giờ dùng 302 cho trang đã bị xoá vĩnh viễn

### 3.2 Redirect chains — phải loại bỏ

Redirect chain là chuỗi chuyển hướng qua nhiều bước, làm chậm tốc độ
crawl và có thể gây mất link equity:

```
# Bad — redirect chain 3 bước
A → B → C → D (final destination)

# Good — direct redirect
A → D
B → D
C → D
```

**Kiểm tra redirect chain:**

```bash
# Kiểm tra số bước redirect
curl -sIL -o /dev/null -w "%{url_effective}\n%{num_redirects}\n" https://domain.com/old-url
```

Cảnh báo nếu:
- Chain ≥ 2 bước → `[HIGH]`
- Chain ≥ 3 bước → `[CRITICAL]`
- Redirect loop (A → B → A) → `[CRITICAL]`

### 3.3 Redirect khi đổi domain

```
# Đúng — 301 tất cả URL theo cấu trúc
https://old-domain.com/*  →  https://new-domain.com/*

# Tránh — redirect tất cả về homepage
https://old-domain.com/blog/bai-viet  →  https://new-domain.com/   ✗
```

---

## 4. HTTP Status Codes

### 4.1 Xử lý trang 404

Trang 404 chuẩn SEO phải có:

```html
<!-- HTTP response header phải là 404, không phải 200 ("soft 404") -->
HTTP/1.1 404 Not Found

<!-- Nội dung trang 404 -->
- Thông báo rõ ràng trang không tồn tại
- Link về homepage
- Search box (nếu có)
- Gợi ý các trang liên quan
- Thiết kế nhất quán với phần còn lại của site
```

**Soft 404** — lỗi phổ biến cần tránh:

```
# Soft 404: server trả về 200 OK nhưng nội dung thông báo "không tìm thấy"
HTTP/1.1 200 OK
Body: "Trang này không tồn tại"   ← Google sẽ index trang rỗng này
```

Kiểm tra soft 404 trong Google Search Console > Coverage > Excluded >
"Soft 404".

### 4.2 Xử lý 5xx

| Mã | Tình huống | Hành động SEO |
|---|---|---|
| `500` Internal Server Error | Lỗi server tạm thời | Google sẽ retry, không deindex ngay |
| `503` Service Unavailable | Maintenance | Phải kèm `Retry-After` header để Google biết là tạm thời |
| `504` Gateway Timeout | Server quá tải | Kiểm tra hosting/CDN |

**Maintenance mode đúng cách:**

```
HTTP/1.1 503 Service Unavailable
Retry-After: 3600
```

> Nếu 503 kéo dài >1 tuần liên tục, Google sẽ bắt đầu deindex. Đây là
> `[CRITICAL]` nếu phát hiện.

### 4.3 Bản đồ status code theo tình huống

```
Trang bình thường        → 200 OK
Trang đã chuyển vĩnh viễn → 301 → URL mới (200)
Trang đã xoá, không thay thế → 410 Gone (tốt hơn 404)
Trang bị block intentionally → 403 Forbidden (nếu cần)
```

---

## 5. Server-First Rendering — Yêu cầu với JS Framework

Áp dụng khi dự án dùng: **Next.js, Nuxt, Astro, SvelteKit, NestJS SSR,
Angular Universal, Remix** — hoặc bất kỳ framework nào render một phần
hoặc toàn bộ bằng JavaScript phía client.

### 5.1 Nguyên tắc cốt lõi

Googlebot có khả năng render JavaScript, nhưng:

- Rendering JS xảy ra **sau** khi crawl HTML ban đầu, có thể trễ hàng
  giờ đến hàng ngày
- Nội dung chỉ có trong JS (client-side fetch, `useEffect`, hydration)
  **không đáng tin cậy bằng** nội dung có sẵn trong HTML response đầu
- Google chính thức khuyến nghị: nội dung quan trọng cho SEO phải có
  trong HTML server response

**Bắt buộc phải có trong HTML lần render đầu (không phụ thuộc JS):**

```
✓ <title>
✓ <meta name="description">
✓ <link rel="canonical">
✓ <meta name="robots">
✓ Thẻ H1 và cấu trúc heading chính
✓ Nội dung văn bản chính của trang (body text)
✓ Internal links quan trọng
✓ <script type="application/ld+json"> (Schema)
✓ Open Graph tags
```

### 5.2 Kiểm tra rendering

```bash
# Xem HTML thuần server trả về — không có JS
curl -s https://domain.com/blog/ten-bai-viet/ | grep -E "<title>|<h1>|canonical|description"

# Nếu output rỗng hoặc thiếu → nội dung đang render client-side → [CRITICAL]
```

**Dùng Google Search Console để xác nhận:**

```
URL Inspection Tool → Test Live URL → View Tested Page → HTML tab
→ Nội dung có trong HTML không?
→ Screenshot tab: trang render đúng không?
```

### 5.3 Lỗi phổ biến theo từng framework

**Next.js App Router:**

```tsx
// ✗ Sai — metadata trong useEffect, Googlebot không đọc được
'use client'
useEffect(() => {
  document.title = post.title  // quá muộn
}, [post])

// ✓ Đúng — generateMetadata server-side
export async function generateMetadata({ params }) {
  const post = await getPost(params.slug)
  return {
    title: post.title,
    description: post.excerpt,
  }
}
```

```tsx
// ✗ Sai — nội dung fetch client-side
'use client'
const [data, setData] = useState(null)
useEffect(() => {
  fetch('/api/content').then(r => r.json()).then(setData)
}, [])
return <div>{data?.content}</div>  // rỗng khi Googlebot đến

// ✓ Đúng — fetch server-side trong Server Component
async function Page({ params }) {
  const data = await getContent(params.slug)  // server fetch
  return <div>{data.content}</div>             // có trong HTML ngay
}
```

**Nuxt 3:**

```ts
// ✗ Sai — chỉ chạy client
onMounted(() => {
  useSeoMeta({ title: data.value?.title })
})

// ✓ Đúng — useSeoMeta trong setup (SSR)
const { data } = await useFetch('/api/page')
useSeoMeta({
  title: data.value?.title,
  description: data.value?.excerpt,
})
```

**SPA thuần (Vue/React không có SSR):**

```
SPA không có SSR → Googlebot nhận HTML rỗng ban đầu → [HIGH] cho
mọi nội dung và metadata quan trọng.

Giải pháp theo mức độ:
1. Chuyển sang SSR/SSG (Next.js, Nuxt, Astro) — tốt nhất
2. Dùng prerendering (react-snap, prerender.io) — trung bình
3. Dynamic rendering (serve HTML cho bot, JS cho user) — chấp nhận được
   nhưng Google không khuyến nghị về lâu dài
```

### 5.4 Checklist server-first

```
[ ] curl URL → <title> có trong output          [CRITICAL nếu không]
[ ] curl URL → <h1> có trong output             [HIGH nếu không]
[ ] curl URL → nội dung chính có trong output   [HIGH nếu không]
[ ] curl URL → canonical có trong output        [HIGH nếu không]
[ ] curl URL → JSON-LD có trong output          [MEDIUM nếu không]
[ ] GSC URL Inspection → HTML tab khớp với curl [xác nhận cuối]
```

---

## 6. HTTPS & Security Headers

### 6.1 Bắt buộc

- Toàn bộ site phải chạy HTTPS — mixed content (HTTP asset trên HTTPS
  page) → `[HIGH]`
- HSTS header nên được bật sau khi HTTPS ổn định:
  ```
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  ```

### 6.2 Core Web Vitals liên quan đến hạ tầng

Các chỉ số CWV bị ảnh hưởng bởi hạ tầng kỹ thuật:

| Chỉ số | Ngưỡng tốt | Nguyên nhân kỹ thuật phổ biến |
|---|---|---|
| TTFB (Time to First Byte) | < 800ms | Server response chậm, thiếu CDN, không cache |
| LCP (Largest Contentful Paint) | < 2.5s | Ảnh lớn, font blocking, server chậm |
| CLS (Cumulative Layout Shift) | < 0.1 | Thiếu `width`/`height` trên ảnh, font swap |
| INP (Interaction to Next Paint) | < 200ms | JS blocking main thread |

> CWV là ranking signal. TTFB không phải ranking signal trực tiếp nhưng
> ảnh hưởng đến LCP.

---

## 7. Internationalisation — hreflang (chỉ khi đa ngôn ngữ / đa locale)

> **Bỏ qua section này nếu site chỉ có một ngôn ngữ.**
> Implement hreflang sai còn tệ hơn không có — chỉ thêm khi thực sự
> cần phục vụ nhiều ngôn ngữ hoặc nhiều phiên bản khu vực.

### 7.1 Khi nào cần hreflang

```
Cần hreflang khi:
✓ Site có nội dung cùng chủ đề bằng nhiều ngôn ngữ khác nhau
  (vi, en, ja, ko...)
✓ Site có nội dung cùng ngôn ngữ nhưng cho nhiều quốc gia khác nhau
  (en-US vs en-GB, pt-BR vs pt-PT)

Không cần hreflang khi:
✗ Site chỉ có một ngôn ngữ duy nhất
✗ Các phiên bản ngôn ngữ khác nhau chứa nội dung hoàn toàn khác nhau
  (không phải bản dịch của nhau)
```

### 7.2 Cú pháp chuẩn

Mỗi URL trong cặp ngôn ngữ phải khai báo **tất cả** các phiên bản,
bao gồm chính nó (self-referencing):

```html
<!-- Đặt trong <head> của MỖI trang, trên MỌI phiên bản ngôn ngữ -->

<!-- Trên trang tiếng Việt: /vi/blog/seo-ky-thuat/ -->
<link rel="alternate" hreflang="vi" href="https://domain.com/vi/blog/seo-ky-thuat/" />
<link rel="alternate" hreflang="en" href="https://domain.com/en/blog/technical-seo/" />
<link rel="alternate" hreflang="x-default" href="https://domain.com/en/blog/technical-seo/" />

<!-- Trên trang tiếng Anh: /en/blog/technical-seo/ — khai báo giống hệt -->
<link rel="alternate" hreflang="vi" href="https://domain.com/vi/blog/seo-ky-thuat/" />
<link rel="alternate" hreflang="en" href="https://domain.com/en/blog/technical-seo/" />
<link rel="alternate" hreflang="x-default" href="https://domain.com/en/blog/technical-seo/" />
```

**`x-default`:** Trỏ đến phiên bản mặc định khi không có ngôn ngữ nào
khớp với người dùng. Thường là phiên bản tiếng Anh hoặc trang chọn ngôn ngữ.

**Locale codes phổ biến:**

```
vi       — Tiếng Việt (mọi quốc gia)
en       — Tiếng Anh (mọi quốc gia)
en-US    — Tiếng Anh, Mỹ
en-GB    — Tiếng Anh, Anh
zh-CN    — Tiếng Trung giản thể
zh-TW    — Tiếng Trung phồn thể
ja       — Tiếng Nhật
ko       — Tiếng Hàn
```

### 7.3 Lỗi hreflang phổ biến

| Lỗi | Hậu quả | Mức độ |
|---|---|---|
| Chỉ khai báo một chiều (A trỏ B, B không trỏ lại A) | Google bỏ qua toàn bộ hreflang | `[CRITICAL]` |
| Thiếu `x-default` | Google không biết phiên bản fallback | `[MEDIUM]` |
| URL trong hreflang trả về 404 hoặc redirect | Vô hiệu hoá signal | `[HIGH]` |
| Canonical và hreflang mâu thuẫn nhau | Confuse Googlebot | `[HIGH]` |
| Dùng sai locale code (`cn` thay vì `zh-CN`) | Google không nhận ra | `[MEDIUM]` |

### 7.4 Cách triển khai thay thế (Sitemap)

Thay vì `<link>` trong `<head>`, có thể khai báo trong sitemap XML —
phù hợp khi site có nhiều URL và muốn quản lý tập trung:

```xml
<url>
  <loc>https://domain.com/vi/blog/seo-ky-thuat/</loc>
  <xhtml:link rel="alternate" hreflang="vi"
    href="https://domain.com/vi/blog/seo-ky-thuat/"/>
  <xhtml:link rel="alternate" hreflang="en"
    href="https://domain.com/en/blog/technical-seo/"/>
  <xhtml:link rel="alternate" hreflang="x-default"
    href="https://domain.com/en/blog/technical-seo/"/>
</url>
```

> Chọn một trong hai cách (HTML `<head>` hoặc sitemap) và dùng nhất quán —
> không dùng cả hai cùng lúc trừ khi chủ ý.

---

## 8. Audit Checklist — Output Format

Khi thực hiện audit, xuất kết quả theo format sau:

```
## Technical Infrastructure Audit — [domain.com]
Ngày audit: YYYY-MM-DD

### Tổng điểm: XX/100

### [CRITICAL] — Cần sửa ngay
1. [Mô tả vấn đề]
   → Nguyên nhân: ...
   → Cách sửa: ...
   → Kiểm tra lại: ...

### [HIGH] — Sửa trong sprint tới
...

### [MEDIUM] — Backlog
...

### [LOW] — Cân nhắc
...

### Đã đạt chuẩn ✓
- ...
```

---

## 9. Giới hạn phạm vi file này

File này **chỉ xử lý** tầng hạ tầng kỹ thuật. Các chủ đề sau thuộc
file khác trong bộ skill:

- On-page HTML/DOM optimization → `seo-onpage-dom.md`
- Schema / Structured Data → `seo-structured-data.md`
- Content quality / E-E-A-T → `seo-eeat-content-quality.md`
- AEO / GEO / AI search optimization → `seo-aeo-geo-intelligence.md`