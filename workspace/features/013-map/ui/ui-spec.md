# Giao diện — bản đồ (013-map)

Dùng chung component cho `/app/map` (root `/app`) và `/admin/map` (root `/admin`); giữ token màu và phong cách hiện có (`green/cream/charcoal`, nền trắng, bo `rounded-lg`, bóng nhẹ).

## Bố cục (desktop)

```
┌─────────┬──────────────────────────────────────────────┬──────────────┐
│ Sidebar │ [🔍 Ô tìm kiếm + gợi ý]        [Chỉ đường]   │  Panel phải  │
│ Đã lưu  │                                              │  (địa điểm   │
│ Rao bán │                bản đồ GL                      │   hoặc chỉ   │
│         │                                              │   đường)     │
│ Cài đặt │ [Lớp]  ─ scale ─                   [＋][－][◎]│              │
└─────────┴──────────────────────────────────────────────┴──────────────┘
```

Mobile (< 1024 px): sidebar ẩn; panel phải thành **bottom sheet** (tối đa 60% chiều cao, kéo/đóng được); ô tìm chiếm cả bề rộng phía trên.

## Thành phần

1. **Ô tìm** (`map-search`): `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`; ↑/↓ chọn, Enter xác nhận, Esc đóng. Debounce 250 ms, ≥ 2 ký tự, hủy request cũ. Mỗi gợi ý: tên (đậm), địa chỉ hành chính (mới), dòng phụ nhỏ địa chỉ cũ nếu khác, khoảng cách "x,x km". Trạng thái: đang tải (spinner), không có kết quả ("Không tìm thấy địa điểm phù hợp"), lỗi (thông điệp + "Thử lại"), hết hạn mức ("Bạn tìm hơi nhanh, thử lại sau N giây").
2. **Ghim & panel địa điểm** (`map-place-panel`): bấm bản đồ hoặc chọn gợi ý → ghim màu chính, **kéo được**; thả → Reverse. Panel: tên/địa chỉ (mới + cũ), tọa độ `lat, lng` (6 chữ số) + nút Sao chép, nút **Chỉ đường đến đây**, **Xuất phát từ đây**, **Đóng**. Dòng "Địa chỉ có thể lệch vài chục mét; phân tích bám tọa độ ghim" (đúng nguyên tắc README gốc).
3. **Chỉ đường** (`map-directions`): hai ô Điểm đi / Điểm đến (dùng lại cơ chế gợi ý, có "Vị trí của tôi" và "Chọn trên bản đồ"), nút đảo chiều, chọn xe (Xe máy | Ô tô), tuyến thay thế (thẻ: thời gian, quãng đường, "Nhanh nhất"), danh sách bước (biểu tượng theo `sign`, nội dung tiếng Việt từ Vietmap, quãng đường), bấm bước → bản đồ bay tới đoạn đó. Vẽ tuyến chính nét đậm xanh, tuyến phụ xám; tô theo mức tắc nếu có (xanh/vàng/cam/đỏ). Lỗi: "Không tìm được đường" / "Điểm nằm ngoài vùng hỗ trợ".
4. **Lớp bản đồ** (`map-layer-picker`): ô nhỏ xem trước; menu 4 nền (Đường phố `tm`, Sáng `lm`, Tối `dm`, Vệ tinh `hm`) + công tắc **Giao thông** (ẩn khi `MAP_TRAFFIC_ENABLED=false`). Giữ cơ chế mở/đóng hiện có (rê chuột, trễ 2 s) nhưng thêm phím (Enter mở, Esc đóng).
5. **Điều khiển**: phóng/thu (`+`/`−`, cũng phím `+`/`-`), "Vị trí của tôi" (Geolocation, hỏi quyền khi bấm, xử lý từ chối), la bàn khi xoay (bấm = về hướng bắc), **thước tỷ lệ** tính từ `zoom` và vĩ độ giữa màn hình.
6. **Trạng thái toàn bản đồ**: đang tải style (khung xám + spinner), thiếu cấu hình (`tilesEnabled=false`: "Bản đồ chưa được cấu hình"), lỗi tải tile liên tục (banner "Không tải được bản đồ — thử lại"), `prefers-reduced-motion` → dùng `jumpTo` thay `flyTo`.
7. **Admin**: cùng bản đồ; mục "Cài đặt" của sidebar mở thẻ **Mức dùng hôm nay** (số lần gọi upstream theo API, cache hit, ngân sách còn lại) lấy từ `/admin/map/usage`.

## Đồng bộ URL và báo lỗi tham số

Trạng thái bản đồ nằm trên URL (xem README §5a): mở link có `c/z/b/p/s/layers/q/…/pin/from/to/…` là dựng lại đúng cảnh; thao tác (kéo, zoom, đổi lớp, chọn ghim, chọn tuyến…) cập nhật URL. Khi có giá trị sai, một khung `role="alert"` ở góc trên trái liệt kê `tham số: lý do` kèm nút đóng. Có bộ lọc tìm kiếm (từ `cats/scope/city/dist/ward/r`) thì hiện các chip dưới ô tìm kèm "Xóa bộ lọc"; có `avoid`/`t` thì hiện chip trong bảng chỉ đường, bỏ được từng cái. Bảng chỉ đường có ô "Hiện tuyến thay thế" (`alt`).

## Trang chi tiết `/…/map/place/[id]`

Giữ như hiện tại (chi tiết tin rao mẫu `MapPlaceDetail`) cho tới khi có module tin đăng thật; bản đồ phía sau là bản đồ thật.

## Truy cập

Mọi điều khiển có nhãn tiếng Việt (`aria-label`), điều hướng bàn phím hoàn chỉnh, tương phản ≥ 4,5:1, không chỉ dựa vào màu để thể hiện mức tắc (kèm biểu tượng/nhãn trong danh sách bước).
