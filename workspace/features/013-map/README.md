# 013 — Bản đồ Vietmap (xem bản đồ, tìm địa điểm, tìm đường)

Trạng thái: đặc tả + triển khai bản đầu (02/11/2026). Phụ thuộc: `003-auth`, `004-rbac`. Nguồn: tài liệu chính thức <https://maps.vietmap.vn/docs/> (bản chép trong `workspace/docs/vietmap-agent-docs/`) và đối chiếu trực tiếp trên Console <https://maps.vietmap.vn/console-v2/> + gọi thử API bằng key thật ngày 02/11/2026.

## 1. Mục tiêu và phạm vi

Thay ảnh bản đồ giả ở `/app/map` và `/admin/map` bằng bản đồ thật của Vietmap, đủ cho ba việc cốt lõi của dự án: **xem và tương tác với bản đồ**, **tìm địa điểm**, **tìm đường**. Đây cũng là nền cho phần "ghim đúng ô đất rồi phân tích vị trí" ở `README.md` gốc (người dùng kéo ghim, phân tích bám tọa độ ghim, không bám chuỗi địa chỉ).

| # | Yêu cầu | API Vietmap | Đơn vị tính phí |
| --- | --- | --- | --- |
| R1 | **Hiển thị bản đồ nền** vector (đường phố, sáng, tối, vệ tinh lai), phóng/thu, xoay, nghiêng, la bàn, thước tỷ lệ, về vị trí hiện tại | Tilemap `styles/{tm,lm,dm,hm}/style.json` + `@vietmap/vietmap-gl-js` | 25 tile = 1 transaction (đã cache) |
| R2 | **Lớp giao thông** bật/tắt chồng lên nền | `styles/tf/style.json` (overlay) | như tile; **cần bật API Traffic trên key** |
| R3 | **Tìm địa điểm khi gõ** (gợi ý), chọn một gợi ý để lấy tọa độ | Autocomplete v4 → Place v4 | 1 + 1 transaction mỗi lần chọn |
| R4 | **Bấm/kéo ghim → địa chỉ** (reverse geocode) | Reverse v4 | 1 |
| R5 | **Tìm đường** A→B (xe máy, ô tô), tuyến thay thế, quãng đường/thời gian, hướng dẫn từng bước tiếng Việt, mức tắc | Route v4 (`points_encoded=false`, `annotations=congestion`) | `⌊số điểm/5⌋+1` = 1 với 2 điểm |
| R6 | **Bảo mật khóa**: khóa API gọi dịch vụ chỉ ở backend; trình duyệt chỉ nhận khóa Tilemap (không tránh được) kèm yêu cầu hạn chế domain | — | — |
| R7 | **Hiệu năng/chi phí**: debounce, hủy request cũ, cache Redis, hạn mức theo người dùng và ngân sách ngày, một instance bản đồ, tải GL JS theo yêu cầu | — | — |
| R8 | **Admin** dùng cùng bản đồ + xem mức dùng transaction hôm nay (cache hit/miss, gọi upstream) | nội bộ | — |

Ngoài phạm vi bản đầu (xem §9 để biết lý do và khi nào làm): Matrix, TSP, VRP, Isochrone, Geofencing, Search/Reverse batch, Migrate-Address, Report-Address, Static Map, Route-tolls/Match-tolls, xe tải/container, dẫn đường từng bước theo GPS, SDK mobile.

## 2. Khả năng Vietmap và cách dự án dùng

Bảng tổng hợp **toàn bộ** năng lực công bố, để quyết định có/không và vì sao.

