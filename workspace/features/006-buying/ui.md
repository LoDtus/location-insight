# Trang chi tiết nhà đất — đặc tả giao diện

Trang đích của một tin nhà đất (bán hoặc cho thuê). Người dùng vào từ danh sách `/nha-dat`, từ bản đồ, từ kết quả tìm kiếm hoặc link được chia sẻ.

Cơ sở: [`005-legal/README.md`](../005-legal/README.md) (ranh giới "công cụ đăng tin, không phải sàn giao dịch", mục 04 thông tin bắt buộc của tin), [`000-ideas/tieu-chi.md`](../000-ideas/tieu-chi.md) (nguyên tắc phân tích: chỉ hiện thứ đo được, kèm nguồn và mức phủ), kiểu `Listing` ở `website/src/features/landing-page/data/listings.ts`, prototype `001-ui`, và skill `.cursor/skills/00-ux-ui` (`ui-design`, chế độ Preserve; mẫu Consumer-simple + ngữ cảnh Real-estate; quy tắc mật độ Glance / Scan / Dig).

---

## 1. Mục tiêu và nguyên tắc

**Việc chính của trang:** giúp người mua/thuê trả lời "căn này có đáng để gọi không?" trong 5 giây đầu (ảnh, giá, diện tích, địa chỉ), rồi cho họ đào sâu theo ý muốn (pháp lý, vị trí, phân tích khu vực, bài đọc thêm).

**Hành động chính:** liên hệ người đăng (Gọi). Mỗi vùng chỉ có một nút chính; "Phân tích vị trí" là hành động chính của riêng khối phân tích, không tranh với nút Gọi ở thẻ liên hệ.

Nguyên tắc rút ra từ dự án và skill:

1. **Trung thực.** Giá là giá người đăng chào, không phải giá thị trường. Pháp lý là do người đăng khai, Địa Thế không xác minh. Không có nhãn "đã xác minh", "hot", "sắp hết" nếu không có cơ chế thật phía sau.
2. **Địa Thế không phải sàn giao dịch.** Trang không có form "để chúng tôi liên hệ lại", không chuyển tiếp lời nhắn, không đặt lịch xem nhà qua nền tảng, không thu hoa hồng. Người mua và người bán tự liên hệ. Mọi tính năng thêm vào (hỏi đáp, đặt lịch, form liên hệ) phải qua đánh giá lại ranh giới này (xem mục 12).
3. **Phân tích chỉ chạy khi người dùng bấm.** Mở trang không gọi, không prefetch, không chạy khi hover hoặc cuộn tới (mục 8).
4. **Mật độ vừa phải.** Glance (ảnh, giá, thông số chính, nút Gọi) nằm trên nếp gấp; Scan (mô tả, đặc điểm, pháp lý, bản đồ) ngay bên dưới; Dig (phân tích chi tiết, nguồn dữ liệu, link) mở khi cần.
5. **Giữ nhận diện hiện có (Preserve).** Dùng token ở `website/src/app/globals.css`: xanh `#026a4e`, vàng `#d4af37`, kem `#e6e2da`, chữ `#101111`, viền đậm, font hệ thống. Không thêm màu, font hay thư viện thành phần mới. Nếu thiếu token (ví dụ màu cảnh báo), suy ra từ token gần nhất và ghi chú để duyệt.

---

## 2. Tham khảo

Nhận xét dựa trên bố cục các trang chi tiết phổ biến mà tôi biết, chưa mở lại từng trang để đối chiếu từng pixel tại thời điểm viết. Giao diện các trang này đổi theo thời gian; chỉ dùng như hướng bố cục, không sao chép hình ảnh hay thương hiệu.

### Việt Nam (ưu tiên)

| Trang | Điểm đáng lấy | Điểm tránh |
| --- | --- | --- |
| Batdongsan.com.vn | Thứ tự quen thuộc: ảnh → tiêu đề → giá/diện tích/phòng ngủ → mô tả → "Đặc điểm bất động sản" dạng lưới nhãn–giá trị → bản đồ → thẻ người đăng sticky bên phải → tin tương tự. Nút "Hiện số" che số điện thoại. Có "Báo cáo tin" | Quá nhiều quảng cáo xen giữa nội dung. Nhiều nhãn "VIP", "nổi bật" gây nhiễu |
| Nhà Tốt (Chợ Tốt) | Khối giá + diện tích + giá/m² dễ quét; thông tin người bán gọn, có nút Gọi và Chat; chip đặc điểm ngắn | Chat qua nền tảng không phù hợp ranh giới pháp lý của Địa Thế |
| Mogi.vn | Bảng thông số liên tục, dễ so sánh; bản đồ ngay trong trang | Mô tả dài chiếm nửa trang, thiếu phân tầng |
| Alonhadat | Tin đơn giản, tải nhanh, thông số dạng bảng | Giao diện dày, chữ nhỏ |
| Homedy | Thẻ dự án/ khu vực lân cận, link tới tin cùng dự án | Điều hướng nhiều tầng |

### Quốc tế

| Trang | Điểm đáng lấy |
| --- | --- |
| Zillow, Redfin | Gallery lớn có lightbox; "Facts and features" gập mở theo nhóm; bản đồ + điểm đi bộ/giao thông (Walk Score) ở trang; ước tính trả góp |
| Rightmove, Zoopla, Domain | Khối "key features" 4–6 gạch; ảnh mặt bằng (floor plan) là tab riêng; thẻ liên hệ sticky; "Local area" gắn với bản đồ |
| Realtor.com | Lịch sử giá/ thuế (không dùng ở đây vì không có dữ liệu) |
| Airbnb | Mục "Nơi bạn sẽ ở" với bản đồ có vòng tròn khu vực xấp xỉ thay vì ghim chính xác khi cần bảo vệ riêng tư; nút sticky ở mobile |

### Quyết định rút ra

- Dùng bố cục **một cột chính + thẻ liên hệ sticky bên phải** (desktop), **một cột + thanh hành động dính đáy** (mobile). Đây là mô hình quen thuộc nhất với người dùng Việt Nam.
- Dùng **lưới nhãn–giá trị** cho đặc điểm (kiểu Batdongsan), nhưng chỉ hiện dòng có dữ liệu, không để dòng "Đang cập nhật".
- Số điện thoại **che sẵn, bấm "Hiện số"** để giảm bị cào số.
- **Không** copy: nhãn VIP/hot, quảng cáo xen, chat qua nền tảng, ước tính giá thị trường (Zestimate-style) khi chưa có dữ liệu giá.

---

## 3. Route và điều hướng

| Mục | Quyết định |
| --- | --- |
| URL | `/nha-dat/{slug}` (ví dụ `/nha-dat/nha-van-mieu`). Slug ổn định, không đổi khi sửa tiêu đề; đổi slug thì 301 từ slug cũ |
| Truy cập | Công khai, không cần đăng nhập để xem. Cần đăng nhập để Lưu, Phân tích (có hạn mức), Báo cáo tin |
| Breadcrumb | Trang chủ › Nhà đất › {Quận/huyện} › {tiêu đề rút gọn}. Mỗi mục là link |
| Quay lại | Nút "← Quay lại danh sách" giữ nguyên bộ lọc, sắp xếp, trang, kiểu xem của `/nha-dat` (đã nằm trong query string) |
| Từ bản đồ | `/app/map/place/{id}` mở panel chi tiết gọn (Dig) với link "Xem trang đầy đủ" tới trang này |
| Chia sẻ | Link sạch (không tham số theo dõi), có Open Graph (ảnh bìa, giá, địa chỉ rút gọn) |

