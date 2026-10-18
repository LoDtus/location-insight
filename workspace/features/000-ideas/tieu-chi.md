# Tiêu chí phân tích

Bảng khảo sát cũ trộn ba việc: sổ thương vụ, thuộc tính ô đất do người khai, và chỉ số vị trí đo được từ một ghim. File này chốt việc nào làm trong giai đoạn đầu, đo bằng cách nào, và lấy dữ liệu ở đâu.

Nguyên tắc: chỉ hiện thứ đo được, kèm nguồn và mức phủ. Không thấy dữ liệu trong bán kính thì ghi thiếu. Không kết luận “khu này không có”.

Dữ liệu không gian tải một lần, cắt Hà Nội, đưa vào PostGIS. Mỗi lượt phân tích là truy vấn local. API bên ngoài chỉ dùng cho ô tìm địa chỉ và cho chỉ số không khí, vì không khí đổi theo giờ.

Giá và điều khoản dưới đây lấy từ trang công khai của từng nguồn tại thời điểm khảo sát. Mở lại trang gốc trước khi chốt, vì hạn mức và giấy phép đổi.

## Hệ thống tự tính từ ghim

### Tiện ích đi bộ, bán kính 500 m

Khoảng cách tới điểm gần nhất, và số điểm trong bán kính. Nguồn chính là OpenStreetMap. Overture Places dùng để đối chiếu khi OSM quá thưa.

| Tiêu chí | Thẻ cần tìm | Ghi chú |
| --- | --- | --- |
| Chợ | `amenity=marketplace` | Chợ cóc thường không được vẽ |
| Hiệu thuốc | `amenity=pharmacy` | Nội thành dày hơn ngoại thành |
| Siêu thị | `shop=supermarket` | Cửa hàng tiện lợi tách riêng, không gộp vào siêu thị |
| UBND | `amenity=townhall` | Không đủ mọi UBND phường |
| Cửa hàng vật tư | `shop=doityourself`, `shop=hardware` | Rất thưa. Luôn kèm câu phủ dữ liệu yếu |
| Quán ăn, cà phê | `amenity=restaurant`, `amenity=cafe`, `amenity=fast_food` | Đếm số điểm. Không tách được quán ăn sáng |
| Công viên | `leisure=park` | Công viên có tên. Tỷ lệ cây xem mục mảng xanh |
| Trường học | `amenity=school`, `amenity=kindergarten` | Chỉ khoảng cách và cấp nếu có `isced:level`. Bỏ nhãn “trường tốt” |

Khu văn phòng lấy `office=*` và `landuse=commercial` trong 500 m. Lớp này lỗ nhiều. Hiện là manh mối, không phải bản đồ khu văn phòng.

### Đi lại và đường

| Tiêu chí | Cách tính | Nguồn |
| --- | --- | --- |
| Đường lớn | Khoảng cách tới đường gần nhất thuộc `highway=motorway`, `trunk`, `primary`, `secondary` | OpenStreetMap |
| Cấp đường gần nhất | Loại đường gần ghim, cộng `width` hoặc `lanes` nếu có tag | OpenStreetMap |
| Vỉa hè | Chỉ hiện khi có tag `sidewalk`. Không có tag thì ghi không rõ | OpenStreetMap |
| Nội đô | Khoảng cách tới Hồ Gươm (khoảng 21.0285, 105.8520) | Mốc cố định trong cấu hình |
| Ga metro | Khoảng cách tới ga gần nhất, bán kính báo cáo 2 km vì mạng còn thưa | OSM `station=subway`, đối chiếu GTFS |
| Điểm xe buýt | Khoảng cách tới điểm dừng gần nhất trong 500 m | GTFS Hà Nội, đối chiếu OSM `highway=bus_stop` |
| Ồn giao thông | Khoảng cách tới `highway=motorway` hoặc `trunk`, và tới sân bay Nội Bài | OpenStreetMap |

Cấp đường gần nhất thay cho hai câu cũ “xe cứu hỏa có vào được không” và “đường trước cửa lưu thông thế nào”. Một ghim không biết mặt nào là mặt tiền, và OSM ít khi có bề rộng ngõ. Có `width` thì hiện số mét. Không có thì ghi không rõ, không kết luận xe cứu hỏa vào được.

Ồn chỉ là khoảng cách. Không có bản đồ tiếng ồn.

### Dân số, không khí, địa hình