| Nhóm | API / SDK | Làm được gì | Dùng ở bản đầu? | Vì sao |
| --- | --- | --- | --- | --- |
| Hiển thị | Tilemap vector `tm/lm/dm/hm`, raster `st` | Nền đường phố/sáng/tối/vệ tinh lai (có nhãn); raster vệ tinh không nhãn | `tm`, `lm`, `dm`, `hm` | Một `style.json` dùng chung; `st` thừa vì `hm` đã có ảnh vệ tinh + nhãn |
| Hiển thị | Traffic overlay `tf` | Tô màu tắc đường realtime, cập nhật vài phút | Có (cờ bật) | Hữu ích cho tìm đường; key hiện chưa bật Traffic |
| Hiển thị | GL JS Web SDK (fork MapLibre) | Marker, popup, layer GeoJSON, `fitBounds`, `flyTo`, điều khiển | Có | Duy nhất cho web |
| Hiển thị | Static Map `POST /maps/statics/tm` | PNG có ghim + nhãn | Chưa | Dành cho email/PDF; làm khi có báo cáo vị trí xuất PDF/email |
| Tìm kiếm | Autocomplete v4 | Gợi ý khi gõ, nghiêng theo `focus` | Có | Lõi của ô tìm |
| Tìm kiếm | Place v4 | `ref_id` → tọa độ + trường có cấu trúc | Có (chỉ khi chọn) | Autocomplete không trả tọa độ |
| Tìm kiếm | Search v4 | Địa chỉ đầy đủ → kết quả xếp hạng | Chưa (dự phòng khi Enter không chọn gợi ý) | Cùng dữ liệu với Autocomplete; dùng khi người dùng bấm Enter mà không chọn |
| Tìm kiếm | Reverse v4 | Tọa độ → địa chỉ | Có | Ghim → địa chỉ |
| Tìm kiếm | Search-batch / Reverse-batch | Geocode hàng loạt | Chưa | Tác vụ nạp dữ liệu (ETL tin đăng), không phải tương tác |
| Địa chỉ | Migrate-Address v3 | Đổi địa chỉ cũ (3 cấp) ↔ mới (2 cấp, sau sáp nhập 07/2025) | Chưa | `display_type=6` đã trả cả hai dạng một lần gọi |
| Địa chỉ | Report-Address / Address-Issues | Báo địa chỉ sai (bearer token, subdomain khác) | Chưa | Cần tài khoản đăng nhập riêng; xem §9 |
| Đường | Route v4 | Quãng đường, thời gian, polyline, hướng dẫn, phí BOT, mức tắc; `car/motorcycle/truck/container` | `car`, `motorcycle` | Đúng nhu cầu người dùng cuối |
| Đường | Route-tolls / Match-tolls | Phí BOT theo hạng xe 1–5, đối soát lộ trình | Chưa | Route v4 `annotations=toll` đã đủ; xe tải ngoài phạm vi |
| Logistics | Matrix | Ma trận N×M thời gian/khoảng cách | Chưa | Phục vụ "tiện ích gần nhất theo thời gian đi" ở phân tích vị trí (giai đoạn sau) |
| Logistics | Isochrone | Vùng đến được trong N phút | Chưa — **ứng viên số 1 sau bản đầu** | Chỉ số "đi 15 phút tới những đâu" của báo cáo vị trí |
| Logistics | TSP / VRP / Geofencing | Tối ưu thứ tự / đội xe / kiểm tra vùng | Không | Không thuộc mục tiêu dự án |
| SDK | Flutter / React Native / Android / iOS | Bản đồ + dẫn đường native | Chưa | `mobile/` còn trống; dùng lại các endpoint backend ở đây |

Điểm cần nhớ từ tài liệu và thử nghiệm thực tế:

- **Hai key** mỗi tài khoản: *API key* (search, route…) và *Tilemap key*. Tách để hết hạn mức một key không làm sập key kia. Key API **bị tắt Tile/Traffic/Driving Alert**; key Tilemap có **Tile tối đa 5.000 request/ngày**.
- Trial: **60.000 transaction/tháng**, hầu hết API **200 request/phút**, Place/Matrix… **100/phút**, **1.500/ngày** cho Reverse/Geocode/Route/…; Autocomplete không giới hạn ngày nhưng 200/phút. Tài khoản Trial **chỉ xem** Console (không sửa hạn mức, không đặt hạn chế domain/IP) — phải nâng cấp để làm được các bước ở §7.
- Tọa độ: GL JS dùng `[lng, lat]`; REST (`focus`, `point`) dùng `lat,lng`; Reverse-batch dùng `lon`. Chuyển đổi **chỉ ở biên** (`map.mapper.ts` ở backend, `map.service.ts` ở frontend).
- `display_type=6` trả địa chỉ cũ ở trường chính và địa chỉ mới (sau sáp nhập) ở `data_new`. UI hiển thị địa chỉ **mới** nếu có, hiện địa chỉ cũ ở dòng phụ — người dùng Hà Nội vẫn quen tên quận/phường cũ.
- `ref_id` là token mờ, không giải mã, không lưu lâu; lưu `lat/lng` thay vì `ref_id`.
- Key sai → `401`; key hết hạn mức → `429`/lỗi riêng; backend phải ánh xạ cả hai thành lỗi sạch (không lộ key).

