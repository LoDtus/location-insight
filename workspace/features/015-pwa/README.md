# Ứng dụng web cài đặt được (PWA)

**Feature ID:** 015-pwa
**Status:** Draft
**Last Updated:** 2026-11-02

## Tổng quan <!-- key: overview -->

Biến website thành ứng dụng web có thể **cài vào máy** (máy tính, Android, iPhone/iPad) và nhận **Web Push** kể cả khi đã đóng ứng dụng. PWA cung cấp nền tảng cho `014-notification`: manifest, service worker (nhận push, mở đúng đường dẫn khi bấm), trang ngoại tuyến tối thiểu, huy hiệu biểu tượng ứng dụng và trải nghiệm cài đặt. Nguyên tắc: **không lưu đệm dữ liệu riêng tư**, không làm chậm lần tải đầu, không thêm thư viện khi chưa cần.

## Mục tiêu & Phạm vi <!-- key: goals_scope -->

**In scope (giai đoạn 1):**

- Web App Manifest có `id`, `name`, `short_name`, `start_url`, `scope`, `display: standalone`, màu, icon 192/512/maskable, `shortcuts` (Bản đồ, Tin nhắn, Thông báo).
- Service worker một phạm vi `/`: xử lý `push`, `notificationclick`, `notificationclose`, `pushsubscriptionchange`; lưu đệm tài nguyên tĩnh có băm tên; trang `/offline`.
- Cài đặt: nút "Cài ứng dụng" (Chromium dùng `beforeinstallprompt`), hướng dẫn "Thêm vào Màn hình chính" cho iOS/iPadOS và Safari macOS.
- Cập nhật service worker có kiểm soát: báo "Có phiên bản mới" và chỉ kích hoạt khi người dùng đồng ý.
- Huy hiệu biểu tượng ứng dụng (App Badging API) theo số chưa đọc.
- Xử lý đăng xuất: xóa thông báo đang hiển thị, hủy đăng ký push của phiên, dọn bộ nhớ đệm riêng tư (nếu có).
- Tiêu đề bảo mật (CSP, `Service-Worker-Allowed`, `Cache-Control`) và kiểm thử cài đặt (Lighthouse, Playwright).

**Out of scope (chưa làm):**

- Dùng ngoại tuyến thật cho dữ liệu (đọc tin nhắn, bản đồ ngoại tuyến), đồng bộ nền (Background Sync), Periodic Background Sync, chia sẻ vào ứng dụng (Web Share Target), đăng ký xử lý giao thức, mở tệp.
- Declarative Web Push (Safari 18.4+): xem `research.md` bản ghi 3, để giai đoạn 2.
- Đóng gói ứng dụng native (TWA, Capacitor), đưa lên cửa hàng ứng dụng.
- Lưu đệm lát bản đồ Vietmap (điều khoản dịch vụ và chi phí; xem `013-map`).

## Đối tượng liên quan <!-- key: actors -->

- Người dùng và admin dùng website trên trình duyệt hoặc đã cài.
- Service worker: tác nhân chạy nền trong trình duyệt.
- Dịch vụ push của hãng trình duyệt (chỉ chuyển tiếp bản mã hóa).
- Nhóm vận hành: phát hành, đảm bảo phiên bản cũ không kẹt.

## Yêu cầu chức năng <!-- key: functional_requirements -->