---

## 4. Bố cục

### Desktop 1440 px

```
┌─────────────────────────────────────────────────────────────────────┐
│ Header chung                                                        │
├─────────────────────────────────────────────────────────────────────┤
│ Trang chủ › Nhà đất › Đống Đa › Nhà phố 4 tầng ngõ Văn Miếu         │
├───────────────────────────────────────────────┬─────────────────────┤
│ GALLERY (ảnh lớn + 4 ảnh nhỏ, "Xem 12 ảnh")   │ THẺ LIÊN HỆ (sticky)│
│                                               │  Giá  12,6 tỷ       │
├───────────────────────────────────────────────┤  263 triệu/m²       │
│ [Bán] [Nhà phố]                  Lưu · Chia sẻ│  [ Gọi 09xx xxx ]   │
│ Nhà phố 4 tầng ngõ Văn Miếu                   │  [ Hiện số ] Zalo   │
│ Ngõ Văn Miếu, P. Văn Miếu - Quốc Tử Giám      │  Người đăng · Chủ nhà│
│ 12,6 tỷ · 48 m² · 4 ngủ · 3 vệ sinh · Sổ đỏ   │  Cập nhật 23/10/2026│
├───────────────────────────────────────────────┤  Báo cáo tin        │
│ Mô tả                                         │                     │
│ Đặc điểm (lưới nhãn–giá trị)                  │                     │
│ Pháp lý (người đăng khai)                     │                     │
├───────────────────────────────────────────────┤                     │
│ Vị trí: BẢN ĐỒ + địa chỉ + khoảng cách        │                     │
├───────────────────────────────────────────────┤                     │
│ Phân tích vị trí  [ Phân tích địa điểm này ]  │                     │
├───────────────────────────────────────────────┴─────────────────────┤
│ Bài viết liên quan (3 thẻ)                                          │
│ Link liên quan (danh sách)                                          │
│ Tin tương tự (4 thẻ, tuỳ chọn)                                      │
└─────────────────────────────────────────────────────────────────────┘
```

Cột chính rộng khoảng 8/12 (tối đa 760 px cho dòng chữ), thẻ liên hệ 4/12 (320–360 px), dính khi cuộn, `top` bằng chiều cao header + 16 px.

### Mobile 390 px

Một cột, thứ tự: gallery vuốt ngang (có số ảnh `3/12`) → giá + tiêu đề + địa chỉ + thông số chính → mô tả (rút gọn 4 dòng, "Xem thêm") → đặc điểm (gập) → pháp lý → bản đồ (cao 220 px, bấm để mở toàn màn hình) → khối phân tích → bài viết (cuộn ngang) → link liên quan → tin tương tự. **Thanh hành động dính đáy**: nút chính "Gọi" + nút phụ "Lưu"; "Hiện số", Zalo nằm trong thẻ liên hệ dưới ảnh đầu tiên và trong ngăn kéo khi bấm "Liên hệ".

### Điểm gãy

| Rộng | Thay đổi |
| --- | --- |
| ≥ 1024 | Hai cột, thẻ liên hệ sticky |
| 768–1023 | Một cột; thẻ liên hệ chuyển thành khối ngay dưới tiêu đề; thanh hành động dính đáy |
| < 768 | Như mobile ở trên |

### Thứ tự khối và lớp tiết lộ

| Lớp | Khối | Ghi chú |
| --- | --- | --- |
| Glance | Gallery, nhãn (Bán/Thuê, loại), tiêu đề, địa chỉ, giá, diện tích, phòng, pháp lý rút gọn, nút Gọi | Dưới 5 giây là đủ quyết định "đọc tiếp hay thôi" |
| Scan | Mô tả, đặc điểm, pháp lý chi tiết, bản đồ, nút Phân tích | Cuộn một đến hai màn |
| Dig | Kết quả phân tích đầy đủ, nguồn dữ liệu, toàn bộ link liên quan, tất cả ảnh (lightbox) | Mở khi bấm; không tải sẵn |

---

## 5. Thông tin của trang

Quy ước cột "Mức":

- **BB** — bắt buộc: không có thì tin không được đăng (kiểm ở form đăng tin), và trang luôn hiện.
- **BB\*** — bắt buộc theo điều kiện (loại hình hoặc mục đích).
- **MD** — metadata tuỳ chọn: có thì hiện, không có thì **ẩn hẳn dòng đó**, không hiện "Đang cập nhật" hay "—".
- **HT** — hệ thống tự sinh, người đăng không nhập.

Các trường BB khớp mục "Thông tin bắt buộc trong mỗi tin" ở `005-legal/README.md`: loại giao dịch, loại BĐS, địa chỉ và tọa độ xấp xỉ, diện tích, giá, pháp lý, liên hệ.

### 5.1. Nhận diện và giá

| Trường | Mức | Hiển thị | Ghi chú |
| --- | --- | --- | --- |
| `id`, `slug` | HT | URL | Slug ổn định |
| Mục đích (`purpose`: bán/thuê) | BB | Nhãn trên tiêu đề | Hai giá trị `ban`, `thue` như `Listing` |
| Loại hình (`kind`: căn hộ, nhà phố, biệt thự, đất) | BB | Nhãn + quyết định các trường BB\* bên dưới | |
| Tiêu đề (`title`) | BB | `h1` | 20–100 ký tự; không toàn chữ hoa, không chèn số điện thoại |
| Giá (`priceVnd`) | BB | Số lớn nhất của trang: `12,6 tỷ` hoặc `15 triệu/tháng` | Luôn kèm đơn vị. Bán theo tỷ/triệu, thuê theo triệu/tháng. Hiển thị chính xác giá người đăng nhập |
| Giá/m² | HT | Dưới giá, chữ phụ: `263 triệu/m²` | Chỉ với tin bán có diện tích. Thuê thì có thể hiện `/m²/tháng`. Ghi chú "tính từ giá chào" |
| Giá thương lượng | MD | Chip "Thương lượng" | Chỉ hiện nếu người đăng bật |
| Tiền cọc, kỳ thanh toán (thuê) | BB\* nếu thuê | Dòng trong đặc điểm | Thiếu thì tin thuê hiện không hoàn chỉnh; nên bắt buộc khi thuê |
| Ngày cập nhật | HT | `Cập nhật 23/10/2026` | Định dạng `dd/mm/yyyy` |
| Ngày đăng, hạn tin | HT | Dòng phụ trong thẻ liên hệ | Hạn tin theo chính sách đăng tin (30/60/90 ngày) |
| Mã tin | HT | Dòng phụ | Để báo cáo vi phạm và chia sẻ khi gọi điện |

### 5.2. Địa chỉ và vị trí