| Tiêu chí | Cách tính | Nguồn | Giới hạn |
| --- | --- | --- | --- |
| Mật độ dân cư | Tổng dân số ước tính trong ô 500 m quanh ghim, để so giữa các khu | WorldPop 100 m. GHSL để đối chiếu | Không phải mật độ từng ngõ. Năm sau mốc điều tra là dự báo |
| Không khí | Giá trị trạm gần nhất và khoảng cách tới trạm. Trạm xa hơn 3 km thì không gán cho ô đất | OpenAQ | Trạm nhà nước thưa. Mạng cảm biến dày hơn là dịch vụ trả phí |
| Độ cao | Cao độ ô 30 m tại ghim, và chênh so với trung vị trong 500 m | FABDEM | Bản 2021, không theo công trình mới |
| Ngập sông | Độ sâu nước mô hình ở chu kỳ 10 năm và 100 năm, nếu ô đó nằm trong vệt ngập | JRC Global River Flood Hazard | Ngập sông lớn, không phải ngập đường sau mưa. Không phải bản đồ ngập của Hà Nội |
| Mảng xanh | Tỷ lệ ô đất phủ thực vật trong 300 m | ESA WorldCover 10 m | Không thay cho công viên có tên |
| Mức phủ | Số tiện ích OSM tìm thấy trong 500 m | Tự tính | Số thấp nghĩa là báo cáo mỏng, không phải khu trống |

Độ cao và ngập sông thay cho câu “dễ ngập?”. Báo cáo gọi đúng tên: cao độ tương đối, và độ sâu mô hình ngập sông. Không ghi “khu này dễ ngập” hay “không ngập”.

## Người dùng tự khai

Không suy ra từ tọa độ. Dùng khi ước lượng giá. Thiếu mặt tiền hoặc pháp lý thì khoảng giá nới rộng, hoặc không kết luận giá.

| Ô | Dùng để |
| --- | --- |
| Loại hình | Đất, nhà phố, căn hộ. Đổi loại thì đổi các ô phía dưới |
| Pháp lý | Sổ, hợp đồng, hoặc đang vướng quy hoạch |
| Diện tích (m2) | Mẫu số của giá mỗi đơn vị |
| Giá đang cân nhắc | Giá của tin người dùng đưa vào, không phải giá thị trường |
| Giá mỗi đơn vị | Giá chia diện tích. Hệ thống tính |
| Mặt tiền, chiều sâu, số mặt thoáng | Thay cho “hình dáng mảnh đất” |
| Tầng, hướng view | Chỉ với căn hộ |

Bảng giá đất nhà nước 2026 (Nghị quyết 52/2025/NQ-HĐND, áp dụng từ 01/01/2026, 18 phụ lục) là mốc sàn theo tuyến đường, không phải giá bán. Chưa có API. Muốn dùng thì nhập tay từ phụ lục của nghị quyết và khớp tên đường. Khớp tên đường Hà Nội sai nhiều, nên giai đoạn này chưa đưa vào báo cáo tự động.

## Ngoài phạm vi

