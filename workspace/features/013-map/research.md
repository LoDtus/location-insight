# Nghiên cứu kỹ thuật — Bản đồ Vietmap (013-map)

Tiền lệ: `README.md` gốc đã chọn Vietmap cho ô tìm địa chỉ (mục "Bản đồ"), kèm lưu ý "thử trên ~20 địa chỉ Hà Nội trước khi trả tiền". Bản này **chốt dùng Vietmap cho cả nền bản đồ lẫn tìm kiếm/tìm đường** vì có đủ ba thứ trong một khóa/nhà cung cấp, và thay lựa chọn "MapLibre + tile OSM" của README gốc cho màn hình `/app/map`, `/admin/map` (README gốc coi nền chỉ để kéo ghim; tile Vietmap cập nhật địa chỉ ngõ/hẻm và đồng bộ với geocoder nên ghim và địa chỉ khớp nhau).

## Decision Record 1 — Nhà cung cấp nền bản đồ

**Status:** Accepted · **Category:** Technology Choice · **Door Type:** Two-way

### Context
Cần nền bản đồ thật cho `/app/map` và `/admin/map`. README gốc đề xuất MapLibre + tile OSM (0 đồng).

### Options Considered
| Option | Fit | Maintainability | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| MapLibre + tile OSM công cộng | Có sẵn trong README | Tốt | Dễ | Chính sách OSM cấm dùng tile công cộng cho sản phẩm có tải thực; ngõ/hẻm Hà Nội thiếu; nhãn không đồng bộ geocoder Vietmap |
| Vietmap Tilemap + `vietmap-gl-js` (fork MapLibre) | Cùng API MapLibre, cùng nhà cung cấp geocode | Tốt | Dễ: đổi `style` URL | Có hạn mức Trial (60.000 transaction/tháng), 25 tile = 1 transaction, key hạn chế domain |
| Goong / Map4D | Có | Tương đương | Dễ | Đã so ở README gốc; không có lợi thế rõ cho Hà Nội, thêm một nhà cung cấp |

### Decision
Vietmap Tilemap + `@vietmap/vietmap-gl-js@6.0.1` (bản trong tài liệu, đã ghim). Yếu tố quyết định: **một nhà cung cấp** cho nền + gợi ý + tìm đường nên ghim và địa chỉ khớp nhau; API gần như MapLibre nên chuyển đi/về rẻ.

### Consequences
Phụ thuộc hạn mức/giá Vietmap; phải hạn chế domain cho khóa Tilemap. Phụ thuộc đóng gói GL JS (UMD, không có `main` → import đường dẫn `dist/vietmap-gl.js`).

### Reversibility
Toàn bộ chi tiết nhà cung cấp nằm ở `VietmapClient`, mapper backend và `map-canvas.tsx` (style URL). Đổi sang MapLibre + nhà cung cấp khác = đổi 3 file, giữ hợp đồng `MapSuggestion/MapPlace/MapRoute`.

---

## Decision Record 2 — Gọi API tính phí qua backend, tile đi thẳng

**Status:** Accepted · **Category:** Integration Feasibility · **Door Type:** Two-way

### Context
Tài liệu Vietmap: mọi API REST phải gọi từ backend; riêng SDK bản đồ buộc khóa nằm trong style URL ở trình duyệt.

### Options Considered
| Option | Bảo mật | Hiệu năng | Chi phí | Notes |
| --- | --- | --- | --- | --- |
| Mọi thứ từ trình duyệt với một khóa | Kém: lộ khóa có quyền Route/Search | Tốt nhất | Dễ cháy hạn mức | Loại |
| REST qua backend, tile trực tiếp (khóa Tilemap riêng, hạn chế domain) | Tốt: khóa mạnh không lộ; khóa lộ chỉ có quyền tile | Tile không thêm độ trễ | Có cache + ngân sách ở backend | **Chọn** |
| REST và tile đều qua backend | Tốt nhất | Thêm một hop cho hàng trăm tile mỗi phiên, mất CDN | Băng thông backend | Không cần nếu khóa Tilemap có hạn chế domain |

### Decision
Phương án giữa. Hai khóa đúng cách Vietmap đã cấp sẵn ("2 ready-made keys").

### Consequences
Backend có cache/giới hạn/ngân sách/cầu dao; phải có Console hạn chế domain cho khóa Tilemap (README §7 mục C1). `GET /map/config` cần đăng nhập.

### Reversibility
Thêm route `/map/tiles/*` proxy nếu Vietmap không hỗ trợ hạn chế domain; frontend chỉ đổi style URL.

---

## Decision Record 3 — Cache và ngân sách

**Status:** Accepted · **Category:** Performance & Scale · **Door Type:** Two-way

### Context
Trial 60.000 transaction/tháng, 1.500/ngày cho đa số API; mỗi transaction ≈ 50 đ khi trả phí.

### Decision
Redis (đã có) làm cache với TTL theo mức đổi của dữ liệu: gợi ý 5 phút (khóa theo chữ chuẩn hóa + `focus` làm tròn ~1 km), Place 1 giờ, Reverse 24 giờ (địa chỉ ít đổi; tọa độ làm tròn ~1 m), Route 3 phút (giao thông). Single-flight trong tiến trình. Bộ đếm ngân sách ngày bằng `INCR` + `EXPIREAT`. Không thêm thư viện cache. Cache lỗi (Redis chết) → bỏ qua cache, vẫn gọi upstream nhưng **vẫn** chịu giới hạn người dùng (fail-closed 503 như auth).

### Consequences
`ref_id` bị cache tối đa 1 giờ (tài liệu khuyên không giữ lâu; 1 giờ vẫn an toàn vì chỉ dùng trong phiên chọn). Vị trí người dùng không nằm trong khóa cache ngoài `focus` đã làm tròn.

### Reversibility
Đổi TTL/khóa là sửa hằng số.

---

## Decision Record 4 — Nạp GL JS trên client

**Status:** Accepted · **Category:** Performance & Scale · **Door Type:** Two-way

`import()` động trong `useEffect` của `map-canvas.tsx` (không SSR, không chặn trang khác); CSS nạp cùng component. Không dùng wrapper React bên thứ ba (thêm phụ thuộc, không có bản chính thức cho Vietmap); bọc nhỏ bằng hook trong repo. Phương án CSP (`vietmap-gl-csp.js`) chỉ cần khi triển khai CSP chặn `blob:` worker — website hiện chưa đặt CSP; ghi chú ở threat-model T11.