| Trường | Mức | Hiển thị | Ghi chú |
| --- | --- | --- | --- |
| Quận/huyện (`district`) | BB | Breadcrumb, dưới tiêu đề | |
| Phường/xã | BB | Dưới tiêu đề | Theo đơn vị hành chính hiện hành |
| Địa chỉ dòng (`location`): tên đường/ngõ/khu | BB | Dưới tiêu đề | Số nhà có thể ẩn (xem `Mức độ chính xác`) |
| Tọa độ (`lat`, `lng`) | BB | Ghim trên bản đồ | Do người đăng kéo ghim hoặc xác nhận kết quả geocode. Tin thiếu tọa độ không được đăng |
| Mức độ chính xác vị trí | BB | Nhãn dưới bản đồ | 3 giá trị: `chính xác` (người đăng xác nhận ghim), `xấp xỉ` (hiện vòng tròn bán kính ~100–200 m, không hiện ghim), `chỉ theo phường` |
| Tên dự án / tòa nhà / khu đô thị | BB\* căn hộ; MD với loại khác | Dòng trên địa chỉ, là link tới trang khu | Có thì dùng làm khóa cho link liên quan và tin tương tự |
| Hướng dẫn tìm đường, mốc gần nhất | MD | Dòng trong khối vị trí | Ví dụ "đối diện Văn Miếu" |

### 5.3. Thông số chính

| Trường | Mức | Hiển thị |
| --- | --- | --- |
| Diện tích (`areaM2`) | BB | `48 m²` |
| Số phòng ngủ (`beds`) | BB\* căn hộ, nhà phố, biệt thự; ẩn với đất | `4 ngủ` |
| Số phòng khách (`living`) | MD | `1 khách` |
| Số vệ sinh (`baths`) | BB\* căn hộ, nhà phố, biệt thự | `3 vệ sinh` |
| Số tầng | BB\* nhà phố, biệt thự | `4 tầng` |
| Tầng (căn hộ) | BB\* căn hộ | `Tầng 12` |
| Mặt tiền (m) | BB\* đất, nhà phố; MD khác | `Mặt tiền 4 m` |
| Chiều sâu / chiều dài (m) | MD | |
| Đường vào / bề rộng ngõ (m) | MD | Chỉ hiện nếu người đăng khai; không suy ra từ dữ liệu bản đồ |
| Hướng nhà / hướng ban công | MD | `Đông Nam` |
| Số chỗ để xe, thang máy | MD | Chip |
| Nội thất (đầy đủ, cơ bản, trống) | BB\* thuê; MD khi bán | |
| Năm xây dựng / bàn giao | MD | |

Glance chỉ hiện 4–5 thông số: diện tích, ngủ, vệ sinh (hoặc mặt tiền với đất), pháp lý, hướng nếu có. Phần còn lại ở lưới "Đặc điểm".

### 5.4. Pháp lý

| Trường | Mức | Hiển thị |
| --- | --- | --- |
| Tình trạng pháp lý do người đăng khai (sổ đỏ/sổ hồng, đang chờ sổ, hợp đồng mua bán/góp vốn, vướng quy hoạch, chưa khai rõ) | BB | Chip ở Glance + dòng chi tiết ở khối Pháp lý |
| Loại đất / mục đích sử dụng (thổ cư, đất dự án…) | BB\* đất | |
| Thời hạn sở hữu (lâu dài / có thời hạn) | MD | |
| Ghi chú pháp lý của người đăng | MD | |

Dòng bắt buộc dưới khối: *"Thông tin pháp lý do người đăng khai. Địa Thế không kiểm tra giấy tờ. Hãy yêu cầu xem sổ và kiểm tra tại cơ quan có thẩm quyền trước khi đặt cọc."* Giá trị `vướng quy hoạch` và `chưa khai rõ` hiển thị trung tính, không tô đỏ cảnh báo quá mức nhưng phải đọc được ngay ở Glance.

### 5.5. Mô tả và hình ảnh

| Trường | Mức | Ghi chú |
| --- | --- | --- |
| Mô tả (`moTa`) | BB (tối thiểu 50 ký tự) | Chữ thường, xuống dòng giữ nguyên; làm sạch HTML; chặn số điện thoại/link trong mô tả (đưa vào ô liên hệ) |
| Ảnh | BB: tối thiểu 1 ảnh (khuyến nghị ≥ 5). Ảnh đầu là ảnh bìa | Mỗi ảnh có `alt` (tự sinh: `{tiêu đề} — ảnh {n}`), thứ tự do người đăng chọn |
| Chú thích ảnh | MD | `Phòng khách`, `Mặt tiền` |
| Ảnh mặt bằng (floor plan) | MD | Tab riêng trong lightbox "Mặt bằng" |
| Video / tham quan 360° | MD | Chỉ hiện nút nếu có; không nhúng tự phát |
| Nhãn "ảnh minh họa" | BB\* | Bắt buộc hiện nếu ảnh là phối cảnh/ảnh dựng (xem `imagery-and-assets.md`) |

### 5.6. Người đăng và liên hệ

| Trường | Mức | Hiển thị |
| --- | --- | --- |
| Số điện thoại liên hệ | BB | Che sẵn `09xx xxx 123`; bấm "Hiện số" mới hiện đủ và đổi thành link `tel:` |
| Tên hiển thị người đăng | BB | Tên hiển thị trong tài khoản, không lộ email |
| Vai trò do người đăng khai (chủ nhà, người được ủy quyền, môi giới) | BB | Chip. Là do người đăng khai, không phải xác thực |
| Zalo | MD | Nút "Zalo" mở `zalo.me/{số}` nếu người đăng bật |
| Ảnh đại diện | MD | Chữ cái đầu khi không có |
| Ngày tham gia, số tin đang đăng | HT | Dòng phụ |
| Email xác thực | HT | Chip "Đã xác thực email" chỉ khi đúng (theo chính sách đăng tin yêu cầu email xác thực) |

### 5.7. Dữ liệu hệ thống cho phần mở rộng

| Trường | Mức | Dùng cho |
| --- | --- | --- |
| Danh sách link liên quan (mục 9) | MD | Khối "Link liên quan" |
| Thẻ chủ đề, khu vực để ghép bài viết (mục 10) | HT + MD | Khối "Bài viết liên quan" |
| Trạng thái tin (`đang rao`, `đã giao dịch`, `hết hạn`, `đã gỡ`) | HT | Banner và ẩn nút liên hệ (mục 11) |
| Lượt xem | HT, MD | Chỉ hiện nếu số liệu thật và đủ lớn để có ý nghĩa; mặc định ẩn |

---

## 6. Chi tiết từng khối

### 6.1. Gallery

- Desktop: 1 ảnh lớn (tỷ lệ 16:10) + lưới 4 ảnh nhỏ bên phải; nút "Xem tất cả {n} ảnh" mở lightbox. Mobile: vuốt ngang, bộ đếm `3/12`, không tự chạy.
- Lightbox: phím ← → Esc, nút đóng 44 px, tab "Ảnh / Mặt bằng / Video" chỉ hiện tab có dữ liệu, chú thích, focus bị giữ trong hộp thoại và trả về nút mở.
- Ảnh đầu tải ưu tiên cao (`priority`), còn lại `lazy`; WebP/AVIF, có `width`/`height` để không nhảy bố cục; ảnh lỗi thì hiện khung có biểu tượng ảnh hỏng và tên ảnh, không để ô trống.
- Một ảnh: không hiện lưới nhỏ, ảnh lớn chiếm toàn bề rộng.
- Ảnh phải là ảnh thật của tin. Dữ liệu mẫu hiện đang dùng chung ba ảnh `temp-002..004.jpg` cho mọi tin; trang phải ghi "Ảnh minh họa" cho đến khi có ảnh thật (mục mở).