## 3. Kiến trúc

```
Trình duyệt (/app/map, /admin/map)
   │ ① GET /api/v1/map/config                (đã đăng nhập) → style URL (có khóa Tilemap) + giới hạn
   │ ② tile/style/glyph/sprite  ───────────────────────────────▶ maps.vietmap.vn  (trực tiếp, khóa Tilemap)
   │ ③ GET /map/search | /map/places/resolve | /map/reverse | /map/route
   ▼
Backend NestJS  MapController  (map:use, validate, rate limit người dùng)
   └─ MapService
        ├─ cache Redis (khóa chuẩn hóa, TTL theo loại) + single-flight
        ├─ ngân sách ngày (Redis INCR) → 429/503 khi chạm trần
        └─ VietmapClient (khóa API ở env, timeout, ẩn khóa khỏi log/lỗi)
                         └────────────────────────────▶ maps.vietmap.vn/api/*  (khóa API)
```

Quyết định chính (chi tiết ở `research.md`):

1. **Mọi API tính phí (search, place, reverse, route) đi qua backend** — khóa API không bao giờ xuống trình duyệt. Backend là chỗ duy nhất có cache, giới hạn và ngân sách.
2. **Tile đi thẳng từ trình duyệt tới Vietmap** (khóa Tilemap lộ trong style URL). Proxy tile qua backend nhân băng thông/độ trễ và mất cache CDN của Vietmap; thay vào đó **bắt buộc hạn chế domain/IP cho khóa Tilemap ở production** (§7) và dùng khóa riêng cho dev/prod.
3. **Backend giao khóa Tilemap qua `GET /map/config`** (cần đăng nhập), không đóng gói vào bundle: xoay khóa không cần build lại, khách chưa đăng nhập không lấy được.
4. **Chuẩn hóa phản hồi** thành hợp đồng gọn của dự án (camelCase, `lat/lng` số, địa chỉ cũ/mới tách rõ). Frontend không phụ thuộc hình dạng thô của Vietmap; đổi nhà cung cấp chỉ sửa `VietmapClient` + mapper.
5. **Chỉ gọi Place khi người dùng chọn** (đúng khuyến nghị tài liệu): gõ 10–20 lần Autocomplete nhưng chỉ 1 Place.
6. **Một instance bản đồ**, tải `vietmap-gl` bằng `import()` động chỉ trên client (`vietmap-gl.js` ≈ 0,8 MB chưa nén, ≈ 220 KB gzip) để trang khác không tốn.

## 4. API backend

Xem `interfaces/rest-api.yml`. Tiền tố `/api/v1`; quyền `map:use` (mọi người dùng đã đăng nhập, gồm admin); admin thêm `GET /admin/map/usage` (`admin:access`).

| Method | Đường dẫn | Mục đích | Cache | Giới hạn/người dùng |
| --- | --- | --- | --- | --- |
| GET | `/map/config` | Style URL, tâm/zoom mặc định, giới hạn, cờ tính năng | `Cache-Control: private, max-age=300` | 30/phút |
| GET | `/map/search?text&lat&lng&limit&cats&scope&cityId&distId&wardId&radius` | Gợi ý (Autocomplete v4, `display_type=6`) | 5 phút, khóa = chữ chuẩn hóa + `focus` làm tròn 0,01° (~1 km) | 90/phút |
| GET | `/map/places/resolve?refId` | `ref_id` → tọa độ + địa chỉ (Place v4) | 1 giờ, khóa = băm `refId` | 30/phút |
| GET | `/map/reverse?lat&lng` | Tọa độ → địa chỉ (Reverse v4) | 24 giờ, khóa = tọa độ làm tròn 5 chữ số (~1 m) | 30/phút |
| GET | `/map/route?from&to&vehicle&alternatives&avoid&time` | Tuyến đường (Route v4) | 3 phút (giao thông thay đổi), khóa = điểm làm tròn 5 chữ số + loại xe | 20/phút |
| GET | `/admin/map/usage` | Bộ đếm hôm nay theo API | — | — |