- **FR-01 (manifest):** `app/manifest.ts` (Metadata Route của Next.js, có kiểu `MetadataRoute.Manifest`) xuất `id: "/"`, `name: "Địa Thế"`, `short_name: "Địa Thế"`, `description`, `lang: "vi"`, `start_url: "/app?source=pwa"`, `scope: "/"`, `display: "standalone"`, `display_override: ["standalone", "minimal-ui"]`, `orientation: "any"`, `background_color`, `theme_color`, `icons`, `shortcuts`. Giá trị màu lấy từ token chung, không mã cứng ở nhiều nơi.
- **FR-02 (icon):** `public/icons/` có `icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png` (vùng an toàn 80%), `badge-96.png` (đơn sắc trắng trên nền trong suốt, cho thanh trạng thái Android) và `shortcut-{map,messages,notification}-96.png`. **Toàn bộ vẽ từ bộ icon `lucide-react` (chốt với chủ dự án):** biểu tượng ứng dụng = glyph `map-pinned` màu trắng trên nền `green` (`#026a4e`), maskable cùng glyph thu vào vùng an toàn 80%; `badge` = `bell`; shortcut = `map`, `messages-square`, `bell`. Sinh bằng `scripts/generate-pwa-icons.mjs` (lấy dữ liệu nút SVG từ `lucide-react`, rasterize bằng `sharp`), chạy thủ công khi đổi icon; PNG sinh ra được commit. `apple-icon.png` hiện có thay bằng bản 180×180 cùng kiểu. Không dùng ảnh ngoài hay chỉnh tay.
- **FR-03 (service worker):** mã nguồn có kiểu ở `website/src/sw/sw.ts`, build thành `/sw.js` (không băm tên, ở gốc để phạm vi `/`) bằng bước build riêng; chèn `BUILD_ID` để mỗi bản phát hành có byte khác. Đăng ký khi trang đã tải xong (`load` + `requestIdleCallback`), chỉ ở ngữ cảnh an toàn, chỉ cho người đã đăng nhập hoặc trang `/app`, `/admin` (không đăng ký trên trang marketing cho khách ở giai đoạn 1).
- **FR-04 (push):** sự kiện `push` giải mã JSON (`interfaces/push-payload.md`), **luôn** gọi `registration.showNotification` (Safari bắt buộc), dùng `tag`/`renotify` để thay thế thông báo cùng chủ đề; payload hỏng thì hiện thông báo chung "Bạn có thông báo mới" thay vì im lặng.
- **FR-05 (bấm thông báo):** `notificationclick` đóng thông báo, kiểm `url` cùng origin và thuộc `/app/` hoặc `/admin/`, tìm cửa sổ đang mở để `focus()` và `postMessage({type:"navigate"})`, không có thì `clients.openWindow`. Gắn `?n=<id>` để trang đánh dấu đã đọc.
- **FR-06 (đăng ký lại):** `pushsubscriptionchange` hoặc khi `subscription.expirationTime` gần đến: SW báo trang (hoặc tự gọi) để đăng ký lại và cập nhật máy chủ; nếu SW không thể xác thực, đánh dấu và trang xử lý khi mở lần sau.
- **FR-07 (lưu đệm):** chỉ lưu đệm `/_next/static/**` (tên có băm, bất biến), `/icons/**`, phông chữ và `/offline`. **Không** lưu đệm: HTML của `/app`, `/admin`, mọi `/api/**`, lát bản đồ và API Vietmap, phản hồi có `Set-Cookie` hoặc `Cache-Control: private/no-store`. Chiến lược: cache-first cho tĩnh có băm, network-only còn lại; điều hướng thất bại do mạng thì trả `/offline`.
- **FR-08 (ngoại tuyến):** `/offline` là trang tĩnh, không dữ liệu riêng tư, có nút "Thử lại" và trạng thái kết nối; ứng dụng đã mở giữ nguyên dữ liệu đang có và hiển thị dải "Đang ngoại tuyến".
- **FR-09 (cài đặt):** trên Chromium, bắt `beforeinstallprompt`, giữ sự kiện, chỉ hiện lời mời cài sau khi người dùng có tương tác thực sự (≥ 2 phiên hoặc đã vào trang Thông báo) và chưa từ chối trong 30 ngày; nút trong menu hồ sơ/cài đặt luôn dùng được khi có sự kiện. iOS/iPadOS và Safari macOS: hướng dẫn từng bước (Chia sẻ → Thêm vào Màn hình chính/Dock). Ẩn mọi lời mời khi đã chạy ở `display-mode: standalone`.
- **FR-10 (cập nhật):** khi có service worker mới ở trạng thái `waiting`, hiện thanh "Có phiên bản mới · Tải lại"; bấm → `postMessage({type:"SKIP_WAITING"})` rồi tải lại khi `controllerchange`. Không `skipWaiting()` tự động (tránh đổi mã giữa lúc đang nhập biểu mẫu). Kiểm cập nhật khi tab hiện lại và mỗi 6 giờ.
- **FR-11 (huy hiệu):** `navigator.setAppBadge(n)` / `clearAppBadge()` khi số chưa đọc đổi và ứng dụng chạy standalone; SW cũng đặt huy hiệu khi nhận push lúc không có cửa sổ (tăng thêm 1, trang đồng bộ lại khi mở).
- **FR-12 (đăng xuất):** khi đăng xuất, trang gửi `postMessage({type:"LOGOUT"})`: SW đóng mọi thông báo đang hiển thị (`getNotifications` → `close`), xóa huy hiệu, xóa các bộ nhớ đệm có thể chứa dữ liệu theo người dùng; trang gọi `POST /notifications/push/subscriptions/suspend` (tạm ngưng push của thiết bị, không xóa) trước khi hủy phiên.
- **FR-13 (tiêu đề HTTP):** `/sw.js` trả `Cache-Control: no-cache` và `Content-Type: text/javascript`; `/manifest.webmanifest` `Cache-Control: public, max-age=3600`; CSP có `worker-src 'self'` và `manifest-src 'self'`; không dùng `importScripts` từ ngoài.
- **FR-14 (kiểm thử):** Lighthouse "installable" đạt; Playwright kiểm manifest hợp lệ, SW đăng ký, `/offline` khi mất mạng, `notificationclick` qua mô phỏng; kiểm tay trên Chrome Android, Safari iOS 16.4+ (đã cài) và Firefox.
- **FR-15 (quan sát):** ghi số liệu phía client (không PII) qua endpoint hiện có: tỉ lệ hỗ trợ push, tỉ lệ cấp quyền, cài đặt (`appinstalled`), cập nhật SW thành công.