### 6.2. Đầu trang tin (Glance)

- Hàng nhãn: `Bán`/`Cho thuê`, loại hình, trạng thái pháp lý (chip). Bên phải: `Lưu` (biểu tượng tim + chữ), `Chia sẻ`.
- `h1` tiêu đề; dòng địa chỉ có biểu tượng ghim, bấm cuộn tới bản đồ.
- Dãy thông số chính 4–5 mục dạng `biểu tượng + giá trị + nhãn` (nhãn luôn hiện chữ, không chỉ biểu tượng).
- Giá lớn nhất trang (24–32 px, đậm), kèm giá/m² chữ phụ. Với thuê: `15 triệu/tháng`.

### 6.3. Mô tả

Hiện 6 dòng đầu, nút "Xem thêm" mở hết (không điều hướng). Dòng cuối: `Mã tin 20261024-0012 · Cập nhật 23/10/2026`.

### 6.4. Đặc điểm

Lưới nhãn–giá trị 2 cột (1 cột trên mobile), nhóm tối đa ba nhóm: *Cấu trúc* (tầng, ngủ, vệ sinh, mặt tiền, chiều sâu), *Tiện nghi* (hướng, nội thất, chỗ để xe, thang máy), *Hợp đồng* (đặt cọc, kỳ thanh toán với tin thuê). Chỉ hiện nhóm có ít nhất một dòng; trên mobile nhóm đầu mở, nhóm sau gập.

### 6.5. Pháp lý

Chip tình trạng + các dòng MD + câu lưu ý ở mục 5.4. Link "Cách kiểm tra pháp lý một căn nhà" tới bài viết nội bộ nếu có (xem mục 10).

### 6.6. Thẻ liên hệ (sticky)

Nội dung theo thứ tự: giá (lặp lại) → nút chính **Gọi** (`tel:`, hiện số đã che; sau khi bấm "Hiện số" thì hiện số đủ) → Zalo (nếu có) → tên người đăng + vai trò + ngày tham gia → `Lưu` → `Báo cáo tin`. Không có form để lại tin nhắn trong giai đoạn này.

Dưới thẻ, chữ phụ: *"Địa Thế là công cụ đăng tin, không phải sàn giao dịch hay đơn vị môi giới. Bạn và người đăng tự liên hệ và tự chịu trách nhiệm về giao dịch."*

Không đưa lời hứa phản hồi ("Phản hồi trong 5 phút") nếu không đo được.

### 6.7. Báo cáo tin

Nút văn bản nhỏ trong thẻ liên hệ và cuối trang. Bấm mở hộp thoại ngắn: lý do (sai giá/diện tích, không còn bán, ảnh không đúng, lừa đảo, khác), ghi chú tùy chọn, xác nhận. Xong hiện xác nhận "Đã ghi nhận. Chúng tôi sẽ xem xét." Đây là mục bắt buộc theo chính sách đăng tin; không cần đăng nhập nếu chống spam bằng giới hạn tốc độ.

---

## 7. Bản đồ và vị trí

**Mục tiêu:** ghim đúng vào vị trí của tin, và người dùng nhìn là hiểu "nằm ở đâu so với khu xung quanh".

### Dữ liệu và cách vẽ

- Nền bản đồ: MapLibre với tile OpenStreetMap (theo `000-ideas/tieu-chi.md`). Phải hiện ghi nguồn "© OpenStreetMap contributors" ở góc.
- **Ghim đặt đúng tại `lat`/`lng` của tin**, zoom mặc định 16 (mức thấy đường và ngõ), khung không cho cuộn chuột làm lệch trang (cuộn trang bình thường, phóng to bằng nút hoặc hai ngón; trên desktop cần nhấn giữ Ctrl hoặc nút "Bấm để tương tác").
- Theo mức độ chính xác:
  - `chính xác`: một ghim và nhãn "Vị trí do người đăng xác nhận".
  - `xấp xỉ`: vòng tròn bán kính 100–200 m, không ghim, nhãn "Vị trí xấp xỉ. Hỏi người đăng địa chỉ chính xác".
  - `chỉ theo phường`: không hiện bản đồ chi tiết, hiện ranh phường nếu có; nút Phân tích vô hiệu kèm lý do (mục 8).
- Hiện trên bản đồ: ghim tin, các tiện ích trong 500 m chỉ **sau khi phân tích** (mục 8). Trước khi phân tích bản đồ chỉ có ghim, không tô lớp nào.
- Có phương án thay thế cho người không dùng được bản đồ: dòng địa chỉ dạng chữ, tọa độ có thể sao chép (nút "Sao chép địa chỉ"), và link "Mở trong ứng dụng bản đồ" (`geo:` hoặc link bản đồ ngoài; link ngoài mở tab mới).

### Điều khiển và liên kết

| Phần tử | Hành vi |
| --- | --- |
| Nút `+` `−`, nút "Về ghim" | Phóng, thu, đưa về vị trí tin |
| "Xem bản đồ lớn" | Tới `/app/map/place/{id}` mở đúng điểm, mở panel chi tiết của bản đồ chính |
| "Chỉ đường" | Link ngoài (mở tab mới), không nhúng dịch vụ trả phí |
| "Sao chép địa chỉ" | Có xác nhận bằng văn bản "Đã sao chép" |
| Bàn phím | Bản đồ focus được; phím mũi tên di chuyển, `+`/`−` phóng thu |

### Trạng thái

- Đang tải: khung cùng tỉ lệ có chữ "Đang tải bản đồ", không nhảy bố cục.
- Lỗi tile hoặc mất mạng: giữ nguyên khung, hiện dòng địa chỉ chữ + nút "Thử lại", không để ô trắng.
- Thiếu tọa độ (tin cũ): thay khối bằng "Chưa có vị trí chính xác cho tin này" và địa chỉ chữ; ẩn nút Phân tích có lý do.

### Mobile

Bản đồ cao 220 px trong trang; bấm "Mở toàn màn hình" mở lớp phủ có nút đóng 44 px. Nội dung bên dưới không bị bản đồ nuốt thao tác cuộn.

---

## 8. Nút "Phân tích vị trí" (chỉ chạy khi bấm)

**Nguyên tắc cứng:** mở trang không tạo ra một yêu cầu phân tích nào, không prefetch, không chạy khi hover, focus hay cuộn tới. Mỗi lần phân tích tốn tài nguyên (truy vấn PostGIS, có thể gọi LLM viết nhận xét) và có hạn mức, nên chỉ chạy sau hành động rõ ràng.

### 8.1. Trạng thái "chưa phân tích" (mặc định)

Khối Scan ngay dưới bản đồ, **không** hiện số liệu nào. Nội dung:

- Tiêu đề: `Phân tích khu vực quanh căn này`.
- Một câu: *"Tính từ ghim của tin: tiện ích trong 500 m, đường và giao thông, cao độ và mô hình ngập sông, không khí, mật độ dân cư. Mỗi số kèm nguồn và mức phủ dữ liệu."*
- Danh sách 4–5 nhóm sẽ có (chữ, không có số): Tiện ích đi bộ · Đi lại và đường · Dân cư · Môi trường (không khí, cao độ, ngập sông, mảng xanh).
- Nút chính: **`Phân tích địa điểm này`** (48 px). Dưới nút, chữ phụ: `Khoảng vài giây · Dùng 1 lượt phân tích trong hạn mức của bạn` (hiển thị số lượt còn lại nếu đã đăng nhập; chỉ nói "khoảng vài giây" khi đã đo thật).
- Khách chưa đăng nhập: nút đổi thành `Đăng nhập để phân tích`, dẫn tới đăng nhập rồi quay lại đúng tin (`?next=`), **và không tự chạy phân tích sau khi quay lại**: người dùng phải bấm lần nữa.

### 8.2. Khi bấm

1. Nút chuyển sang trạng thái tải (`aria-busy`, vô hiệu, chữ `Đang phân tích…`), tránh bấm đúp.
2. Gửi yêu cầu với `tin id` và tọa độ của tin (server tự lấy tọa độ từ tin, không tin giá trị client).
3. Hiển thị tiến trình theo bước thật nếu có (`Tìm tiện ích → Đường → Môi trường`), nếu không thì vòng quay có chữ. Có nút `Hủy`.
4. Kết quả gắn vào đúng khối này (không chuyển trang), cuộn tới đầu kết quả, và đặt focus vào tiêu đề kết quả.

### 8.3. Trạng thái kết quả

**Có kết quả** (khung hiển thị: mục 8A)

- Dòng tóm tắt (2–3 câu) viết từ dữ liệu đo được, đúng ngôn ngữ của `tieu-chi.md`: chỉ nói thứ đo được, kèm mức phủ.
- Hàng 3 KPI (như prototype `kpis`): ví dụ "Mức phủ trong 500 m", "Hiệu thuốc gần nhất", "Tới Hồ Gươm".
- Hai danh sách ngắn: **Điểm mạnh** (3 dòng) và **Chỗ còn thiếu dữ liệu hoặc cần kiểm tra** (tối đa 5 dòng). Không dùng cụm "điểm yếu" khi nguyên nhân là thiếu dữ liệu.
- Nhóm số liệu chi tiết (Tiện ích đi bộ, Đi lại và đường, Dân cư, Môi trường) gập sẵn; mỗi dòng có: kết quả, nguồn, bán kính, nhãn độ tin cậy (`cao` / `trung bình` / `thấp`).
- Bản đồ phía trên được tô vòng 500 m và các điểm tiện ích; có công tắc "Hiện tiện ích trên bản đồ" (mặc định bật sau khi có kết quả).
- Chân khối: `Cập nhật 18/10/2026 · Số liệu: OpenStreetMap, WorldPop, FABDEM… ` + link "Xem nguồn dữ liệu" + liên kết "Mở báo cáo đầy đủ" sang `/app/bao-cao` (hoặc trang báo cáo tương ứng). Nút phụ `Lưu vào lịch sử`, `Phân tích lại`.
- Dòng bắt buộc: *"Đây là tham chiếu từ dữ liệu mở, không phải kết luận pháp lý hay tư vấn đầu tư. Không có số liệu không có nghĩa là khu vực không có."*

**Kết quả một phần (partial)**: hiện phần đã có, các nhóm thiếu ghi rõ "Chưa có dữ liệu cho nhóm này" và lý do (ví dụ trạm không khí gần nhất cách quá 3 km nên không gán cho ô đất).

**Đã có kết quả gần đây (cache)**: mở nút lần sau trả kết quả đã lưu, ghi ngày tính; nút đổi thành `Phân tích lại` (có thể tốn thêm lượt, ghi rõ).

**Lỗi**: thông báo tiếng người, giữ nguyên nút để thử lại: *"Chưa phân tích được lúc này. Lượt của bạn chưa bị trừ. Thử lại sau ít phút."* Không hiện mã lỗi thô.

**Hết hạn mức**: *"Bạn đã dùng hết lượt phân tích hôm nay."* + thời điểm làm mới + (khi có gói) nút nâng cấp. Không che kết quả đã lưu trước đó.

**Không đủ điều kiện chạy**: nút vô hiệu kèm lý do ngay bên dưới, không để người dùng đoán — thiếu tọa độ; vị trí chỉ theo phường; tin ngoài phạm vi Hà Nội ("Hiện chỉ phân tích khu vực Hà Nội").

### 8.4. Quy tắc nội dung phân tích

Tuân theo `tieu-chi.md`:

- Không nói "khu này không có", "dễ ngập", "an ninh tốt", "xe cứu hỏa vào được". Dùng đúng tên chỉ số: cao độ tương đối, độ sâu mô hình ngập sông, khoảng cách tới đường loại secondary…
- Giá của tin là giá chào, trang này **không** so sánh với "giá thị trường".
- Nếu vị trí tin ở mức `xấp xỉ`, thêm cảnh báo: kết quả tính từ tâm vòng tròn, độ tin cậy giảm.

### 8.5. Hành vi kỹ thuật cần có

- Yêu cầu có khóa chống chạy trùng (idempotency theo `tin id + ngày`), giới hạn tốc độ theo người dùng.
- Kết quả cache theo ô địa lý để giảm chi phí; chỉ cache số đo, không cache nhận xét đã cá nhân hóa.
- Phân tích **không sửa** tin và không hiện công khai cho người khác; chỉ người bấm nhìn thấy và lưu trong lịch sử của họ.
- Analytics: ghi sự kiện `analysis_click`, `analysis_success`, `analysis_error` (không ghi số điện thoại hay nội dung riêng tư).

---

## 8A. Khung kết quả phân tích dùng lại (`AnalysisPanel`)

Mock: [`chi-tiet-nha-dat.html`](chi-tiet-nha-dat.html). Mở thêm `?view=map` hoặc chọn "Panel /map" trong bảng mock để xem cùng component đặt trong panel `/map`.

**Mục tiêu:** một component duy nhất hiển thị kết quả phân tích ở hai nơi: cột chính của trang chi tiết (rộng khoảng 760 px) và panel chi tiết trên `/map` (`map-place-detail.tsx`, rộng 480 px). Thêm chỉ số, nhóm hoặc địa điểm so sánh mới không được làm vỡ bố cục. Mục 8.3 mô tả nội dung kết quả; mục này mô tả khung chứa nó.

### 8A.1. Nguyên tắc

1. **Co giãn theo khung chứa, không theo viewport.** Component dùng container query (`container-type: inline-size`), nên cùng một mã chạy ở 480 px và 760 px mà không cần biến thể riêng.
2. **Dựng từ dữ liệu.** Hàng, cột, nhóm đều sinh từ ba danh sách (mục 8A.5). Thêm một phần tử là thêm một dòng dữ liệu, không sửa bố cục.
3. **Lớp tiết lộ cố định:** Glance (mức phủ, KPI) → Scan (tab Tóm tắt) → Dig (tab Chỉ số, So sánh). Tab thứ tư, thứ năm có thể thêm sau; tối đa 5.
4. **Không chấm điểm, không xếp hạng.** Nhãn "gần nhất", "nhiều nhất" chỉ nói số đo nào hơn số đo nào, tuân theo `000-ideas/tieu-chi.md`. Không có tổng điểm, không có màu "tốt" hoặc "xấu".
5. **Thiếu dữ liệu khác với bằng 0.** "Không thấy trong 500 m" và "Chưa có dữ liệu" là hai ô khác nhau và không bao giờ hiện thành `0`, trừ khi số đếm thực sự bằng 0.
6. **Nút phân tích vẫn chỉ chạy khi bấm** (mục 8.1–8.2). Component sở hữu cả trạng thái chưa chạy, đang chạy, lỗi, hết lượt, kết quả.

