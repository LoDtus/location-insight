# Location Insight

Công cụ web và PWA giúp người dùng ở Hà Nội đưa một điểm trên bản đồ, rồi xem điểm mạnh và điểm yếu của vị trí đó. Hệ thống trình bày hết những gì đo được, kèm nguồn và mức tin cậy, và nói thẳng những gì chưa có dữ liệu.

Định giá là lớp thứ hai. Chỉ chạy khi người dùng khai thêm thuộc tính của chính ô đất (diện tích, mặt tiền, ngõ, số tầng, view, pháp lý). Đầu ra là một khoảng giá kèm giả định, không phải một con số giá bán.

## Người dùng làm gì

1. Nhập địa chỉ hoặc ghim tọa độ.
2. Kéo ghim cho đúng ô đất. Địa chỉ qua bộ geocode có thể lệch vài chục đến vài trăm mét, nhất là ngõ nhỏ. Phân tích bám ghim, không bám chuỗi địa chỉ.
3. Nhận báo cáo vị trí: các chỉ số đã tính, điểm mạnh, điểm yếu, phần còn thiếu.
4. Nếu muốn ước lượng giá, khai thêm thuộc tính ô đất. Thiếu mặt tiền hoặc pháp lý thì khoảng giá phải rộng ra, hoặc hệ thống từ chối kết luận giá.

## Hai lớp bài toán

**Phân tích vị trí** là tính chất của chỗ đất. Làm được với dữ liệu mở, trong ngân sách giai đoạn đầu.

**Định giá** là tính chất của từng ô đất và từng căn. Không suy ra từ mỗi địa chỉ. Giá giao dịch thật gần như không công khai. Giá rao trên các trang nhà đất là giá chào. Bảng giá đất của UBND là giá nhà nước để tính thuế, dùng làm mốc sàn, không phải giá bán.

| Lớp | Đầu vào | Đầu ra giai đoạn đầu |
| --- | --- | --- |
| Vị trí | Ghim trên bản đồ | Khoảng cách, mật độ, địa hình, tiện ích, nhận xét bám số |
| Giá | Ghim + thuộc tính người dùng tự khai | Khoảng giá tham chiếu, ghi rõ giả định và mục còn trống |

## Nguyên tắc

- Máy tính số và máy viết chữ tách nhau. Mọi khoảng cách, điểm số và so sánh ra từ truy vấn không gian. Model ngôn ngữ chỉ đọc JSON đã tính sẵn rồi viết nhận xét tiếng Việt khoảng 150–300 chữ.
- Model không được bịa số nằm ngoài JSON. Thiếu dữ liệu thì ghi thiếu.
- “Càng đủ càng tốt” nghĩa là càng có bằng chứng thì càng hiện, mỗi ý kèm nguồn và độ tin cậy. Không nhồi mọi lớp dữ liệu vào một đoạn văn.
- Mỗi chỉ số cần một bán kính và một cách tính cố định trước khi viết nhận xét. Ví dụ 500 m cho tiện ích đi bộ, 2 km cho bệnh viện và metro. Không có thước này thì hai lần phân tích cùng một điểm không so được.
- Cache kết quả theo geohash. Giới hạn số lượt phân tích mỗi người dùng mỗi ngày.
- Tên model để trong biến cấu hình, gọi qua một lớp duy nhất.

## Phạm vi giai đoạn đầu

- Chỉ Hà Nội. Dữ liệu cả nước không vừa gói cơ sở dữ liệu miễn phí, và quy hoạch đổi nhanh.
- Ngân sách dịch vụ trả phí dưới khoảng 1 triệu đồng/tháng.
- Không phụ thuộc Google Maps.
- Có: ghim vị trí, bản đồ, các lớp đo được bên dưới, nhận xét bám số, khung giá chỉ mang tính tham chiếu khi người dùng khai thêm thuộc tính.
- Chưa có: giá thị trường thương mại, lớp quy hoạch chính thức theo thửa.

## Dữ liệu phân tích vị trí

| Lớp | Nguồn | Ghi chú |
| --- | --- | --- |
| Đường, tiện ích, công trình | OpenStreetMap, truy vấn bằng PostGIS | Hà Nội thiếu và lệch. Phải ghi mức phủ, không chấm điểm như thể bản đồ đã đủ |
| Dân số | WorldPop | Độ phân giải thô, chỉ để so tương đối giữa các khu |
| Không khí | OpenAQ | Trạm đo thưa |
| Địa hình | Mô hình số độ cao (DEM) | Manh mối ngập, không phải bản đồ ngập chính thức |
| Mảng xanh, gần đường cao tốc hoặc sân bay | OpenStreetMap | Dấu hiệu ồn và tiện ích, không phải đo tiếng ồn |

Quy hoạch không nằm trong các lớp trên. OpenStreetMap không có đồ án đang duyệt. Khi chưa có lớp chính thức, báo cáo ghi “chưa có dữ liệu quy hoạch”.