## Quy tắc nghiệp vụ <!-- key: business_rules -->

- **Riêng tư trước, tốc độ sau:** dữ liệu theo người dùng không bao giờ nằm trong Cache Storage. Một thiết bị dùng chung không được lộ thông tin sau khi đăng xuất.
- **Một service worker, một phạm vi:** `/sw.js` phạm vi `/` phục vụ cả `/app` và `/admin`. Không có SW thứ hai.
- **Hiển thị bắt buộc:** mọi `push` nhận được phải dẫn tới `showNotification` (yêu cầu của Safari; Chrome cũng yêu cầu `userVisibleOnly`).
- **Không hỏi quyền tự động:** quyền thông báo và lời mời cài đặt chỉ hiện sau thao tác của người dùng hoặc sau thời điểm hợp ngữ cảnh; từ chối thì ghi nhớ.
- **Tương thích từng bước:** thiếu API (`PushManager`, `Notification`, `setAppBadge`) thì tính năng ẩn đi, website vẫn dùng bình thường.
- **Cập nhật an toàn:** hợp đồng payload push có `v`; SW cũ phải đọc được payload mới (bỏ qua trường lạ) vì người dùng có thể giữ SW cũ nhiều ngày.

## Tóm tắt luồng người dùng <!-- key: user_flow_summary -->

1. Người dùng dùng website bình thường; SW đăng ký ngầm sau khi trang tải xong.
2. Lúc thích hợp (menu hoặc lời mời sau tương tác), người dùng **Cài ứng dụng** → biểu tượng "Địa Thế" xuất hiện trên máy/màn hình chính; mở từ đó chạy `standalone` ở `/app`.
3. Người dùng bật thông báo đẩy ở trang Thông báo (014). Trên iPhone/iPad phải cài ứng dụng trước.
4. Khi có sự kiện lúc ứng dụng đóng: hệ điều hành hiện thông báo; bấm vào mở đúng mục tiêu; biểu tượng có huy hiệu số chưa đọc.
5. Khi có bản cập nhật: thanh "Có phiên bản mới" → tải lại.
6. Mất mạng: trang ngoại tuyến hoặc dải "Đang ngoại tuyến" thay vì lỗi trình duyệt.

## Bối cảnh kỹ thuật <!-- key: technical_context -->

- Next.js 16 (App Router, `output: "standalone"`), React 19. Manifest bằng `app/manifest.ts`. `public/sw.js` được sinh từ `src/sw/sw.ts` bằng **`tsc` (đã có trong repo) với `tsconfig.sw.json` riêng + script Node nhỏ chèn `BUILD_ID`**: không thêm phụ thuộc, chọn vì độ ổn định lâu dài (xem `research.md` bản ghi 1). Chạy trong `predev` và `prebuild`.
- Trang chạy sau proxy cùng origin (`/api/v1`), socket qua `/api/realtime`; SW **không** can thiệp vào `/api/**` và WebSocket.
- Đã có `app/icon.png`, `app/apple-icon.png`, `public/logos/diathe.svg`.
- Dev trong Docker: `localhost` được coi là ngữ cảnh an toàn nên SW và push chạy được; truy cập qua IP LAN cần HTTPS (dùng tên miền dev có chứng chỉ, hoặc cờ `chrome://flags/#unsafely-treat-insecure-origin-as-secure` chỉ cho kiểm thử).
- Phần máy chủ (đăng ký, hàng đợi, VAPID) ở `014-notification`; phần này chỉ gồm phía trình duyệt.

## Phụ thuộc <!-- key: dependencies -->

- `014-notification` (đăng ký push, API, payload).
- `003-auth` (đăng xuất, thu hồi phiên, `returnTo`).
- `001-ui`/`002-landing-page` (token màu, logo); `013-map` (không lưu đệm lát bản đồ).
- Không thêm thư viện runtime ở client. Build SW dùng `tsc` sẵn có (không thêm gì). Chỉ khi chạy script sinh icon mới cần `sharp` (thêm vào `devDependencies`, ghim phiên bản; hiện chỉ có gián tiếp qua Next).

## Ràng buộc <!-- key: constraints -->

