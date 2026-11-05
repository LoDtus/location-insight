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
| GET | `/map/saved` | Địa điểm đã lưu của người dùng (mới nhất trước, tối đa 200) | — (DB) | 60/phút (chung `saved`) |
| POST | `/map/saved` `{lat,lng,name,address?,kind?}` | Lưu địa điểm; lưu lại cùng tọa độ thì trả bản cũ (idempotent) | — | 60/phút |
| PATCH | `/map/saved/:id` `{label?,note?,compared?}` | Tên gợi nhớ (≤ 80, `null`/rỗng = dùng tên gốc), ghi chú nhiều dòng (≤ 1000), bật/tắt so sánh (tối đa 6 → 409). Chỉ mục của chính mình (không thì 404); trường lạ → 400 | — (`private, no-store`) | 60/phút |
| DELETE | `/map/saved/:id` | Bỏ lưu (chỉ của chính người dùng) | — | 60/phút |
| GET | `/map/compare` | Bảng so sánh: mục đã lưu đang so sánh (theo thứ tự thêm) + đánh giá đầy đủ từ lượt gần nhất **của chính người dùng** (`null` nếu chưa đánh giá) | — (`private, no-store`) | 60/phút |
| GET | `/map/weights` | Trọng số 19 tiêu chí của chính người dùng (mặc định, đang dùng, `custom`) + số tiêu chí đã đổi | — (`private, no-store`) | 60/phút (`weights`) |
| PUT | `/map/weights/:criterionId` `{weight}` | Đặt trọng số 0–5 (số nguyên); bằng mặc định thì xóa hàng. Tiêu chí lạ → 404, ngoài khoảng/lẻ/trường lạ → 400 | — | 60/phút |
| DELETE | `/map/weights/:criterionId` · `/map/weights` | Về mặc định một tiêu chí · tất cả | — | 60/phút |
| GET | `/map/layers/places?x&y` | Điểm tiện ích của một ô zoom 13 (mọi nhóm, tối đa 3 000 điểm; client lọc theo lớp đang bật) | Redis 24 giờ, khóa = phiên bản dữ liệu + ô; `Cache-Control: private, max-age=3600` | 300/phút (`layers`) |
| GET | `/map/search/pins?text&lat&lng&radius&cats&scope` | Tìm theo loại hình ("ngân hàng"): tối đa 10 kết quả liên quan nhất kèm tọa độ để ghim, bỏ kết quả ngoài `radius` | Gợi ý 5 phút + Place 1 giờ (mỗi lượt tối đa 1 Autocomplete + 10 Place) | 10/phút (`search-pins`) |
| GET | `/map/places/evaluation?lat&lng` | Lượt đánh giá **gần nhất của chính người dùng** (§4c); `{ evaluation: null }` nếu chưa bấm. Chỉ đọc, không tính toán, không tính phí | — (`private, no-store`) | 120/phút (`evaluation-read`) |
| POST | `/map/places/evaluation` `{lat,lng,fresh?}` | Bấm "Đánh giá" (`fresh=false`: nhận bản phân tích mới nhất của địa điểm, chưa có thì AI chạy) hoặc "Đánh giá lại" (`fresh=true`: AI luôn chạy). Trả `{ evaluation, source: fresh|shared }` | Bản phân tích theo id `cache:map:analysis:{id}` 24 giờ | 30/phút (`evaluate`) |
| PUT | `/map/places/evaluation/criteria/:criterionId` `{lat,lng,skipped?,score?}` | Bỏ qua tiêu chí và/hoặc đặt điểm tay 0–10 (bước 0,5; `score:null` = về điểm tự động) trên lượt của chính mình; chưa có lượt → 404 | — | 30/phút |
| DELETE | `/map/places/evaluation/criteria/:criterionId?lat&lng` | Khôi phục tiêu chí về mặc định (cần lượt của chính mình) | — | 30/phút |
| GET | `/admin/map/dataset-versions` | Danh sách phiên bản dữ liệu (`admin:access`) | — | — |
| POST | `/admin/map/dataset-versions` `{note}` | Admin phát hành phiên bản mới = hiện hành + 1 (`admin:access`) | Xóa `map:dataset:current` | — |

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
interface MapPlace {
  lat: number; lng: number; name: string; address: string; addressOld: string | null; display: string;
  distanceM?: number | null;   // chỉ reverse: mét từ điểm bấm tới địa chỉ tìm được
  kind?: 'poi'|'address'|'street'|'ward'|'district'|'city'|'village'|'unknown'; // suy từ ref_id `vm:POI:…`
  categories?: string[];       // mã nhóm POI của Vietmap
}
interface MapRoute {
  distanceM: number; durationS: number;
  bbox: [number, number, number, number];            // [minLng,minLat,maxLng,maxLat]
  geometry: Array<[number, number]>;                  // [lng,lat]
  steps: Array<{ text: string; distanceM: number; durationS: number; sign: number; street: string }>;
  /** Phần tử i = mức tắc của đoạn giữa đỉnh i và i+1 (độ dài = geometry − 1); null nếu không có dữ liệu. */
  congestion: Array<'low'|'moderate'|'heavy'|'severe'|'unknown'> | null;
}
```

## 4a. Lưu trữ

| Nơi | Khóa/bảng | Nội dung |
| --- | --- | --- |
| Postgres | `map_saved_places` (unique `user_id + place_id`) | Địa điểm đã lưu: `lat/lng` (6 chữ số), tên, địa chỉ, `kind`, `label` (tên gợi nhớ), `note`, `compared_at` (null = không so sánh). Không lưu `ref_id` |
| Postgres | `map_criterion_overrides` (khóa `user_id + place_key + criterion_id`) | Chỉnh tay: `skipped`, `score` (null = điểm tự động). Khôi phục mặc định thì xóa hàng |
| Postgres | `map_dataset_versions` (khóa `version`) | Phiên bản bộ dữ liệu đánh giá: `note`, `released_by`, `released_at`. Hiện hành = số lớn nhất. Hệ thống tự tạo v1 |
| Postgres | `map_places` (index `lat,lng` và `address_key`) | Địa điểm chuẩn hóa (§4d) |
| Postgres | `map_criterion_weights` (unique `user_id + criterion_id`) | Trọng số riêng của người dùng (0–5); chỉ lưu giá trị khác mặc định |
| Postgres | `map_pois` (unique `source + source_id`, index `lat,lng`) | Điểm tiện ích của lớp bản đồ: `category`, `kind`, `name`, `lat/lng`, `source_version`. Chỉ nhập bằng script, API chỉ đọc |
| Redis | `cache:map:layers:{phiên bản}:13/{x}/{y}` TTL 24 giờ, `map:pois:version` TTL 60 s | Ô lớp bản đồ; nhập phiên bản mới thì khóa đổi theo |
| Postgres | `map_place_analyses` (index `place_id, created_at`) | Mỗi lần AI chạy cho một địa điểm: `requested_by`, `dataset_version`, `measurements`. Bản mới nhất là thứ người bấm "Đánh giá" sau nhận. **Không bao giờ trả thẳng cho client** |
| Postgres | `map_place_evaluation_runs` (index `user_id, place_id, created_at`) | Mỗi lần bấm (lượt tính phí): `analysis_id`, `source` (`fresh`/`shared`). Lượt mới nhất theo (user, place) là thứ người dùng thấy |
| Redis | `cache:map:analysis:{id}` TTL 24 giờ | Bản sao bất biến của một bản phân tích; Redis lỗi thì đọc DB |
| Redis | `map:dataset:current` TTL 60 s | Phiên bản hiện hành; xóa ngay khi admin phát hành |
| Redis | `ratelimit:map:{evaluate|evaluation-read|saved|search-pins}:{userId}` | 30 / 120 / 60 / 10 lần mỗi phút |
| Trình duyệt | `localStorage["li:map-search-history"]` | Lịch sử tìm kiếm gần nhất (tối đa 8: địa điểm đã chọn hoặc từ khóa loại hình). Xóa khi đăng xuất, đọc lại có kiểm tra hình dạng và tọa độ |

Chỉnh tay (`map_criterion_overrides`) và "Đã lưu" khóa theo `place_id` (§4d), không theo tọa độ.

## 4b. Đánh giá địa điểm

Bộ tiêu chí lấy đúng mục "Hệ thống tự tính từ ghim" của [`000-ideas/tieu-chi.md`](../000-ideas/tieu-chi.md), 19 tiêu chí trong 4 nhóm:

| Nhóm | Tiêu chí | Kết quả hiển thị (ví dụ) | Chấm điểm 0–10 |
| --- | --- | --- | --- |
| Tiện ích đi bộ 500 m | Chợ, Hiệu thuốc, Siêu thị, UBND, Cửa hàng vật tư, Công viên, Trường học | "Gần · Cách chợ gần nhất 320 m" | Nội suy tuyến tính theo khoảng cách: mốc "tốt" → 10, mốc "xa" → 0 |
| | Quán ăn, cà phê | "Nhiều · 24 quán trong 500 m" | số quán / 3, tối đa 10 |
| Đi lại và đường | Đường lớn, Ga metro (2 km), Điểm xe buýt | "Vừa · Cách ga metro gần nhất 1,2 km" | như trên |
| | Nội đô | "Gần · Cách Hồ Gươm 2,4 km" (**số thật**, haversine tới 21.0285, 105.8520) | 3 km → 10, 20 km → 0 |
| | Ồn giao thông | "Yên tĩnh · Cách đường trục 600 m" | càng xa đường trục càng cao |
| Y tế | Bệnh viện (2 km) | "Xa · Cách bệnh viện gần nhất 2,8 km" | 800 m → 10, 2 km → 0 |
| Dân cư, môi trường, địa hình | Mật độ dân cư, Không khí (PM2.5 + khoảng cách trạm), Độ cao tương đối, Ngập sông (mô hình), Mảng xanh | "Trung bình · PM2.5 42 µg/m³, trạm cách 2,1 km" | xem `place-evaluation.ts` |

- **Điểm tổng** = trung bình điểm các tiêu chí không bỏ qua (1 chữ số thập phân). Mức: ≥ 8 Rất tốt, ≥ 6,5 Tốt, ≥ 5 Trung bình, còn lại Kém.
- **Điểm mạnh** = tiêu chí > 5 điểm; tiêu đề nhóm ghi "+Σ(điểm − 5)". **Điểm yếu** = tiêu chí ≤ 5; ghi "−Σ(5 − điểm)".
- **Tóm tắt nhận xét**: câu ghép từ điểm tổng, 3 điểm mạnh cao nhất, 3 điểm yếu thấp nhất. Không bịa thêm dữ kiện ngoài số đo.
- **Chỉnh tay**: mỗi tiêu chí có "Thay đổi điểm" (0–10, bước 0,5; có "Về điểm tự động") và "Bỏ qua tiêu chí" (bật/tắt). Tiêu chí bỏ qua **ở nguyên trong nhóm** (Điểm mạnh/Điểm yếu), bị gạch ngang, tên chuyển xám, vòng điểm xám; không cộng vào điểm nhóm và điểm tổng. Lưu theo người dùng + địa điểm.
- **Hiển thị điểm**: vòng tròn kiểu ScoreCircle (nền xám, cung màu theo tỷ lệ điểm/10: ≥ 7 xanh, > 5 vàng, ≤ 5 đỏ, số ở giữa). Điểm tổng vòng lớn 84 px, mỗi tiêu chí vòng 42 px.
- **Chọn tiêu chí (chuẩn bị dẫn chứng trên bản đồ)**: rê chuột lên tiêu chí → nền nhạt + biểu tượng bản đồ; bấm → tiêu chí được chọn (viền xanh) và gọi `onCriterionSelect(criterion)`. Bước sau: vẽ dẫn chứng theo tiêu chí, vd. "Trường học" vẽ tuyến từ địa điểm tới các trường gần nhất (Route v4/Matrix), "Bệnh viện" vẽ vòng 2 km và điểm bệnh viện.
- **Giai đoạn hiện tại là số liệu minh họa** (`sample: true`, UI ghi rõ). Số đo sinh ổn định theo tọa độ, nghiêng theo mức đô thị (gần Hồ Gươm thì tiện ích dày hơn). Khi có PostGIS/AI: thay `generateCriteria` bằng truy vấn thật hoặc lời gọi AI; hợp đồng `PlaceEvaluation`, phần gộp chỉnh tay và UI giữ nguyên.

## 4c. Lượt đánh giá, bản phân tích mới nhất và phiên bản dữ liệu

Mỗi lần bấm là một lượt (`map_place_evaluation_runs`, tính phí) của chính người bấm. AI chỉ thực sự chạy (tạo `map_place_analyses`) trong hai trường hợp:

1. **Địa điểm chưa ai đánh giá** và có người bấm "Đánh giá địa điểm".
2. **Có người bấm "Đánh giá lại"**. Nút này luôn bật, bấm bao nhiêu lần cũng được, và lần nào AI cũng chạy.

Các quy tắc còn lại:

- **Người sau nhận bản mới nhất.** Địa điểm đã có bản phân tích thì người bấm "Đánh giá địa điểm" nhận bản **mới nhất trong hệ thống** của địa điểm đó, tức lần "Đánh giá lại" gần nhất của bất kỳ ai. Lượt có `source: "shared"`, AI không chạy.
- **Người chưa bấm không thấy gì.** `GET` trả `{ evaluation: null }` cho người chưa có lượt, dù địa điểm đã có bản phân tích. Mọi truy vấn lọc theo `user_id` lấy từ token; không endpoint nào nhận `userId`, `runId` hay `analysisId` từ client.
- **Mở lại địa điểm chỉ đọc.** Mở lại trên bản đồ hoặc từ "Đã lưu" chỉ đọc lượt gần nhất của chính người đó, không gọi AI. Lượt cũ giữ nguyên kể cả khi người khác đã "Đánh giá lại".
- **Phiên bản dữ liệu.** Mỗi bản phân tích ghi `dataset_version` hiện hành lúc AI chạy. Phiên bản chỉ tăng khi admin phát hành ở tab **Admin › Dữ liệu đánh giá** (`/admin/datasets`). Bản theo phiên bản cũ có `outdated: true` và UI gợi ý "Đánh giá lại". Hệ thống không tự đánh giá lại.
- **Chống chạy trùng.** Có advisory lock theo địa điểm, nên nhiều người bấm "Đánh giá" cùng lúc trên địa điểm chưa có bản phân tích chỉ làm AI chạy một lần.

Bảo mật: chỉnh hoặc khôi phục tiêu chí khi chưa có lượt của chính mình trả 404 với cùng thông điệp. Phản hồi có `Cache-Control: private, no-store`, service worker không cache `/api/*`, client chỉ giữ kết quả trong bộ nhớ. DTO `whitelist` + `forbidNonWhitelisted` trả 400 khi có trường lạ.

## 4d. Nhận diện địa điểm (không theo tọa độ thô)

Lệch 1–2 m không được coi là địa điểm khác. Một cú bấm được gom vào `map_places` theo thứ tự (`place-identity.ts`, `MapPlaceResolver`):

1. **Cùng địa chỉ.** Server tự gọi Reverse cho điểm bấm (dùng chung cache với `/map/reverse` nên thường không tốn thêm request). Nếu địa chỉ cách điểm bấm ≤ 25 m, nó được chuẩn hóa (bỏ dấu, thường hóa) thành `address_key`. Một `map_places` có cùng `address_key` trong phạm vi 150 m là cùng địa điểm, nên bấm ở hai góc một tòa nhà vẫn ra một địa điểm.
2. **Gần nhau.** Không khớp địa chỉ thì lấy địa điểm gần nhất trong 20 m, trừ khi địa điểm đó mang **địa chỉ khác**. Ví dụ hai nhà liền kề "17" và "19 Điện Biên Phủ" cách 4 m vẫn là hai địa điểm.
3. **Không có thì tạo mới** tại điểm bấm. Địa điểm tạo từ điểm chưa có địa chỉ sẽ được bổ sung địa chỉ ở lần bấm sau.

Tên và địa chỉ của địa điểm do server lấy, client chỉ gửi `lat/lng`. Khi tạo địa điểm có advisory lock theo ô lưới khoảng 100 m để tránh tạo trùng. Bản phân tích đo tại tọa độ chuẩn của địa điểm, nên mọi cú bấm trong cùng địa điểm cho cùng kết quả. "Đã lưu" cũng là duy nhất theo địa điểm (`user_id + place_id`).

## 4e. Tên gợi nhớ, ghi chú và so sánh

- Chỉ địa điểm **đã lưu** mới có tên gợi nhớ, ghi chú và so sánh (đều nằm trên `map_saved_places` của chính người dùng).
- Ghi chú giữ xuống dòng, bỏ ký tự điều khiển, gộp quá 2 dòng trống, cắt 1000 ký tự. Tên gợi nhớ là một dòng, ≤ 80 ký tự.
- Danh sách so sánh tối đa **6** địa điểm (mỗi địa điểm một cột). Bảng so sánh chỉ dùng lượt đánh giá của chính người dùng; địa điểm chưa đánh giá hiện "Chưa đánh giá" và liên kết mở bản đồ. Không bao giờ lấy bản phân tích của người khác cho người chưa bấm.
- Đăng xuất xóa danh sách đã lưu đang giữ trong bộ nhớ trình duyệt và lịch sử tìm kiếm.

## 4f. Tìm kiếm theo phạm vi và ghim nhiều kết quả

- Phạm vi mặc định **10 km**, chỉnh 0,5–50 km (thanh trượt + ô số, tham số URL `r`; mặc định thì không ghi). Tâm là **điểm đang ghim**, không có thì tâm bản đồ.
- Enter: đang chọn gợi ý → mở gợi ý đó; chuỗi khớp đúng một địa điểm (chỉ một gợi ý, hoặc đúng tên một gợi ý sau khi bỏ dấu) → mở địa điểm; còn lại (vd. "ngân hàng") → gọi `/map/search/pins`, ghim các kết quả bằng ghim tròn đỏ đánh số, mở danh sách kết quả, và kéo bản đồ về tâm + chỉnh zoom vừa vòng tròn phạm vi.
- Ghim điểm: chuột phải ghim luôn điểm đó; bỏ ghim bằng mục đỏ "Bỏ ghim điểm này" cuối menu chuột phải hoặc bấm chuột trái chỗ khác trên bản đồ (thẻ Địa điểm của điểm đó đóng theo).

## 4g. Lớp hiển thị trên bản đồ (tin rao, trường học, ngân hàng, tiện ích)

Lớp hiển thị khác bộ lọc: bộ lọc thu hẹp kết quả **tìm kiếm**, còn lớp là điểm luôn hiện theo khung nhìn. Nên lớp nằm ở nút **Lớp** (góc dưới trái), cạnh kiểu bản đồ và giao thông; "Tin rao" có thêm nút bật nhanh ngay trên nút Lớp.

- **Tin đang rao** (bán và cho thuê): nhãn giá ("3,2 tỷ", "12 tr/th"), bấm mở thẻ tin (ảnh, giá, diện tích, "Xem tin", "Chỉ đường"). Tin chưa có tọa độ đặt cố định trong ~1,5 km quanh tâm quận và hiện nhạt hơn kèm ghi chú "vị trí gần đúng". Dữ liệu tin hiện ở frontend.
- **Trường học**, **Ngân hàng/ATM**, **Tiện ích khác** (chợ, hiệu thuốc, siêu thị, bệnh viện/phòng khám, công viên, quán ăn/cà phê, UBND, vật tư, xe buýt, metro; bật cả nhóm hoặc từng loại): chấm tròn màu theo nhóm, vẽ bằng lớp GeoJSON (không phải DOM) để nhẹ. Hiện từ zoom 13; quán ăn và xe buýt từ zoom 15. Bấm một chấm mở thẻ Địa điểm với tên điểm, địa chỉ lấy bằng Reverse.
- Dữ liệu tiện ích: OSM Hà Nội, `tools/data/osm_places.py` → `data/curated/places/{phiên bản}/places.ndjson` (gộp trùng cùng nhóm < 40 m) → `npx tsx scripts/import-places.ts --source osm --version …` (stdin) vào `map_pois`. Không gọi Vietmap theo khung nhìn (đắt). Client tải theo ô zoom 13, nhớ tối đa 80 ô trong tab.
- Tham số URL `layers` nhận thêm `listing, school, bank, market, pharmacy, supermarket, hospital, park, food, townhall, hardware, bus, metro` (cùng `traffic`).

## 4h. Trọng số tiêu chí

- Mỗi tiêu chí có **trọng số 0–5** (mức quan trọng). Ứng dụng đặt mặc định (`DEFAULT_WEIGHTS` trong `place-evaluation.ts`): 3 cho bệnh viện, trường học, không khí, ngập, ồn giao thông; 1 cho UBND, vật tư, quán ăn, mật độ dân cư; còn lại 2.
- Điểm tổng = Σ(điểm × trọng số) / Σ trọng số của các tiêu chí không bỏ qua và trọng số > 0; không còn tiêu chí nào thì `null`. Điểm nhóm mạnh/yếu = Σ|điểm − 5| × trọng số / trọng số trung bình (mọi trọng số bằng nhau thì như cũ). Trọng số 0 vẫn hiện, gắn chip "Không tính".
- Trọng số là **của từng người dùng**, áp dụng cho mọi địa điểm, lưu ở backend (đổi máy vẫn còn). Đổi trọng số chỉ tính lại từ bản phân tích sẵn có: **không gọi AI, không tạo lượt đánh giá**.
- Mọi phản hồi đánh giá (`/map/places/evaluation`, `/map/compare`, tóm tắt "Đã lưu") tính theo trọng số của người gọi; mỗi tiêu chí trả kèm `weight` và `defaultWeight`.

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
| Lưu lịch sử tìm kiếm ở DB | Chưa có yêu cầu; vị trí là dữ liệu cá nhân | Khi có yêu cầu "tìm gần đây". (Địa điểm **đã lưu** đã làm: §4a, chỉ lưu `lat/lng`, không lưu `ref_id`) |
| Đánh giá bằng AI và số đo thật | Chưa nhập PostGIS (OSM, WorldPop, FABDEM…) | Khi có dữ liệu nền; thay `generateCriteria` (§4b) |

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
| AC11 | Chuột phải trên bản đồ → mục đầu tiên, được tô nổi, là "Xem thông tin địa điểm này"; chọn → mở thẻ Địa điểm (kể cả khi chỉ có địa chỉ gần đúng, thẻ ghi rõ khoảng cách). |
| AC12 | Thẻ Địa điểm có: ảnh (nếu có tin rao khớp), tên, phân loại, địa chỉ chính xác (+ địa chỉ trước sáp nhập), tọa độ sao chép được, số người quan tâm (nếu có tin rao), "Tìm tin rao" mở `{root}/properties?q={tên}` với ô tìm đã điền, "Chỉ đường", "Đi từ đây", "Lưu địa điểm". |
| AC13 | "Đánh giá địa điểm" → điểm tổng, tóm tắt, Điểm mạnh (+điểm), Điểm yếu (−điểm), mỗi tiêu chí có tên, kết quả, điểm /10, nút đổi điểm và bỏ qua; đổi/bỏ qua được lưu và tải lại vẫn còn. |
| AC14 | "Lưu địa điểm" → xuất hiện trong "Đã lưu" (nút cạnh ô tìm); bấm mục đã lưu → bay tới và mở thẻ; bỏ lưu được. |
| AC15 | Người A bấm đánh giá → mở lại (tải lại trang hoặc từ "Đã lưu") tự thấy kết quả và "dữ liệu v1", không tạo lượt mới. Người B mở cùng điểm chỉ thấy nút "Đánh giá địa điểm". |
| AC16 | Admin phát hành v2 ở `/admin/datasets` → A mở lại vẫn thấy kết quả v1 kèm thông báo có dữ liệu v2; bấm "Đánh giá lại" → AI chạy, kết quả v2. "Đánh giá lại" luôn bật. |
| AC18 | B bấm "Đánh giá lại" tại địa điểm X → C (chưa từng bấm) bấm "Đánh giá địa điểm" tại X (lệch 1–3 m) → nhận đúng kết quả lần đánh giá lại của B (`source: shared`), AI không chạy. |
| AC19 | Hai nhà liền kề có số nhà khác nhau là hai địa điểm; hai cú bấm cùng địa chỉ trong 150 m là một địa điểm. |
| AC20 | Sau khi lưu, thẻ Địa điểm có nút bút chì (tên gợi nhớ) và ghi chú ngay trước nút X, và nút "So sánh". Danh sách "Đã lưu" có cùng các nút; ghi chú hiện dưới địa điểm, tối đa 2 dòng, dài thì "…". Người khác sửa mục của mình → 404. |
| AC21 | Thêm vào so sánh → badge của tab "So sánh" (ngay dưới "Bản đồ" ở thanh bên) tăng; `/…/compare` hiện bảng 1–6 cột theo điểm tổng và 19 tiêu chí, ô cao nhất mỗi hàng được tô; thêm cột thứ 7 → 409. |
| AC22 | Bấm ô tìm khi chưa gõ → popover có lịch sử gần nhất và phạm vi (mặc định 10 km); kéo/nhập bán kính → vòng tròn hiện, dừng thì mờ dần. Mở popover thì bộ lọc đóng và ngược lại; bộ lọc có badge số lựa chọn đã áp dụng. |
| AC23 | Đang ghim rồi kéo bản đồ đi chỗ khác, gõ "ngân hàng" + Enter → bản đồ về đúng điểm ghim, zoom vừa phạm vi, ghim các ngân hàng trong phạm vi bằng ghim khác ghim chính. |
| AC24 | Nút Lớp có mục "Hiển thị trên bản đồ" (Tin đang rao, Trường học, Ngân hàng, Tiện ích khác + từng loại), badge số lớp đang bật; bật lớp → điểm hiện từ zoom 13, `layers=` trên URL giữ đúng các lớp; mở lại link vẫn đúng. |
| AC25 | Bấm nhãn giá → thẻ tin rao; bấm chấm tiện ích → thẻ Địa điểm đúng tên. Kéo bản đồ qua ô đã tải không gọi lại API; ô ngoài Việt Nam hoặc tham số sai → 400/rỗng. |
| AC26 | Thẻ Địa điểm: cạnh nút đổi điểm và bỏ qua có nút trọng số (cân + số); bấm mở dãy 0–5, có mức mặc định và "Về mặc định"; đổi xong điểm tổng tính lại ngay, không tạo lượt đánh giá mới. |
| AC27 | Nút cân cạnh ô tìm (trước Bộ lọc, Đã lưu, Mức dùng) mở modal 19 tiêu chí theo nhóm; tiêu chí đã đổi có nền vàng + chip "Đã đổi" + nút về mặc định; badge = số tiêu chí đã đổi; "Đặt lại tất cả" đưa badge về 0. Người khác không bị ảnh hưởng. |
| AC17 | Người không phải admin gọi `/admin/map/dataset-versions` → 403; chỉnh tiêu chí khi chưa có lượt của mình → 404; gửi kèm `userId` → 400. |