Cổng thử nghiệm của thành phố là [quyhoach.hanoi.gov.vn](https://quyhoach.hanoi.gov.vn/). Chưa có API công khai để gọi theo tọa độ. Dữ liệu quy hoạch theo thửa (QHC, 1/2000, 1/500) là sản phẩm hợp đồng riêng, ngoài ngân sách giai đoạn này.

## Bản đồ

Bản đồ nền và bản đồ quy hoạch là hai việc khác nhau. Các API bản đồ cập nhật khi đường đã có trên thực địa. Một tuyến vừa phê duyệt, chưa thi công, không xuất hiện ở đây.

| Việc | Lựa chọn | Lý do |
| --- | --- | --- |
| Nền bản đồ để kéo ghim | MapLibre + tile OpenStreetMap | 0 đồng. Phân tích không chạy trên tile |
| Ô tìm địa chỉ | Thử Vietmap và Goong trên khoảng 20 địa chỉ Hà Nội trước khi trả tiền | Xem bên nào ra đúng điểm ở nội thành, ngõ, khu mới, phường đã đổi tên sau tháng 7/2025 |
| Khi đã trả tiền cho ô tìm | Vietmap nếu cần hẻm, số nhà, địa chỉ cũ và mới | Họ tự khảo sát, công bố cập nhật hàng tuần. Mức vào khoảng 50 đồng/transaction dưới 500.000 transaction/tháng. Geocode = 1 transaction |
| Prototype chưa có người dùng | Goong trong hạn mức key miễn phí | Tài liệu key: khoảng 1.000 request REST/ngày và khoảng 1.000 lượt tải bản đồ/tháng. Geocode trả phí khoảng 3,5 USD/1.000 lượt. Rời hạn mức miễn phí thì nạp trước từ 2 triệu, trừ theo thực dùng |
| Khớp hệ tọa độ hồ sơ (VN2000) | Map4D khi cần, không phải lựa chọn mặc định | Geocode khoảng 47 đồng/lượt, bản đồ 2D web khoảng 40 đồng/lượt ở mức dưới 500.000 request (bảng từ 01/06/2025) |

Gợi ý từng phím gõ đắt hơn chính lượt geocode. Gộp một phiên gõ, chỉ geocode một lần khi người dùng chọn xong. Tile trả phí chỉ đáng tiền khi ô tìm địa chỉ lệch rõ so với nền miễn phí.

Giá lấy từ bảng công khai của từng bên và cần mở lại trước khi chốt. Goong tính USD, tỷ giá theo Vietcombank tại lúc thanh toán.

## Model viết nhận xét

Việc của model là đọc JSON đã tính sẵn. Không cần model lớn.

Ưu tiên Gemini Flash-Lite. So với Gemini Flash và Claude Haiku trên cùng một bộ khoảng 20 địa chỉ Hà Nội trước khi khóa. Chấm bốn tiêu chí: không bịa số ngoài JSON, đúng schema, tiếng Việt tự nhiên, nói rõ khi thiếu dữ liệu. Tiêu chí đầu quan trọng nhất. Chọn model rẻ nhất đạt cả bốn.

Ước lượng với khoảng 1.500 token vào và 500 token ra: Flash-Lite cỡ vài chục đồng mỗi lượt, Flash cỡ 150 đồng. 1.000 lượt Flash-Lite khoảng 45.000 đồng, trước cache. Free tier chỉ dùng lúc phát triển với địa chỉ mẫu. Có người dùng thật thì chuyển gói trả phí, vì free tier có thể dùng dữ liệu để cải thiện sản phẩm. Đặt hạn mức chi tiêu ở nhà cung cấp.

## Chi phí hạ tầng tham khảo

Ước tính, chưa phải báo giá. Tỷ giá tạm tính khoảng 26.000 đồng/USD.

| Hạng mục | Phát triển | Vài nghìn lượt/tháng |
| --- | --- | --- |
| Tên miền | ~25.000 đồng/tháng | ~25.000 đồng |
| Web/PWA (Cloudflare Pages hoặc Workers) | 0 đồng | 0 đồng |
| PostGIS (Neon/Supabase free, hoặc VPS) | 0 đồng | 0 đồng nếu còn gói free, hoặc VPS khoảng 100.000–200.000 đồng |
| Tile bản đồ | 0 đồng | 0 đồng |
| Geocode | 0 đồng trong hạn mức | 0 đồng hoặc theo transaction nếu vượt hạn mức |
| OSM, WorldPop, OpenAQ, DEM | 0 đồng | 0 đồng |
| Model viết nhận xét | 0–20.000 đồng | khoảng 50.000–450.000 đồng tùy số lượt và model |
| Tổng | khoảng 50.000–150.000 đồng | khoảng 300.000–700.000 đồng |

Chỉ nhập dữ liệu Hà Nội. Gói free của cơ sở dữ liệu có thể tạm dừng khi không dùng, chấp nhận được lúc thử, chậm với người dùng thật.

## Ngoài phạm vi giai đoạn này

- Giá giao dịch thị trường và dữ liệu thương mại các sàn nhà đất.
- Kết luận một mức giá duy nhất từ mỗi địa chỉ.
- Lớp quy hoạch chính thức theo thửa, cho đến khi có API và giá nằm trong ngân sách.
- Phạm vi ngoài Hà Nội.
- Tự host model.

## Trạng thái repo

`website/` là ứng dụng Next.js. Phần phân tích không gian, geocode và nhận xét chưa được xây.

## Việc nên làm tiếp

Chốt danh sách chỉ số giai đoạn 1. Mỗi chỉ số gồm nguồn, bán kính, cách tính, và câu người dùng đọc được khi dữ liệu thiếu.