Quy ước: phản hồi bọc envelope chung của dự án; lỗi nghiệp vụ dùng `BusinessException` (mã `VALIDATION_ERROR`, `TOO_MANY_REQUESTS`, `EXTERNAL_SERVICE_TIMEOUT`, `EXTERNAL_SERVICE_ERROR`, `SERVICE_UNAVAILABLE`).

### Hợp đồng dữ liệu (chuẩn hóa)

```ts
interface MapSuggestion {
  refId: string;            // mờ, truyền nguyên vẹn cho /places/resolve
  name: string;             // tên địa điểm/số nhà + đường
  address: string;          // địa chỉ hành chính (dạng mới nếu có, rơi về cũ)
  addressOld: string | null;// dạng 3 cấp, để người dùng đối chiếu
  display: string;          // nhãn đầy đủ
  distanceKm: number | null;// từ focus
}
interface MapPlace { lat: number; lng: number; name: string; address: string; addressOld: string | null; display: string; }
interface MapRoute {
  distanceM: number; durationS: number;
  bbox: [number, number, number, number];            // [minLng,minLat,maxLng,maxLat]
  geometry: Array<[number, number]>;                  // [lng,lat]
  steps: Array<{ text: string; distanceM: number; durationS: number; sign: number; street: string }>;
  /** Phần tử i = mức tắc của đoạn giữa đỉnh i và i+1 (độ dài = geometry − 1); null nếu không có dữ liệu. */
  congestion: Array<'low'|'moderate'|'heavy'|'severe'|'unknown'> | null;
}
```

## 5. Giao diện

Xem `ui/ui-spec.md`. Tóm tắt: ô tìm có combobox gợi ý (bàn phím, ARIA), bấm bản đồ/kéo ghim → bảng địa điểm (địa chỉ, tọa độ, sao chép, "Chỉ đường đến đây/từ đây"), bảng chỉ đường (xe máy/ô tô, tuyến thay thế, danh sách bước), chọn lớp bản đồ thật (đường phố/sáng/tối/vệ tinh) + công tắc giao thông, nút phóng/thu/vị trí của tôi.

## 5a. Tham số URL của `/app/map` và `/admin/map`

Cả hai trang dùng chung bộ tham số; URL là nguồn trạng thái **hai chiều**: mở/đổi URL → bản đồ đổi; thao tác trên bản đồ → URL cập nhật bằng `history.replaceState` (dồn nhịp 500 ms, không thêm mục lịch sử). Mã: `website/src/features/map/map-url.ts` (phân tích/dựng, có test), `map-screen.tsx` (đồng bộ).

| Nhóm | Param | Giá trị hợp lệ | Nguồn Vietmap | Mặc định (không ghi lên URL) |
| --- | --- | --- | --- | --- |
| Khung nhìn | `c` | `lat,lng` trong hộp bao Việt Nam | GL JS `center` | tâm Hà Nội |
| | `z` | số 4–20 | `zoom` | 12 |
| | `b` | số −360…360 (độ) | `bearing` | 0 |
| | `p` | số 0–60 (độ) | `pitch` | 0 |
| Lớp | `s` | `tm` `lm` `dm` `hm` | Tilemap styles | `tm` |
| | `layers` | `traffic` | Traffic overlay `tf` (cần `MAP_TRAFFIC_ENABLED`) | không |
| Tìm kiếm | `q` | 2–120 ký tự | Autocomplete `text` | — |
| | `cats` | mã POI `3001`, `1002-1`, tối đa 10, ngăn dấu phẩy | `cats` | — |
| | `scope` | tập con (không lặp) của `POI,ADDRESS,VILLAGE,WARD,DIST,CITY,STREET` | `layers` | — |
| | `city` `dist` `ward` | số nguyên dương | `cityId` `distId` `wardId` | — |
| | `r` | 50–50.000 (mét), quanh tâm bản đồ | `circle_radius` (+ `circle_center`) | — |
| Điểm | `pin` | `lat,lng` | Reverse v4 | — |
| Chỉ đường | `from`, `to` | `lat,lng` | Route v4 `point` | — |
| | `v` | `motorcycle` `car` | `vehicle` | `motorcycle` |
| | `alt` | `0` `1` | `alternative` | `1` |
| | `route` | 0–4, chỉ số tuyến chọn sẵn | — | 0 |
| | `avoid` | `ferry` | `avoid` | — |
| | `t` | ISO 8601 UTC, vd `2026-11-03T01:00:00Z` | `time` | giờ hiện tại |

