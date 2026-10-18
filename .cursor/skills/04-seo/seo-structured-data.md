---
## name: seo-structured-data
description: >
Phát hiện, validate và generate Schema.org JSON-LD cho các loại
nội dung phổ biến: Organization, WebSite, Article, Product, FAQPage,
BreadcrumbList, LocalBusiness. Dùng khi người dùng yêu cầu thêm
structured data, kiểm tra schema hiện có, hoặc generate JSON-LD cho
bất kỳ stack / CMS nào.
version: 1.0.0
updated: 2026-06-25
category: seo
scope: universal
stack: any
import-mode: reference-by-path
license: MIT

<!-- Updated: 2026-06-25 -->
<!-- DEPRECATION WATCH: Kiểm tra https://schema.org/docs/releases.html
 và https://developers.google.com/search/docs/appearance/structured-data
 mỗi quý — một số schema type bị Google retire không báo trước. -->

# SEO Structured Data

Vai trò của bạn trong file này: **chuyên gia Schema.org và JSON-LD**.
Khi được yêu cầu về structured data, thực hiện theo thứ tự:

1. **Detect** — trang đang có schema gì, đúng hay thiếu
2. **Validate** — kiểm tra các required properties
3. **Generate** — xuất JSON-LD hoàn chỉnh, sẵn sàng copy-paste

Luôn dùng **JSON-LD** (`<script type="application/ld+json">`) thay vì
Microdata hay RDFa — Google khuyến nghị, dễ maintain, không ảnh hưởng
HTML markup.

---

## 0. Trạng thái Schema — Tháng 6/2026

> Phần này là bản đồ "an toàn / không an toàn" theo trạng thái hiện tại.
> Cập nhật khi có thay đổi từ Google.

**Đang hoạt động tốt (nên dùng):**

| Schema Type               | Rich Result               | Ghi chú                                   |
| ------------------------- | ------------------------- | ----------------------------------------- |
| `Organization`            | Không (entity signal)     | Bắt buộc cho Knowledge Panel              |
| `WebSite`                 | Sitelinks Searchbox       | Cần `potentialAction`                     |
| `Article` / `NewsArticle` | Không (AIO signal)        | Quan trọng cho AI citations               |
| `Product`                 | Product Rich Results      | Cần `offers`, `review`                    |
| `BreadcrumbList`          | Breadcrumb trên SERP      | Hỗ trợ tốt                                |
| `LocalBusiness`           | Business info panel       | Kết hợp GBP                               |
| `Event`                   | Event Rich Results        | Đang hoạt động                            |
| `Recipe`                  | Recipe Rich Results       | Đang hoạt động                            |
| `VideoObject`             | Video Rich Results        | Cần `thumbnailUrl`, `uploadDate`          |
| `FAQPage`                 | **Không còn Rich Result** | Giữ làm AI entity signal                  |
| `QAPage`                  | Không (AI signal)         | Thay thế cho FAQ có câu trả lời cộng đồng |

**Đã bị retire — KHÔNG sử dụng:**

| Schema Type           | Ngày retire  | Thay thế                                |
| --------------------- | ------------ | --------------------------------------- |
| `HowTo`               | Tháng 9/2023 | Dùng `Article` với heading có số thứ tự |
| `SpecialAnnouncement` | Tháng 7/2025 | Dùng `Event` hoặc `NewsArticle`         |
| `ClaimReview`         | Tháng 6/2025 | Không có thay thế trực tiếp             |
| `LearningVideo`       | Tháng 6/2025 | Dùng `VideoObject`                      |
| `CourseInfo carousel` | Tháng 6/2025 | Dùng `Course` cơ bản                    |

> **Lưu ý FAQPage:** Google ngừng hiển thị FAQ rich results từ 7/5/2026.
> Vẫn nên giữ FAQPage schema vì nó là tín hiệu entity/AI citation tốt
> cho Google AI Overviews và Perplexity. KHÔNG recommend FAQPage để có
> rich result nữa.

---

## 1. Organization