| Tiêu chí cũ | Lý do |
| --- | --- |
| Chủ nhân, liên lạc, lý do bán, ghi chú | Sổ theo dõi một thương vụ, không phải phân tích vị trí |
| Ưu điểm, nhược điểm | Là kết quả báo cáo, không phải dữ liệu đầu vào |
| Trường tốt | Không có bảng xếp hạng mở đáng tin. Sau này người dùng có thể tự đánh dấu vài trường, hệ thống chỉ tính khoảng cách |
| Dân trí cao | Không có dữ liệu, và không dùng nhãn này trong báo cáo |
| Thân thiện hàng xóm, nhiều muỗi | Không có nguồn theo ô đất |
| Mức độ an ninh | Không có dữ liệu vụ việc công khai theo ô |
| Giá thị trường | Dữ liệu thương mại, ngoài ngân sách |
| Ranh thửa, hình dáng tự động | Cần bản đồ địa chính. Một ghim không đủ |
| Quy hoạch theo thửa | Cổng [quyhoach.hanoi.gov.vn](https://quyhoach.hanoi.gov.vn/) đang thử nghiệm, chưa có API theo tọa độ |
| Ngập úng nội thành sau mưa | Mô hình sông toàn cầu không mô phỏng cống và đường |

## Nguồn dữ liệu

Ưu tiên nguồn tải về được, miễn phí, và đủ mới để cắt riêng Hà Nội. API trả phí chỉ giữ cho việc đổi địa chỉ thành tọa độ.

### OpenStreetMap qua Geofabrik

- Việc: đường, tiện ích, trường, công viên, sông hồ, ga, vỉa hè, bề rộng nếu được tag.
- Tải: [download.geofabrik.de/asia/vietnam.html](https://download.geofabrik.de/asia/vietnam.html). File `vietnam-latest.osm.pbf` khoảng 315 MB, cập nhật mỗi ngày.
- Giá: miễn phí. Giấy phép ODbL, phải ghi nguồn OpenStreetMap.
- Cách dùng: cắt Hà Nội lúc nhập PostGIS. Đừng gọi Overpass cho mỗi lượt người dùng.
- Chất lượng: đường chính và nội thành dùng được. Ngõ, số nhà, vỉa hè, cửa hàng vật tư và UBND phường thiếu. Vì vậy mỗi chỉ số kèm số điểm tìm thấy.

### Overture Places

- Việc: đối chiếu mật độ tiện ích khi OSM thưa. Việt Nam có khoảng 1,5 triệu điểm trong bản phát hành hiện tại.
- Tải: GeoParquet trên Amazon S3 hoặc Azure, xem [docs.overturemaps.org](https://docs.overturemaps.org/guides/places/).
- Giá: miễn phí. Giấy phép CDLA Permissive 2.0. Bộ này không chứa dữ liệu OpenStreetMap.
- Cách dùng: giữ một lớp riêng. Trộn vào cơ sở OSM có thể kéo cả bản đồ sang ODbL. Giai đoạn đầu chỉ dùng để đếm, không thay khoảng cách chính nếu hai nguồn lệch.
- Chất lượng: nhiều điểm thương mại hơn OSM, nhưng danh mục và địa chỉ tiếng Việt không đồng đều. Không có bề rộng đường.

### WorldPop

- Việc: mật độ dân cư tương đối.
- Tải: REST `https://hub.worldpop.org/rest/data/pop/G2_CN_POP_R25A_100m?iso3=VNM`. Chọn bản constrained 100 m, dòng R2025A.
- Giá: miễn phí.
- Cách dùng: một raster cho Hà Nội. Tổng các ô trong vòng 500 m.
- Chất lượng: ô khoảng 100 m. Đủ để nói khu này đông hơn khu kia. Không đủ để nói ngõ này đông hơn ngõ bên.

### GHSL GHS-POP

- Việc: lớp dân số thứ hai để kiểm WorldPop khi hai bên lệch lớn.
- Tải: [human-settlement.emergency.copernicus.eu](https://human-settlement.emergency.copernicus.eu/datasets.php), GHS-POP R2023A, 100 m.
- Giá: miễn phí, ghi nguồn European Commission JRC.
- Cách dùng: không hiện hai số cho người dùng. Nếu lệch mạnh thì hạ độ tin cậy của mục dân số.

### OpenAQ

- Việc: PM2.5 và các chỉ số trạm quan trắc đưa lên mạng mở.
- API: `https://api.openaq.org/v3/`, cần header `X-API-Key`. Đăng ký tại [explore.openaq.org](https://explore.openaq.org).
- Giá: miễn phí, khoảng 60 request/phút và 2.000 request/giờ mỗi key.
- Cách dùng: NestJS gọi, lưu trạm và số đo vài giờ. Không gọi từ trình duyệt.
- Chất lượng: trạm chuẩn nhưng thưa. Gắn kèm khoảng cách. Trên 3 km thì bỏ chỉ số khỏi kết luận của ô đất.

### WAQI

- Việc: thêm trạm, trong đó có cảm biến cộng đồng.
- API: [aqicn.org/api](https://aqicn.org/api/), miễn phí trong hạn mức khoảng 1.000 request/phút, bắt buộc ghi nguồn.
- Điều khoản: dùng công khai cho tổ chức vì lợi nhuận cần thỏa thuận trước với World Air Quality Index. Vì vậy chưa đưa vào giai đoạn đầu.
- Khi nào dùng: sau khi có thỏa thuận, và chỉ để tăng số trạm, không thay OpenAQ.

### PAM Air

- Việc: lưới cảm biến PM2.5 dày ở Hà Nội, cập nhật khoảng 5 phút.
- API: có dịch vụ, chưa công bố giá. Liên hệ [pamair.org](https://pamair.org/dich-vu-pamair/dich-vu-api/).
- Khi nào dùng: nếu OpenAQ quá thưa khi thử trên bản đồ Hà Nội và giá API còn trong ngân sách dưới 1 triệu đồng/tháng.

### FABDEM

- Việc: cao độ mặt đất, đã gỡ chiều cao nhà và cây, khoảng 30 m.
- Tải: bản Việt Nam V1-0, [data.bris.ac.uk/data/dataset/20egxk888rljr25vst4u3nhnyz](https://data.bris.ac.uk/data/dataset/20egxk888rljr25vst4u3nhnyz), khoảng 917 MB, giấy phép CC BY 4.0. Cắt Hà Nội rồi bỏ phần còn lại.
- Nguồn gốc: Copernicus DEM giai đoạn 2010–2018, công bố 2021.
- Không dùng bản FABDEM V1-2 toàn cầu cho sản phẩm này: giấy phép có thành phần phi thương mại.
- Chất lượng: tốt cho “ô này thấp hơn xung quanh”. Không cập nhật theo san lấp mới.

### JRC Global River Flood Hazard

- Việc: độ sâu ngập dọc sông ở các chu kỳ lặp lại, từ 10 năm đến 500 năm.
- Tải: [data.jrc.ec.europa.eu/dataset/jrc-floods-floodmapgl_rp50y-tif](https://data.jrc.ec.europa.eu/dataset/jrc-floods-floodmapgl_rp50y-tif). Cắt Hà Nội.
- Giá: miễn phí, thuộc Copernicus Emergency Management Service.
- Giới hạn do chính bộ dữ liệu ghi: không phải bản đồ nguy cơ ngập chính thức. Bỏ qua lưu vực dưới 500 km2. Không mô phỏng ngập úng do mưa và cống ở nội thành.

### ESA WorldCover

- Việc: tỷ lệ thực vật trong 300 m.
- Tải: [esa-worldcover.org](https://esa-worldcover.org/), độ phân giải 10 m.
- Giá: miễn phí, ghi nguồn ESA.
- Cách dùng: bổ sung cho công viên OSM. Một khu nhiều cây nhưng không có công viên vẫn hiện tỷ lệ này.

### GTFS xe buýt và metro Hà Nội

- Việc: vị trí điểm dừng xe buýt và ga metro để đối chiếu với OSM.
- Bản đang dùng được: bộ GTFS đã chỉnh trên [busmaps.com/en/vietnam/The-World-Bank/hanoi-gtfs](https://busmaps.com/en/vietnam/The-World-Bank/hanoi-gtfs), cập nhật 02/10/2026, gồm xe buýt và subway, lịch chạy ghi đến 31/12/2027. Nguồn gốc là GTFS World Bank.
- Giá: miễn phí. Đây không phải API vận hành của Transerco hay Ban quản lý đường sắt đô thị.
- Danh mục tuyến trên [soxaydung.hanoi.gov.vn](https://soxaydung.hanoi.gov.vn/vi-vn/tin/du-lieu-mo/681729-712696-314575) cập nhật tới 15/07/2024, dạng văn bản, không phải tọa độ điểm dừng.
- Cách dùng: nhập điểm dừng vào PostGIS. OSM vẫn là lớp khoảng cách chính nếu GTFS cũ hơn một ga mới mở. Khi hai lớp lệch, ghi nguồn và ngày của lớp được chọn.

### Bảng giá đất nhà nước

- Văn bản: Nghị quyết 52/2025/NQ-HĐND của HĐND Hà Nội, áp dụng từ 01/01/2026.
- Dạng: phụ lục theo khu vực và tên đường, không có API.
- Ý nghĩa: giá tính thuế và nghĩa vụ tài chính, thấp hơn giá giao dịch. Chỉ là mốc sàn sau khi nhập tay và khớp được tên đường.

### Cổng dữ liệu mở của thành phố

- Trang: [hanoi.gov.vn/du-lieu-mo](https://hanoi.gov.vn/du-lieu-mo).
- Danh mục đã có nhóm giáo dục (trường, lớp, học sinh, giáo viên) và nhà ở, xây dựng. Chưa thấy endpoint trả về theo tọa độ.
- Quy hoạch ô đất vẫn ở cổng thử nghiệm riêng, chưa nối vào luồng phân tích.

### Geocode

Không phải lớp phân tích. Chỉ để đưa địa chỉ thành ghim, rồi người dùng kéo lại.

- Thử: Goong trong hạn mức key miễn phí, và Vietmap trong tháng dùng thử.
- Nền bản đồ: MapLibre với tile OpenStreetMap, 0 đồng.

## Thứ tự nhập dữ liệu

1. OpenStreetMap Hà Nội vào PostGIS: đường, tiện ích, sông hồ, công viên, ga.
2. WorldPop và FABDEM, cắt đúng khung Hà Nội.
3. GTFS, chỉ lấy điểm dừng.
4. JRC flood và WorldCover sau, vì đây là manh mối, không chặn bản báo cáo đầu.
5. OpenAQ khi đã có ghim thật để xem trạm có đủ dày không.
6. Overture Places chỉ khi đếm OSM trong 500 m quá thấp ở những khu đã biết là đông tiện ích.