### 8A.2. Cấu trúc (trên xuống)

| Vùng | Nội dung | Ghi chú |
| --- | --- | --- |
| Đầu | Tiêu đề "Phân tích vị trí", dòng chủ thể ("Quanh ghim của tin" hoặc "Quanh điểm đã chọn"), chip meta: bán kính, ngày cập nhật dữ liệu, "Số liệu minh họa" khi là mẫu | Chip meta chỉ hiện sau khi có kết quả |
| Mức phủ | Một dòng chữ "Mức phủ dữ liệu: khá" + số điểm trong bán kính + thanh 5 đoạn | Có chữ và `aria-label`, không chỉ dựa vào màu |
| KPI | 2–4 ô, tự xuống hàng (`auto-fit`, tối thiểu 128 px) | Chọn theo ngữ cảnh: tin mua → chợ, ga metro, quán ăn; sau này có thể đổi theo vai trò người dùng |
| Tab | Tóm tắt, Chỉ số, So sánh. Dính đầu vùng cuộn | Bàn phím: ← → Home End; `role="tablist"` |
| Chân | Nguồn, câu miễn trừ, hành động: Mở báo cáo đầy đủ, Lưu vào lịch sử, Phân tích lại | Một nút chính |

### 8A.3. Nội dung từng tab

**Tóm tắt (mặc định).** Đoạn tóm tắt 2–4 câu viết từ số đo; hai danh sách **Điểm mạnh** (tối đa 3 dòng) và **Chỗ thiếu dữ liệu hoặc cần kiểm tra** (tối đa 5 dòng). Từ 620 px chiều rộng khung chứa, hai danh sách đứng cạnh nhau; dưới đó xếp dọc. Dùng cụm "cần kiểm tra", không dùng "điểm yếu" khi nguyên nhân là thiếu dữ liệu.

**Chỉ số.** Các nhóm gập mở (`details`), nhóm đầu mở sẵn. Mỗi nhóm có biểu tượng, tên, số chỉ số cần kiểm tra (chip vàng) và đoạn giới thiệu một dòng. Mỗi hàng: nhãn, giá trị, thanh khoảng cách (chỉ với số đo khoảng cách, so với bán kính của chính chỉ số đó; có `aria-label` bằng chữ), ghi chú, nguồn, bán kính, và chip độ tin cậy (cao, trung bình, thấp). Công cụ lọc "Chỉ chỗ cần kiểm tra" ẩn các hàng đã ổn. Từ 620 px, hàng có ba cột (nhãn, giá trị, độ tin cậy); dưới đó nhãn và độ tin cậy cùng hàng, giá trị xuống dưới.

**So sánh.** Bảng thuộc tính đặt nhiều địa điểm cạnh nhau (xem 8A.4).

### 8A.4. Bảng so sánh

- **Cột:** "Căn này" (nền xanh nhạt) + tối đa 3 địa điểm thêm vào (tổng 4, đúng giới hạn compare ở `real-estate.md`) + một cột tham chiếu tùy chọn "Trung vị trong 1 km" (nền kem, viền đứt, ghi "Tham chiếu"). Nút **Thêm địa điểm** mở menu từ danh sách Đã lưu và tin tương tự; mỗi cột thêm vào có nút bỏ có nhãn.
- **Hàng:** sinh từ cùng danh sách chỉ số của tab Chỉ số, nên chỉ số mới tự có hàng so sánh. Hàng gom theo nhóm bằng dòng tiêu đề nhóm. Nhóm **Thông tin tin đăng** (giá chào, giá/m², diện tích, phòng ngủ, pháp lý do khai) chỉ nằm trong bảng so sánh, và chỉ có khi chủ thể là một tin; ở `/map` với điểm không phải tin thì bỏ nhóm này.
- **Cuộn:** bảng có `min-width` theo số cột, cuộn ngang trong khung bo góc, cột đầu dính trái, có `role="region"` và `tabindex="0"` để cuộn bằng bàn phím. Không bao giờ bóp cột đến mức chữ bị cắt.
- **Đánh dấu:** với số đo có chiều "thấp hơn là gần hơn" hoặc "cao hơn là nhiều hơn", ô nào độc nhất đạt giá trị tốt nhất giữa các địa điểm (không tính cột tham chiếu) có chữ nhỏ màu xanh "gần nhất", "nhiều nhất", "cao nhất". Hòa thì không đánh dấu. Số đo trung tính (cao độ, mật độ dân cư, ngập sông, giá) không đánh dấu.
- **Điều khiển:** "Chỉ hiện chỗ khác nhau" (ẩn hàng mà mọi địa điểm giống nhau), "Cột trung vị khu vực".
- **Ô thiếu dữ liệu:** hiện chữ xám theo loại ("Không thấy trong 500 m", "Chưa có dữ liệu", "—" với thuộc tính tin đăng ở cột tham chiếu), không để trống và không đưa số 0.
- **So sánh công bằng:** chỉ so các chỉ số cùng bán kính; hàng nào có bán kính riêng ghi dòng "trong 500 m" dưới nhãn.

### 8A.5. Hợp đồng dữ liệu

```
subjects: { id: { name, sub, ref? } }            // cột
groups:   [ { id, title, icon, intro, compareOnly?, listingOnly? } ]   // nhóm
metrics:  [ {
  id, g,                      // thuộc nhóm nào
  label, kind,                // "dist" | "count" | "num" | "text"
  unit?, dec?, radius?,       // đơn vị, số lẻ, bán kính áp dụng
  better,                     // "lower" | "higher" | null
  conf,                       // "cao" | "tb" | "thap"
  naShort,                    // chữ khi thiếu dữ liệu
  src, note?,                 // nguồn, ghi chú
  v: { [subjectId]: number | string | null }
} ]
```

**Thêm một thứ mới:**

| Muốn thêm | Làm gì | Bố cục |
| --- | --- | --- |
| Chỉ số mới (ví dụ ồn giao thông) | Thêm một phần tử vào `metrics`, gán `g` | Tự có hàng ở tab Chỉ số và So sánh |
| Nhóm mới (ví dụ Quy hoạch) | Thêm vào `groups` và gán `g` cho các chỉ số | Tự có một khối gập mở và một dòng tiêu đề nhóm |
| Địa điểm so sánh mới | Thêm vào `subjects` và điền `v` | Tự có cột, tối đa 4 địa điểm |
| Tab mới (ví dụ Lịch sử giá) | Thêm vào danh sách tab | Thanh tab cuộn ngang, tối đa 5 |
| KPI mới | Thêm một ô | Lưới tự xuống hàng |

Quy tắc mật độ: một nhóm tối đa 8 chỉ số nhìn thấy khi mở (quá thì tách nhóm hoặc gập "Xem thêm"); tối đa 6 nhóm; tab So sánh tối đa 4 địa điểm.

### 8A.6. Tích hợp ở `/map`