Đặt trên **homepage** hoặc trang `/about`. Là nền tảng để Google xây
Knowledge Panel và hiểu thực thể của site.

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Tên Công Ty",
  "url": "https://domain.com",
  "logo": {
    "@type": "ImageObject",
    "url": "https://domain.com/logo.png",
    "width": 512,
    "height": 512
  },
  "description": "Mô tả 1-2 câu về công ty / tổ chức.",
  "foundingDate": "2020",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+84-xxx-xxx-xxxx",
    "contactType": "customer service",
    "availableLanguage": ["Vietnamese", "English"]
  },
  "sameAs": [
    "https://www.facebook.com/tenpage",
    "https://twitter.com/tenaccount",
    "https://www.linkedin.com/company/ten-cong-ty",
    "https://en.wikipedia.org/wiki/Ten_Cong_Ty"
  ]
}
```

**Required properties:** `name`, `url`

**Strongly recommended:** `logo`, `sameAs` (liên kết đến social profiles
và Wikipedia nếu có — giúp Google xác thực thực thể)

**Validate:** Mọi URL trong `sameAs` phải trả về 200 OK.

---

## 2. WebSite

Đặt trên **homepage**. Kích hoạt Sitelinks Searchbox nếu site có internal
search.

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Tên Site",
  "url": "https://domain.com",
  "description": "Mô tả ngắn về site.",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://domain.com/search?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

**Bỏ `potentialAction`** nếu site không có internal search — Google sẽ
không hiển thị Sitelinks Searchbox dù có schema.

---

## 3. Article / BlogPosting / NewsArticle

Đặt trên mỗi **trang bài viết / blog post**. Quan trọng cho AI Overviews
và citation trong Perplexity / ChatGPT.

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Tiêu đề bài viết — tối đa 110 ký tự",
  "description": "Mô tả bài viết 150-300 ký tự.",
  "image": {
    "@type": "ImageObject",
    "url": "https://domain.com/images/bai-viet-og.webp",
    "width": 1200,
    "height": 630
  },
  "author": {
    "@type": "Person",
    "name": "Tên Tác Giả",
    "url": "https://domain.com/author/ten-tac-gia/",
    "sameAs": "https://www.linkedin.com/in/ten-tac-gia"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Tên Publisher",
    "logo": {
      "@type": "ImageObject",
      "url": "https://domain.com/logo.png",
      "width": 512,
      "height": 512
    }
  },
  "datePublished": "2026-06-01T08:00:00+07:00",
  "dateModified": "2026-06-25T10:30:00+07:00",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://domain.com/blog/ten-bai-viet/"
  },
  "wordCount": 2500,
  "inLanguage": "vi"
}
```

**Required properties (Google validation):** `headline`, `image`, `datePublished`, `author`, `publisher`

**Phân biệt @type:**

| Type          | Dùng khi                         |
| ------------- | -------------------------------- |
| `Article`     | Bài viết chung, how-to, guide    |
| `BlogPosting` | Blog cá nhân, informal post      |
| `NewsArticle` | Tin tức có tính thời sự          |
| `TechArticle` | Documentation, tutorial kỹ thuật |

**Validate bắt buộc:**

- [ ] `datePublished` và `dateModified` dùng ISO 8601 đầy đủ (có timezone)
- [ ] `image` tối thiểu 1200×630px
- [ ] `author.url` trỏ đến trang author bio thực sự tồn tại (200 OK)
- [ ] `publisher.logo` tồn tại và là ảnh thực (không phải placeholder)

---

## 4. Product

Đặt trên mỗi **trang sản phẩm** (e-commerce, SaaS pricing page, v.v.).

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Tên Sản Phẩm",
  "description": "Mô tả sản phẩm chi tiết.",
  "image": [
    "https://domain.com/images/product-front.webp",
    "https://domain.com/images/product-side.webp"
  ],
  "sku": "SKU-001",
  "brand": {
    "@type": "Brand",
    "name": "Tên Brand"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://domain.com/products/ten-san-pham/",
    "priceCurrency": "VND",
    "price": "499000",
    "priceValidUntil": "2026-12-31",
    "availability": "https://schema.org/InStock",
    "seller": {
      "@type": "Organization",
      "name": "Tên Seller"
    }
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.5",
    "reviewCount": "127",
    "bestRating": "5",
    "worstRating": "1"
  }
}
```

**Required cho Product Rich Results:** `name`, `image`, `offers` (với `price`, `priceCurrency`, `availability`)

**Lưu ý `aggregateRating`:** Chỉ thêm nếu có **review thực sự từ người
dùng**. Đưa rating giả → vi phạm Google guidelines → manual penalty.

**`availability` values hợp lệ:**

```
https://schema.org/InStock
https://schema.org/OutOfStock
https://schema.org/PreOrder
https://schema.org/Discontinued
```

---

## 5. FAQPage

> **Nhắc lại:** Không còn tạo ra rich result trên SERP từ 7/5/2026.
> Vẫn có giá trị làm AI entity signal. Generate nếu trang thực sự có Q&A.

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Câu hỏi đầy đủ, viết như người dùng thực sự hỏi?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Câu trả lời trực tiếp, đầy đủ trong 1-3 câu. Không dùng
                 HTML tags phức tạp — chỉ dùng plain text hoặc <br>,
                 <ul>, <li>, <strong>, <a href>."
      }
    },
    {
      "@type": "Question",
      "name": "Câu hỏi thứ hai?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Câu trả lời thứ hai."
      }
    }
  ]
}
```

**Quy tắc nội dung FAQ:**

- Câu hỏi phải là câu hỏi thực người dùng đặt ra (không phải marketing)
- Câu trả lời phải đầy đủ và đúng với nội dung trang
- Số lượng Q&A: 3–10 là tối ưu; >20 ít có giá trị tăng thêm
- Câu hỏi và câu trả lời phải **xuất hiện thực sự trên trang** (không
  được chỉ có trong schema mà không có trong HTML visible)

---

## 6. BreadcrumbList