- HTTPS ở staging/production; `Secure` cookie như hiện có.
- iOS/iPadOS: Web Push chỉ khi ứng dụng đã thêm vào Màn hình chính (iOS 16.4+); không có `beforeinstallprompt`.
- Safari phạt push không hiển thị; không có cách "nuốt" push có điều kiện ở SW.
- Giới hạn quota Cache Storage khác nhau theo trình duyệt (iOS chặt); giữ tổng bộ nhớ đệm < 20 MB và có xóa phiên bản cũ.
- SW không chạy `localStorage`/DOM; mọi trạng thái nhỏ dùng `IndexedDB` hoặc `postMessage`.
- Không `any`; `sw.ts` dùng kiểu `ServiceWorkerGlobalScope` (lib `webworker` trong `tsconfig` riêng của SW).

## Tài liệu liên quan (Artifacts) <!-- key: artifacts -->

- [research.md](research.md), [threat-model.md](threat-model.md).
- [interfaces/push-payload.md](interfaces/push-payload.md) — hợp đồng payload push và thông điệp giữa trang và SW.
- [interfaces/web-app-manifest.json](interfaces/web-app-manifest.json) — manifest mẫu để tham chiếu.
- [diagrams/flow-install-update.mmd](diagrams/flow-install-update.mmd), [diagrams/sequence-sw-lifecycle.mmd](diagrams/sequence-sw-lifecycle.mmd).
- [ui/ui-spec.md](ui/ui-spec.md).
- Liên quan: [../014-notification/README.md](../014-notification/README.md).

## Tiêu chí nghiệm thu (Acceptance Criteria) <!-- key: acceptance_criteria -->

| ID | Tiêu chí |
| --- | --- |
| AC1 | Chrome/Edge hiện khả năng cài đặt (Lighthouse "Installable" đạt); sau khi cài, mở ở chế độ standalone tại `/app`, có tên và icon đúng, shortcut hiển thị. |
| AC2 | iPhone/iPad (iOS ≥ 16.4): làm theo hướng dẫn UI thêm vào Màn hình chính, bật thông báo đẩy và nhận push khi đã đóng ứng dụng. |
| AC3 | Android Chrome: nhận push khi đóng ứng dụng; bấm mở đúng `link`, cửa sổ đang mở được focus thay vì mở bản sao. |
| AC4 | Desktop Chrome, Edge, Firefox, Safari: nhận push khi đóng tab; Safari yêu cầu bấm để hỏi quyền (có thao tác người dùng). |
| AC5 | Mọi push đều dẫn tới thông báo hiển thị, kể cả payload hỏng (thông báo chung). |
| AC6 | Mất mạng khi điều hướng: hiện `/offline`; ứng dụng đã mở hiện dải ngoại tuyến, không mất dữ liệu đang xem. |
| AC7 | Không có dữ liệu `/api/**`, HTML `/app`, `/admin` hay lát bản đồ nào trong Cache Storage (kiểm bằng DevTools/Playwright). |
| AC8 | Phát hành bản mới: người dùng thấy thanh cập nhật; bấm tải lại thì chạy bản mới; SW cũ vẫn hiển thị đúng payload mới. |
| AC9 | Đăng xuất: thông báo đang hiển thị bị đóng, huy hiệu xóa, push của thiết bị bị tạm ngưng; push sau đó không hiện trên thiết bị. Đăng nhập lại cùng tài khoản: push hoạt động lại không hỏi quyền. |
| AC10 | Huy hiệu biểu tượng khớp số chưa đọc (khi trình duyệt hỗ trợ) và tự đồng bộ khi mở lại. |
| AC11 | Lần tải đầu không chậm hơn khi không có SW quá 50 ms ở p95 (đo Lighthouse/RUM); SW đăng ký sau `load`. |
| AC12 | Trình duyệt thiếu API: không lỗi console, tính năng liên quan ẩn, website dùng bình thường. |

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

- Có đăng ký SW cho khách chưa đăng nhập (trang marketing, SEO) để có `/offline`? Đề xuất: chưa, giảm rủi ro.
- `start_url`: `/app` cho mọi người hay `/admin` cho admin (đã đăng nhập)? Đề xuất: `/app?source=pwa` và `app` tự chuyển admin theo vai trò hiện có.
- Chính sách lưu đệm lát bản đồ cho dùng ngoại tuyến (cần xác nhận điều khoản Vietmap).

## Nhật ký cập nhật <!-- key: update_log -->

| Ngày | Thay đổi |
| --- | --- |
| 2026-11-02 | Tạo đặc tả ban đầu (chưa triển khai). |
| 2026-11-02 | Chốt: build service worker bằng `tsc` sẵn có (không thêm phụ thuộc); toàn bộ icon PWA vẽ từ `lucide-react`; push gắn thiết bị (xem 014). |
