# Mô hình đe dọa — Bản đồ Vietmap (013-map)

| # | Mối đe dọa | Biện pháp | Dư rủi ro |
| --- | --- | --- | --- |
| T1 | **Lộ khóa API** (bundle, log, lỗi, repo) | Khóa API chỉ ở env backend; không có trong `/map/config`; URL upstream bị che `apikey=***` trước khi ghi log/lỗi; `.env.*` bị gitignore, `.env.example` chỉ tên biến; kiểm bằng `grep` ở AC5 | Lộ qua bản sao lưu máy chủ — ngoài phạm vi |
| T2 | **Lộ khóa Tilemap** (nằm trong style URL) | Giao qua `/map/config` cho người đã đăng nhập; khóa riêng chỉ có quyền Tile; **hạn chế Referers/IP trong Console (C1)**; hạn mức 5.000 tile/ngày | Trước khi làm C1, ai lấy khóa đều dùng được tới hết hạn mức tile — **chặn lên production** |
| T3 | **Đốt hạn mức/tiền** bằng gọi lặp (người dùng hợp lệ hoặc tài khoản bị chiếm) | Giới hạn theo `userId` (Redis), ngân sách ngày toàn hệ thống, cache, `limit ≤ 10`, 2 điểm cho route (1 transaction); Throttler toàn cục khi production | Nhiều tài khoản giả đăng ký: đã có giới hạn đăng ký 5/giờ/IP ở 003-auth |
| T4 | **SSRF** | Host upstream cố định từ cấu hình, validate `https://` ở production; người dùng không đưa URL; tham số upstream được dựng lại từ trường đã validate, không chuyển tiếp query thô | — |
| T5 | **Injection tham số** (`text` chứa `&apikey=`, `%0d%0a`) | `URLSearchParams` mã hóa; `text` bỏ ký tự điều khiển, ≤ 120 ký tự; `refId` regex `[A-Za-z0-9_:.\-]{1,1500}` | — |
| T6 | **XSS qua dữ liệu upstream** (tên POI chứa HTML) | Chỉ render bằng text node/React; `Popup.setText`, không `setHTML` | Thấp |
| T7 | **Lộ vị trí người dùng (PII)** | Không lưu tọa độ gắn người dùng; log mức info không in tọa độ; cache khóa theo tọa độ làm tròn, không kèm `userId`; "Vị trí của tôi" dùng Geolocation của trình duyệt, chỉ gửi khi người dùng bấm; `Permissions-Policy` đã có ở backend | Vietmap thấy tọa độ truy vấn (đã nêu trong chính sách dữ liệu) |
| T8 | **Phản hồi upstream độc hại/hỏng** | Mapper chỉ lấy trường cần, kiểm kiểu số/chuỗi, cắt độ dài, giới hạn số điểm tuyến (≤ 20.000 đỉnh, giản lược nếu hơn); lỗi parse → `EXTERNAL_SERVICE_ERROR` | — |
| T9 | **Treo do upstream chậm** (DoS gián tiếp) | Timeout 4 s, thử lại 1 lần, cầu dao 5 lỗi/30 s, không giữ kết nối mở | — |
| T10 | **Liệt kê/leo thang quyền** | `@RequirePermission('map:use')` mọi route (deny-by-default, `route-inventory` kiểm); `/admin/map/usage` cần `admin:access` + CIDR admin sẵn có | Khách vẫn xem được bản đồ ở landing nếu sau này mở — khi đó dùng khóa Tilemap riêng cho landing |
| T11 | **CSP/worker** | Website chưa đặt CSP; nếu đặt, cho phép `worker-src blob:`, `img-src data: blob:`, `connect-src https://maps.vietmap.vn`, hoặc dùng bản `vietmap-gl-csp.js` | — |
| T12 | **Phụ thuộc chuỗi cung ứng** (`@vietmap/vietmap-gl-js`) | Ghim phiên bản chính xác `6.0.1` (không `^`), lockfile commit, package của nhà cung cấp trên GitHub `vietmap-company`; `npm audit` định kỳ | Bản fork ít người dùng hơn MapLibre |
| T13 | **Sai quyền địa lý/dữ liệu** | `maxBounds` + kiểm hộp bao Việt Nam ở backend → không geocode ngoài VN | — |