Ví dụ: `/app/map?c=21.0285,105.8542&z=15&s=lm&from=21.03,105.85&to=21.00,105.84&v=car`

**Quy tắc.**
- **Lỗi:** giá trị không hợp lệ không bị lờ đi. Một khung cảnh báo liệt kê từng `param: lý do` (ví dụ đảo vĩ độ/kinh độ, ngoài khoảng, ngoài danh sách cho phép, lặp param, param lạ). Giá trị lỗi bị bỏ qua, phần hợp lệ còn lại vẫn áp dụng, URL được ghi lại ở dạng sạch.
- **Phụ thuộc:** `v` `alt` `route` `avoid` `t` chỉ có nghĩa khi có `from` hoặc `to`. `pin` cùng `from`/`to` → `pin` bị bỏ qua (chế độ chỉ đường thắng). `layers=traffic` khi hệ thống chưa bật Traffic → báo lỗi, không bật. `route` vượt số tuyến trả về → báo và dùng tuyến 0.
- **Không bao giờ** có `apikey`, `ref_id`, `display_type`, `annotations` trên URL. Chuỗi trong `q` chỉ là văn bản, đi qua API đã mã hóa.
- **Riêng tư:** `pin/from/to/c` là vị trí; chỉ nằm trong thanh địa chỉ của người dùng, không gửi đi đâu ngoài các lần gọi API tương ứng.
- **Hiệu năng/chi phí:** mở URL có `pin` tốn 1 Reverse, `from`+`to` tốn 1 Route, `q` tốn 1 Autocomplete; đều qua cache và ngân sách ở backend. Đổi nhãn điểm đi/đến không gọi lại Route. Backend chấp nhận thêm `cats`, `scope`, `cityId`, `distId`, `wardId`, `radius` ở `/map/search` và `avoid`, `time` ở `/map/route` (kiểm tra schema; sai → 400/422); khóa cache có bộ lọc; `time` được làm tròn xuống 15 phút.
- Lưu ý Vietmap: `alternative=false` bị bỏ qua phía họ (vẫn trả 2 tuyến), nên backend chỉ gửi `alternative=true` khi bật và tự cắt còn 1 tuyến khi tắt.

## 6. Hiệu năng

- **Trình duyệt**: debounce 250 ms, tối thiểu 2 ký tự, `AbortController` hủy request trước; tải GL JS động (`import()`), một `Map` duy nhất, `map.remove()` khi hủy gắn kết (tránh rò WebGL context); route vẽ bằng **một source GeoJSON + layer `line`** (không dùng nhiều marker); `setData` thay vì thêm/xóa layer; `fitBounds` có `padding` theo bảng bên; bỏ `preserveDrawingBuffer`; `maxBounds` quanh Việt Nam và `minZoom` để không kéo ra toàn cầu (tile vô ích tốn quota).
- **Tile**: SDK tự cache; không gắn nhiều instance; chuyển lớp nền bằng `setStyle` rồi **gắn lại** overlay/route trong `style.load` (tài liệu: `setStyle` xóa mọi layer tùy biến).
- **Backend**: cache Redis theo TTL ở §4; **single-flight** (nhiều request cùng khóa chỉ gọi upstream một lần); `fetch` có `AbortSignal.timeout(4000)`; một lần thử lại cho lỗi mạng/`5xx` trên GET idempotent; cầu dao đơn giản: sau 5 lỗi liên tiếp trong 30 s → trả `503` nhanh 30 s thay vì xếp hàng request chờ upstream; `limit` trả về ≤ 10 gợi ý.
- **Chi phí**: ước tính một phiên tìm 1 địa chỉ + 1 tuyến ≈ 10–15 Autocomplete (trừ cache) + 1 Place + 1 Reverse + 1 Route ≈ ≤ 20 transaction ≈ 1.000 đ ở mức 50 đ/transaction; cache gợi ý theo `focus` làm tròn giảm 30–50% khi nhiều người cùng khu vực.
- **Ngân sách**: biến `MAP_DAILY_BUDGET` (mặc định 1.200, dưới trần 1.500/ngày của Trial) đếm mỗi lần *gọi upstream* (không đếm cache hit); vượt → `503 service_unavailable` có thông điệp tiếng Việt thay vì để Vietmap trả `429` giữa chừng. `GET /admin/map/usage` hiển thị bộ đếm.

