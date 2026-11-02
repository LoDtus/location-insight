# Technical Research — Ứng dụng web cài đặt được (PWA)

Nguồn tham khảo (đọc ngày 02/11/2026). Không có nguồn nào là số đo của dự án này.

- Mẫu Chrome, [Notifications API sample](https://googlechrome.github.io/samples/pwa-testing/notificationsapi/): thông báo không bền (từ trang) so với bền (qua service worker); lưu ý icon/tiêu đề thông báo lấy từ manifest khi đã cài PWA.
- web.dev, [Progressive Web Apps](https://web.dev/learn/pwa) và [Installation criteria](https://web.dev/articles/install-criteria); MDN, [Web app manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest) và [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API).
- Next.js, [Progressive Web Applications guide](https://nextjs.org/docs/app/guides/progressive-web-apps): manifest bằng `app/manifest.ts`, service worker tay ở `public/sw.js` kèm tiêu đề bảo mật, thử push bằng `web-push`.
- WebKit, [Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) (iOS 16.4: chỉ ứng dụng đã thêm vào Màn hình chính, cần thao tác người dùng để hỏi quyền, push phải hiển thị) và [WebKit Features in Safari 18.4](https://webkit.org/blog/16574/) (Declarative Web Push).
- Serwist ([github.com/serwist/serwist](https://github.com/serwist/serwist)), Workbox ([github.com/GoogleChrome/workbox](https://github.com/GoogleChrome/workbox)): chiến lược lưu đệm và precache cho service worker.
- W3C [Badging API](https://w3c.github.io/badging/), [Service Workers](https://www.w3.org/TR/service-workers/).
- Mastodon và Element/Matrix web: dùng service worker để nhận push, chỉ lưu đệm tài nguyên tĩnh; đều có tùy chọn ẩn nội dung thông báo.

Lưu ý: chi tiết hỗ trợ trình duyệt (đặc biệt Safari/iOS và Declarative Web Push) thay đổi nhanh. **Kiểm lại bảng tương thích trên MDN/WebKit trước khi triển khai**, không dựa vào bảng dưới đây như số liệu cố định.

## Tương thích dự kiến (cần kiểm lại)

| Nền tảng | Web Push | Điều kiện |
| --- | --- | --- |
| Chrome, Edge (Windows, macOS, Linux, Android) | Có | HTTPS, SW, quyền thông báo |
| Firefox (desktop, Android) | Có | Như trên |
| Safari macOS 13+ | Có | Cần thao tác người dùng để hỏi quyền; không bắt buộc cài vào Dock |
| Safari/Chrome/Firefox trên iOS và iPadOS 16.4+ | Có, **chỉ ứng dụng đã thêm vào Màn hình chính** | Mọi trình duyệt iOS dùng WebKit nên cùng ràng buộc |
| Badging API | Chromium (cài PWA), Safari 16.4+ (PWA đã cài) | Phát hiện tính năng |

---

## Bản ghi quyết định 1 — Service worker viết tay, một tệp, phạm vi `/`, không Workbox ở giai đoạn 1 <!-- key: decision_record -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Cần SW cho push và thông báo. Lưu đệm chỉ cần rất hẹp (tài nguyên tĩnh có băm, trang ngoại tuyến). Ứng dụng có dữ liệu riêng tư và bản đồ nặng, nên lưu đệm rộng là rủi ro, không phải lợi ích.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| SW tay (`sw.ts` → `public/sw.js`) theo hướng dẫn của Next.js | Không thêm thư viện runtime | ~150–250 dòng, đọc được, dễ gỡ lỗi | Dễ chuyển sang Serwist | Phải tự lo phiên bản lưu đệm và dọn bản cũ |
| Serwist (`@serwist/next`) | Tích hợp Next, precache sinh tự động | Thêm cấu hình bundler (dễ lệch với Turbopack/Next 16), nhiều khái niệm | Trung bình | Hợp khi cần precache rộng hay lưu đệm thời gian chạy phức tạp |
| Workbox trực tiếp | Cần bước build | Trung bình | Dễ | Thư viện lớn so với nhu cầu |
| `next-pwa` | — | **Không được bảo trì tích cực**, vi phạm quy tắc "không dùng thư viện bỏ hoang" | Khó | Loại |

### Quyết định <!-- key: decision -->

SW tay, kiểu TypeScript chặt, build bằng **`tsc` sẵn có** (`tsconfig.sw.json` với `lib: ["webworker"]`, `module: "none"`/ES2022, một tệp, không import) rồi script Node chèn `BUILD_ID` và ghi `public/sw.js`. Chọn `tsc` thay vì esbuild vì không thêm phụ thuộc nào và ít thứ có thể hỏng nhất về lâu dài; nếu SW phải chia nhiều tệp hay dùng thư viện thì thay bằng esbuild (đổi một script, không đổi hợp đồng). Bắt đầu với 4 trình xử lý sự kiện và một chiến lược lưu đệm duy nhất (cache-first cho `/_next/static/**`, `/icons/**`). Nếu sau này cần lưu đệm rộng thì thay bằng Serwist, hợp đồng thông điệp giữ nguyên.

### Hệ quả <!-- key: consequences -->

- Ít mã, ít phụ thuộc, dễ kiểm tra bảo mật.
- Phải có kiểm thử tự động cho các nhánh `push`, `notificationclick`, `activate` (dọn bộ nhớ đệm cũ).
- Không thêm phụ thuộc mới; mã SW giữ trong một tệp để không cần bundler (hạn chế đã chấp nhận).

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ: thay tệp SW; trình duyệt tự cập nhật theo byte khác.

---

## Bản ghi quyết định 2 — Chỉ lưu đệm tài nguyên tĩnh; mọi dữ liệu và HTML đã xác thực đi thẳng mạng <!-- key: decision_record -->

**Status:** Accepted
**Category:** Performance & Scale
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Lưu đệm HTML/API trong SW làm lộ dữ liệu trên thiết bị dùng chung sau đăng xuất, và dễ phục vụ trang cũ. Lát bản đồ Vietmap có điều khoản và chi phí riêng.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Cache-first cho tài nguyên tĩnh có băm + `/offline`; còn lại network-only | Tài nguyên `/_next/static` đã bất biến | Đơn giản, ít lỗi tinh vi | Dễ | Lần tải lặp nhanh hơn, không ảnh hưởng quyền riêng tư |
| Stale-while-revalidate cho HTML/API | Có | Dễ phục vụ dữ liệu cũ/sai người dùng | Trung bình | Loại |
| Precache toàn bộ ứng dụng (ngoại tuyến thật) | Cần Serwist | Phức tạp | Khó | Không nằm trong mục tiêu giai đoạn 1 |

### Quyết định <!-- key: decision -->

Phương án đầu. Giới hạn 20 MB, tên bộ nhớ đệm có phiên bản (`static-v{BUILD_ID}`), `activate` xóa bản cũ. Điều hướng thất bại do mạng (`fetch` ném lỗi) → trả `/offline`. `Request` có `Authorization`/`Cookie` hay `Range` không đi qua nhánh lưu đệm.

### Hệ quả <!-- key: consequences -->

Không có ngoại tuyến cho dữ liệu; chấp nhận. Hiệu năng lần tải đầu không đổi (SW đăng ký sau `load`).

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ.

---

## Bản ghi quyết định 3 — Declarative Web Push: hoãn sang giai đoạn 2 <!-- key: decision_record -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Safari 18.4 (iOS/iPadOS cho ứng dụng đã thêm vào Màn hình chính, và macOS) hỗ trợ Declarative Web Push: payload JSON theo định dạng chuẩn được hệ thống hiển thị trực tiếp, không cần service worker, và không bị phạt nếu SW không hiển thị được. Đây là cách "tốt hơn" cho Safari về độ tin cậy.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Chỉ Web Push chuẩn (SW) | Một đường cho mọi trình duyệt | Đơn giản | Dễ | Chốt cho giai đoạn 1 |
| Thêm Declarative Web Push cho Safari | Cần nhánh payload thứ hai theo trình duyệt | Hai định dạng cần kiểm thử | Dễ | Hỗ trợ còn hẹp, chi tiết cần kiểm lại theo tài liệu WebKit hiện hành |

### Quyết định <!-- key: decision -->

Giai đoạn 1 dùng SW cho mọi trình duyệt. Thiết kế `PushSender` và bảng `push_subscriptions.platform` cho phép giai đoạn 2 chọn định dạng payload theo nền tảng; trước khi làm phải đọc lại tài liệu WebKit về lược đồ payload và hành vi dự phòng (tài liệu tìm được lúc viết không nêu đủ lược đồ nên không ghi vào đây).

### Hệ quả <!-- key: consequences -->

Safari phụ thuộc vào SW hiển thị đúng; SW phải luôn gọi `showNotification` (đã là quy tắc).

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ.

---

## Bản ghi quyết định 4 — Trải nghiệm cài đặt: lời mời theo ngữ cảnh, hướng dẫn riêng cho iOS <!-- key: decision_record -->

**Status:** Accepted
**Category:** Integration Feasibility
**Door Type:** Two-way (cheap to reverse)

### Quyết định <!-- key: decision -->

- Chromium: giữ `beforeinstallprompt`, chỉ gọi `prompt()` từ thao tác của người dùng; lời mời tự hiện chỉ sau khi có tương tác (≥ 2 phiên hoặc đã vào Thông báo), từ chối thì nghỉ 30 ngày.
- iOS/iPadOS và Safari: không có sự kiện cài đặt, hiển thị hướng dẫn có hình (Chia sẻ → Thêm vào Màn hình chính) khi người dùng mở cài đặt thông báo trên iOS chưa cài.
- Phát hiện đã cài: `matchMedia('(display-mode: standalone)')` và `navigator.standalone` (Safari). Sự kiện `appinstalled` để ghi số liệu.
- Không dùng cửa sổ chặn toàn trang; không hỏi lại khi đã từ chối.

### Hệ quả <!-- key: consequences -->

Tỉ lệ cài có thể thấp hơn lời mời gắt, nhưng đúng chính sách không phiền người dùng của Chrome và không vi phạm các tiêu chí chất lượng.

### Khả năng đảo ngược <!-- key: reversibility -->

Dễ.

---

## Hiệu năng — phân tích bắt buộc <!-- key: performance -->

- SW đăng ký sau `load` và trong `requestIdleCallback` ⇒ không chiếm đường tới "largest contentful paint".
- `sw.js` nhỏ (mục tiêu < 10 KB sau nén); không `importScripts`.
- Khởi động SW khi nhận push phải nhanh: không giải mã nặng, không `fetch` đồng bộ trước `showNotification` (Chrome yêu cầu hiển thị trong thời hạn ngắn sau khi nhận `push`).
- Cache-first chỉ cho tài nguyên có băm ⇒ không lệch phiên bản.
- Đo trước/sau bằng Lighthouse (LCP, TBT) và RUM; ngưỡng chấp nhận ghi ở AC11.
- Bộ nhớ đệm giới hạn 20 MB, dọn bản cũ khi `activate`.