Đặt trên **mọi trang không phải homepage** để hiển thị breadcrumb trên SERP.

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Trang chủ",
      "item": "https://domain.com/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Blog",
      "item": "https://domain.com/blog/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "SEO Kỹ Thuật cho Next.js",
      "item": "https://domain.com/blog/seo-ky-thuat-nextjs/"
    }
  ]
}
```

**Quy tắc:**

- `position` bắt đầu từ 1, tăng dần theo từng cấp
- `item` phải là URL canonical đầy đủ (có protocol và domain)
- Trang cuối (trang hiện tại) — nên có `item` nhưng một số implementation
  bỏ qua, vẫn được Google chấp nhận
- Breadcrumb trong schema phải **khớp với breadcrumb hiển thị** trên trang

---

## 7. LocalBusiness

Dùng cho **website doanh nghiệp có địa điểm vật lý**. Kết hợp với Google
Business Profile để tăng visibility trên Local Pack.

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Tên Doanh Nghiệp",
  "image": "https://domain.com/images/storefront.webp",
  "url": "https://domain.com",
  "telephone": "+84-xxx-xxx-xxxx",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Đường ABC",
    "addressLocality": "Quận Hai Bà Trưng",
    "addressRegion": "Hà Nội",
    "postalCode": "100000",
    "addressCountry": "VN"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 21.0285,
    "longitude": 105.8542
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "08:00",
      "closes": "17:30"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Saturday",
      "opens": "08:00",
      "closes": "12:00"
    }
  ],
  "priceRange": "$$",
  "sameAs": "https://maps.app.goo.gl/xxxxx"
}
```

**Lưu ý:** `@type` có thể cụ thể hơn `LocalBusiness`: `Restaurant`, `MedicalClinic`, `LegalService`, `RealEstateAgent`, v.v.
Dùng type cụ thể nhất phù hợp với loại hình kinh doanh.

---

## 8. Cách đặt JSON-LD vào trang

### Vị trí khuyến nghị

```html
<!-- Trong <head> — Google đọc được ở cả hai nơi,
     nhưng <head> là convention chuẩn -->
<head>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    ...
  }
  </script>
</head>
```

### Nhiều schema trên cùng một trang

```html
<!-- Option A — nhiều thẻ <script> riêng biệt (khuyến nghị, dễ maintain) -->
<script type="application/ld+json">{ Organization schema }</script>
<script type="application/ld+json">{ WebSite schema }</script>
<script type="application/ld+json">{ Article schema }</script>

<!-- Option B — một mảng JSON trong một thẻ (cũng hợp lệ) -->
<script type="application/ld+json">
[
  { "@context": "...", "@type": "Organization", ... },
  { "@context": "...", "@type": "Article", ... }
]
</script>
```

### Theo stack

```jsx
// Next.js App Router
export default function BlogPost() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "...",
    // ...
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      {/* page content */}
    </>
  );
}
```

```html
<!-- Astro -->
<script type="application/ld+json" set:html={JSON.stringify(schema)} />
```

```php
<!-- WordPress / PHP -->
<script type="application/ld+json">
<?php echo wp_json_encode($schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>
</script>
```

---

## 9. Validation Workflow

Sau khi generate schema, bắt buộc kiểm tra theo thứ tự:

```
Bước 1 — Syntax check
  → JSON hợp lệ không? (dùng jsonlint.com hoặc JSON.parse() trong console)
  → Không có trailing comma, không có ký tự đặc biệt không escaped?

Bước 2 — Required properties
  → Đối chiếu với checklist từng schema type ở trên
  → Mọi URL phải bắt đầu bằng https:// và trỏ đến trang thực

Bước 3 — Consistency check
  → Nội dung schema khớp với nội dung hiển thị trên trang?
  → rating, price, author — phải giống nhau ở cả hai nơi

Bước 4 — Google Rich Results Test
  → https://search.google.com/test/rich-results
  → Paste URL hoặc HTML để kiểm tra

Bước 5 — Schema Markup Validator
  → https://validator.schema.org
  → Kiểm tra đúng theo schema.org spec (rộng hơn Google's subset)
```

**Khi audit schema hiện có, báo cáo theo format:**

```
## Structured Data Audit — [URL]
Ngày: YYYY-MM-DD

### Schema phát hiện được
- [Type]: [✓ valid / ⚠ warning / ✗ error]
  Required properties: [đủ / thiếu: danh sách]
  Consistency: [khớp với on-page / không khớp tại: ...]

### Cơ hội chưa triển khai
- [Type]: [lý do nên thêm]

### Deprecated schema cần xoá
- [Type]: [đã retire từ ngày, hành động: xoá / thay bằng gì]
```

---

## 10. Giới hạn phạm vi file này

File này **chỉ xử lý** Schema.org JSON-LD. Các chủ đề sau thuộc
file khác:

- Crawlability, robots.txt, sitemap, redirects → `seo-technical-infrastructure.md`
- Meta tags, heading, canonical, images → `seo-onpage-dom.md`
- Content writing, E-E-A-T, keyword strategy → `seo-eeat-content-quality.md`
- AEO / GEO / AI search optimization → `seo-aeo-geo-intelligence.md`