- Component nằm trong thân cuộn của panel chi tiết (`map-place-detail.tsx`), dưới thẻ tóm tắt địa điểm (ảnh nhỏ, giá, tiêu đề, địa chỉ, 2–3 chip) và nút "Xem trang tin đầy đủ". Chế độ này bỏ khung ngoài (viền, nền, đệm của thẻ) để không có hai lớp thẻ lồng nhau.
- Thanh tab dính đầu vùng cuộn của panel nên người dùng đổi tab được khi đã cuộn sâu.
- Khi có kết quả, bản đồ phía sau vẽ vòng 500 m và điểm tiện ích, cùng quy tắc với trang chi tiết.
- Với một điểm không phải tin (chọn từ tìm địa chỉ hoặc ghim tự do): dòng chủ thể đổi thành "Quanh điểm đã chọn", cột đầu của bảng so sánh là "Điểm đã chọn", và nhóm Thông tin tin đăng ẩn.
- Phím `Esc` đóng panel và trả focus về điểm đã chọn; kết quả giữ trong lịch sử.
- Cùng một trạng thái phân tích, cùng hạn mức, cùng kết quả cache theo tọa độ: mở lại ở `/map` hay ở trang tin không tính thêm lượt.

### 8A.7. Trạng thái

Chưa chạy, đang chạy (có Hủy), thành công, một phần (ví dụ thiếu không khí: ô ghi "Chưa có dữ liệu", chip độ tin cậy thấp, dòng trong danh sách "cần kiểm tra"), lỗi (không trừ lượt), hết lượt, không đủ điều kiện (vô hiệu kèm lý do). Mọi trạng thái dùng cùng khung đầu; chỉ phần thân đổi.

### 8A.8. Truy cập

Tab theo mẫu WAI-ARIA (`tablist`, `tab`, `tabpanel`, `aria-selected`, roving `tabindex`); bảng so sánh dùng `th scope`; thanh khoảng cách và thanh mức phủ có mô tả bằng chữ; kết quả xuất hiện trong vùng `aria-live`; mọi nút ≥ 44 px; không chỉ dùng màu để truyền "gần nhất" hay độ tin cậy.

---

## 9. Link liên quan

Khối danh sách link (không phải bài viết) giúp người dùng đi tiếp mà không phải quay lại tìm. Chia hai loại, luôn phân biệt bằng nhãn và biểu tượng.

### Loại link

| Loại | Ví dụ | Nguồn | Hiển thị |
| --- | --- | --- | --- |
| Trong app (`internal`) | Xem trên bản đồ lớn; Các tin khác trong dự án/ngõ này; Nhà đất tại quận Đống Đa; Báo cáo phân tích đã có của vị trí này; Trang khu vực/phường | Hệ thống tự sinh | Link cùng tab; không có biểu tượng ngoài |
| Ngoài app (`external`) | Website dự án / chủ đầu tư; Trang quy hoạch chính thức; Trang thông tin phường | Người đăng nhập (MD) + danh mục tin cậy do Địa Thế thêm sẵn theo khu vực | Biểu tượng "mở ngoài", hiện tên miền, `target="_blank"`, `rel="noopener noreferrer nofollow ugc"` |

### Quy tắc

- Tối đa **5 link hiện sẵn**, còn lại gập sau "Xem thêm {n}". Mỗi link: nhãn rõ (động từ + đích đến) + dòng phụ (tên miền hoặc "Trong Địa Thế").
- Người đăng chỉ thêm tối đa 3 link ngoài; hệ thống kiểm tra là `https`, không rút gọn link, không nằm trong danh sách chặn (cá cược, cờ bạc, tín dụng đen, mạo danh); link bị báo cáo thì ẩn.
- Link ngoài **không phải bài viết**. Mọi nội dung bài viết hiển thị ở mục 10 phải là bài tạo trong chính Địa Thế.
- Link ngoài không dẫn về trang môi giới khác nhằm kéo khách; từ chối khi người đăng dùng link làm kênh quảng bá không liên quan căn đang rao (theo chính sách nội dung bị cấm).
- Khối ẩn hoàn toàn nếu không có link nào. Không hiện khung rỗng.

### Dữ liệu

```
relatedLink: { id, label, href, kind: "internal" | "external", note?, order }
```

---

## 10. Bài viết liên quan (bài trong app)

Chỉ lấy **bài viết được tạo và lưu trong Địa Thế** (cùng nơi với trang `Bài viết`, ví dụ `/bai-viet/{slug}`). Không liệt kê bài báo bên ngoài; link bên ngoài thuộc mục 9.

### Thẻ bài viết

Ảnh bìa (tỷ lệ 16:9, có `alt`), chủ đề (chip), tiêu đề (2 dòng tối đa), đoạn tóm tắt (2 dòng), thời gian đọc (`4 phút đọc`), ngày đăng. Cả thẻ là một link. Hiển thị 3 thẻ trên một hàng (desktop); trên mobile cuộn ngang, hiện một phần thẻ kế tiếp để người dùng biết còn nữa; có nút trước/sau có nhãn chữ cho người dùng bàn phím.

### Cách chọn bài

Xếp theo thứ tự ưu tiên, lấy tối đa 3:

1. Bài biên tập gắn thủ công vào tin hoặc vào dự án/khu vực (có `relatedPostIds`).
2. Bài cùng quận/phường (`tag khu vực`) với tin.
3. Bài cùng loại hình (`căn hộ`, `nhà phố`, `đất`…) hoặc cùng mục đích (mua/thuê).
4. Bài hướng dẫn chung về cách đọc một địa điểm ở Hà Nội, **gắn nhãn "Hướng dẫn chung"** để không bị hiểu là bài riêng cho khu vực này.

Mỗi bài chỉ xuất hiện một lần. Nếu không có bài nào ở cả bốn bước, **ẩn khối**, không nhét bài ngẫu nhiên.

### Chủ đề nên có sẵn cho trang chi tiết (nội dung để viết)

- Cách đọc kết quả phân tích vị trí (tiện ích, ngập sông, không khí).
- Kiểm tra pháp lý trước khi đặt cọc.
- Cách đọc một tin đăng và hỏi người đăng những gì.
- Giá chào khác giá thị trường ở chỗ nào.

### Tiêu đề khối

`Bài viết liên quan` kèm link `Xem tất cả bài viết` đến `/bai-viet`. Không đánh số lượng nếu chỉ có 1 bài (hiện một thẻ rộng).

---

## 11. Các trạng thái của trang

| Tình huống | Hành vi |
| --- | --- |
| Đang tải | Khung xương (skeleton) cùng bố cục; ảnh bìa giữ tỉ lệ; không dùng spinner toàn trang |
| Tin hợp lệ | Như mô tả |
| Tin không tồn tại / slug sai | Trang 404 tiếng Việt, gợi ý quay về `/nha-dat`, ô tìm kiếm |
| Tin hết hạn / đã giao dịch / đã gỡ | Vẫn trả trang với banner đầu trang *"Tin này đã ngừng rao"* (chọn đúng lý do), **ẩn nút Gọi/Zalo/Hiện số**, giữ gallery, mô tả, bản đồ (nếu phù hợp), và hiện tin tương tự; thêm `noindex` cho tin đã gỡ vì vi phạm |
| Tin đang chờ duyệt (chủ tin xem) | Banner "Chỉ bạn nhìn thấy" kèm nút Sửa tin |
| Thiếu ảnh | Khung ảnh có biểu tượng ảnh, không để ô trống; tin bắt buộc có ít nhất 1 ảnh nên trường hợp này chỉ xảy ra khi tệp lỗi |
| Thiếu tọa độ | Xem mục 7 |
| Mất mạng (PWA) | Hiện phần đã cache (chữ, ảnh đã xem), bản đồ và phân tích hiện "Cần kết nối mạng" |
| Lỗi tải một khối | Chỉ khối đó báo lỗi và có nút "Thử lại"; các khối khác vẫn dùng được |
| Người dùng chưa đăng nhập | Xem được tất cả; `Lưu`, `Phân tích`, `Báo cáo` yêu cầu đăng nhập hoặc xác minh rồi quay lại đúng tin |
| Chế độ tối | Theo token hiện có nếu app hỗ trợ; ảnh không đảo màu |