## 7. Bảo mật (chi tiết ở `threat-model.md`)

Kiểm soát bắt buộc trong mã (đã triển khai): xác thực + `map:use` mọi endpoint; validate schema (`class-validator`, `whitelist`), tọa độ trong hộp bao Việt Nam, `text` ≤ 120 ký tự, `refId` ≤ 1.500 ký tự và chỉ `[A-Za-z0-9_:.\-]`; **không truyền nguyên query người dùng sang upstream** (backend dựng lại tham số); host upstream cố định từ cấu hình (không SSRF); khóa API chỉ ở env, bị loại khỏi log/URL trong lỗi; rate limit theo `userId` (Redis, fail-closed 503 như auth); phản hồi chỉ chứa trường đã lọc; `Popup.setText`/DOM text, **không** `setHTML` với dữ liệu từ upstream hoặc người dùng; không log tọa độ gắn `userId` ở mức info (vị trí là dữ liệu cá nhân).

Việc **bắt buộc làm tay trên Console trước khi lên production** (tài khoản Trial hiện không làm được, cần nâng cấp / nhờ Vietmap — Zalo OA <https://zalo.me/3189066936017422854>):

| # | Việc | Vì sao |
| --- | --- | --- |
| C1 | Khóa Tilemap: **Referers** = domain production (+ `localhost` cho dev riêng) | Khóa nằm trong style URL, ai cũng lấy được; hạn chế domain là phòng thủ duy nhất |
| C2 | Khóa API: **Allow IPs** = IP máy chủ backend | Lộ khóa vẫn không dùng được từ máy khác |
| C3 | Tạo **khóa riêng cho dev / staging / prod**, mỗi khóa hạn mức riêng | Sự cố dev không đốt hạn mức prod |
| C4 | Đặt **hạn mức mỗi phút/ngày** và **tắt API không dùng** trên từng khóa (Matrix, VRP, TSP…) | Phòng thủ nhiều lớp; VRP một lần có thể ngốn hàng trăm transaction |
| C5 | Bật **Traffic** cho khóa Tilemap nếu muốn lớp giao thông | Hiện `Traffic`/`Tile` tắt ở khóa API, Traffic chưa bật ở khóa Tilemap |
| C6 | Xem **Daily Report** vài ngày đầu so với `/admin/map/usage` | Phát hiện vòng lặp client/khóa lộ |
| C7 | Quay vòng (regenerate) khóa nếu từng dán ở nơi công khai | — |

Các khóa dùng khi phát triển đã được ghi vào `.env.development` (bị `.gitignore`), **không** nằm trong repo. `.env.example` chỉ có tên biến.

## 8. Cấu hình

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `VIETMAP_API_KEY` | — | Khóa API (backend) — thiếu thì các endpoint trả `503` rõ ràng, `/map/config` báo `searchEnabled=false` |
| `VIETMAP_TILE_KEY` | — | Khóa Tilemap (giao cho trình duyệt) — thiếu thì bản đồ hiện thông báo cấu hình |
| `VIETMAP_BASE_URL` | `https://maps.vietmap.vn` | Chỉ cho test/proxy nội bộ; phải là `https://` ở production |
| `VIETMAP_TIMEOUT_MS` | `4000` | Timeout mỗi lần gọi upstream |
| `MAP_DAILY_BUDGET` | `1200` | Trần số lần gọi upstream mỗi ngày (múi giờ `Asia/Ho_Chi_Minh`); `0` = không giới hạn |
| `MAP_TRAFFIC_ENABLED` | `false` | Bật nút giao thông khi khóa Tilemap đã bật Traffic |

## 9. Cố ý chưa làm và lộ trình

| Không làm | Lý do | Khi nào xét lại |
| --- | --- | --- |
| Isochrone ("15 phút đi tới đâu") | Là chỉ số của báo cáo vị trí, không phải tương tác bản đồ; 1 transaction/lần, rẻ | Khi làm module phân tích vị trí — làm **đầu tiên** |
| Matrix (tiện ích gần nhất theo thời gian) | `n×m` transaction; cần chốt danh sách tiện ích trước | Sau Isochrone, với `n×m ≤ 25` |
| Static Map cho email/PDF | Không có tính năng xuất báo cáo | Khi có PDF/email báo cáo vị trí; proxy qua backend + `Cache-Control: max-age=86400` |
| Report-Address | Dùng token đăng nhập riêng (subdomain khác), cần quy trình kiểm duyệt nội bộ | Khi có nhiều phản ánh địa chỉ lệch của người dùng |
| Xe tải/container, phí BOT | Người dùng mục tiêu là cá nhân đánh giá vị trí | Nếu có tính năng logistics |
| Dẫn đường GPS từng bước | Cần SDK navigation + mobile | Khi làm `mobile/` |
| Proxy tile qua backend | Tốn băng thông, mất cache; khóa Tilemap có hạn chế domain là đủ | Nếu Vietmap không hỗ trợ hạn chế domain cho gói đang dùng |
| Lưu lịch sử tìm kiếm/địa điểm ở DB | Chưa có yêu cầu; vị trí là dữ liệu cá nhân | Khi làm "Đã lưu" (`place:save`) — sẽ lưu `lat/lng`, không lưu `ref_id` |

## 10. Trạng thái triển khai (02/11/2026)

Backend `backend/src/modules/map/` (controller, service, client, mapper có test) và frontend `website/src/features/map/` (`map-canvas`, `place-search-box`, `map-place-panel`, `map-directions-panel`, `map-layer-picker`, `map-usage-card`, hooks) đã chạy trên `/app/map` và `/admin/map`. Đã kiểm tra tay trên stack dev: gợi ý (1 request cho 7 phím gõ nhờ debounce), chọn → Place, bấm bản đồ → Reverse, tìm đường có tô màu tắc, đổi 4 lớp nền giữ nguyên tuyến, cache hit ở lần gọi lặp, key không xuất hiện trong HTML/bundle/log. Chưa làm được trong môi trường này: C1–C7 (Console tài khoản Trial chỉ xem), lớp giao thông (Traffic chưa bật trên key), kiểm tra tải.

## 11. Tiêu chí nghiệm thu

| # | Tiêu chí |
| --- | --- |
| AC1 | `/app/map` và `/admin/map` hiển thị bản đồ Vietmap thật, kéo/phóng/thu/xoay được; chuyển lớp đường phố ↔ sáng ↔ tối ↔ vệ tinh không mất ghim/tuyến. |
| AC2 | Gõ "hồ gươm" → ≤ 1 request mỗi 250 ms, hiện gợi ý; chọn một gợi ý → bản đồ bay tới đó, đặt ghim, đúng **một** lần gọi Place. |
| AC3 | Bấm bản đồ hoặc kéo ghim → địa chỉ cập nhật bằng Reverse (một lần/lần thả). |
| AC4 | Chọn "Chỉ đường đến đây" + điểm xuất phát → vẽ tuyến, hiện quãng đường/thời gian/các bước, đổi xe máy ↔ ô tô và tuyến thay thế. |
| AC5 | Khóa API không xuất hiện trong bundle JS, HTML, phản hồi `/map/*` hay log backend (kiểm bằng `grep` và DevTools). |
| AC6 | Người chưa đăng nhập gọi `/map/*` → 401; không có `map:use` → 403; đầu vào sai schema/độ dài → 400 (`VALIDATION_ERROR`), tọa độ route ngoài hộp bao Việt Nam → 422, và không có request ra upstream. |
| AC7 | Cùng truy vấn hai lần trong TTL → lần hai là cache hit (bộ đếm upstream không tăng). |
| AC8 | Vượt hạn mức người dùng → 429 có `retryAfter`; vượt `MAP_DAILY_BUDGET` → 503 thông điệp tiếng Việt, không gọi upstream. |
| AC9 | Upstream timeout/5xx → thông điệp lỗi thân thiện, UI không treo; 5 lỗi liên tiếp → cầu dao mở 30 s. |
| AC10 | Rời trang bản đồ → `map.remove()` được gọi, không còn WebGL context rò (điều hướng qua lại 10 lần không cảnh báo "Too many active WebGL contexts"). |