---

## 12. Pháp lý và trung thực nội dung

- Thông tin trên trang là do người đăng cung cấp; câu lưu ý đặt ở thẻ liên hệ và khối pháp lý (mục 5.4 và 6.6).
- Không dùng từ "đã kiểm duyệt", "đã xác minh", "chính chủ" trừ khi quy trình xác minh thật tồn tại và được mô tả ở Quy chế đăng tin.
- Nút Gọi/Zalo là link mở ứng dụng; không đo hay ghi nội dung cuộc gọi. Số lần bấm "Hiện số" chỉ ghi dạng đếm ẩn danh.
- Nếu sau này thêm **hỏi đáp công khai, bình luận, đặt lịch xem nhà, form để lại liên hệ**, cần đánh giá lại ranh giới "công cụ đăng tin" theo `005-legal/README.md` trước khi làm.
- Ảnh người đăng tải lên chịu chính sách bản quyền; thẻ liên hệ có "Báo cáo tin" dẫn tới quy trình gỡ.
- Bản đồ ghi nguồn OpenStreetMap; phần phân tích ghi nguồn theo `000-ideas/nguon-du-lieu.md` (ODbL, CC BY…).

---

## 13. Hành vi và hiệu năng

- Nội dung chính (tiêu đề, giá, mô tả, đặc điểm) dựng ở server để SEO và chia sẻ; bản đồ và khối phân tích là client, tải **sau** khi trang hiển thị (lazy), nhưng không gọi API phân tích.
- Gallery và bản đồ không làm trượt bố cục (đặt trước kích thước).
- `Lưu`: bấm đổi trạng thái ngay (lạc quan), hoàn lại nếu lỗi; đồng bộ với `/app/da-luu`.
- SEO: `<title>` dạng `Nhà phố 4 tầng ngõ Văn Miếu — 12,6 tỷ · 48 m² | Địa Thế`; `description` 150–160 ký tự từ thông số; canonical; JSON-LD cho tin (loại tin, giá, địa chỉ, ảnh); breadcrumb có dữ liệu có cấu trúc; thêm vào `sitemap.ts` các tin đang rao.
- Phần cuối trang: 4 thẻ tin tương tự, lấy cùng quận + cùng mục đích + cùng loại, giá trong khoảng ±40%. Tùy chọn (MD); ẩn nếu ít hơn 2 tin.

---

## 14. Truy cập và đa thiết bị

- Một `h1` duy nhất, các khối là `h2`; vùng ngữ nghĩa `main`, `aside` (thẻ liên hệ), `nav` (breadcrumb).
- Tương phản chữ ≥ 4,5:1; thành phần giao diện ≥ 3:1; vùng chạm ≥ 44 px; focus nhìn thấy được.
- Mọi biểu tượng đi kèm nhãn chữ hoặc `aria-label`; không dùng màu làm kênh duy nhất để truyền tình trạng pháp lý.
- Gallery, lightbox, bản đồ, nút phân tích, hộp thoại báo cáo đều dùng được bằng bàn phím; kết quả phân tích dùng `aria-live="polite"` khi xuất hiện.
- Không tự chạy carousel; chữ co giãn đến 200%.
- Định dạng: `12,6 tỷ`, `48 m²`, `23/10/2026`, dùng `vi-VN`.
- Kiểm tra ở 390, 768, 1024, 1440 px.

---

## 15. Tiêu chí hoàn thành

- [ ] Mọi trường BB đều xuất hiện đúng chỗ; trường MD không có dữ liệu thì không để lại dòng trống hoặc "Đang cập nhật".
- [ ] Giá, diện tích, pháp lý và nút Gọi nhìn thấy được trên màn hình đầu tiên ở 1440 và 390 px.
- [ ] Bản đồ ghim đúng tọa độ; mức xấp xỉ hiển thị vòng tròn thay vì ghim; không có lớp tiện ích trước khi phân tích.
- [ ] Mở trang không tạo yêu cầu phân tích nào (kiểm bằng tab Network); chỉ bấm mới gửi.
- [ ] Nút phân tích có đủ trạng thái: chưa chạy, đang chạy, thành công, một phần, lỗi, hết hạn mức, vô hiệu có lý do.
- [ ] Link liên quan phân biệt rõ trong app và ngoài app; link ngoài có `rel` đúng.
- [ ] Bài viết liên quan chỉ gồm bài trong app; không có bài thì khối ẩn.
- [ ] Có câu miễn trừ về pháp lý/ranh giới "không phải sàn giao dịch".
- [ ] Đủ trạng thái: tải, 404, hết hạn/đã gỡ, thiếu tọa độ, mất mạng, lỗi khối.
- [ ] Không có nhãn "hot", "đã xác minh", lời hứa phản hồi hay khan hiếm giả.
- [ ] Đạt các mục ở mục 14.

---

## 16. Giả định và mục mở

| # | Điều cần chốt | Ảnh hưởng |
| --- | --- | --- |
| 1 | Kiểu `Listing` hiện chỉ có `title`, `location`, `district`, `purpose`, `kind`, `priceVnd`, `areaM2`, `beds`, `living`, `baths`, `updatedAt`, `images`. Cần mở rộng cho các trường ở mục 5 (tọa độ, mức chính xác, pháp lý, liên hệ, người đăng, link, thẻ chủ đề) | Thiết kế dữ liệu/backend |
| 2 | Ảnh mẫu dùng chung ba ảnh `temp-002..004.jpg`. Cần ảnh thật, nhãn bản quyền trong `CREDITS.md`, hoặc nhãn "ảnh minh họa" | Hình ảnh |
| 3 | Công cụ bản đồ chính thức (hiện `website` chưa có MapLibre trong `package.json`, prototype dùng Leaflet) | Mục 7 |
| 4 | Hạn mức phân tích theo người dùng, theo ngày hay theo gói | Văn bản ở mục 8.1 và 8.3 |
| 5 | Có cho phép người đăng thêm link ngoài ngay từ đầu hay chỉ danh mục do Địa Thế thêm | Mục 9 |
| 6 | Đã có bài viết nào trong app để ghép chưa (`/app/blogs` hiện trống); nếu chưa, khối ở mục 10 ẩn cho đến khi có | Mục 10 |
| 7 | Có hiển thị lượt xem hay không (khuyến nghị: không, cho đến khi số liệu đủ ý nghĩa) | Mục 5.7 |
| 8 | Chính sách hiển thị số nhà chính xác hay chỉ ngõ/đường (riêng tư của chủ nhà) | Mục 5.2 và 7 |
