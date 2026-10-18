# Nguồn dữ liệu theo tiêu chí

File này đi cùng [tieu-chi.md](tieu-chi.md). Mỗi tiêu chí có một hoặc nhiều nguồn. Ghép lại rồi bỏ trùng để lớp điểm dày hơn. Không có nguồn nào vừa sống, vừa đủ, vừa chuẩn cho mọi tiêu chí. Chỗ dữ liệu chỉ đổi vài năm một lần được ghi thẳng là bản tĩnh.

Giá và điều khoản lấy từ trang công khai lúc khảo sát. Mở lại trước khi thu thập.

## Cách ghép

Giữ mỗi nguồn một bảng riêng trong PostGIS, cùng các cột: tên, loại, tọa độ, địa chỉ, ngày lấy, độ tin tọa độ, mã nguồn.

Khi đếm quanh ghim, gộp theo quy tắc:

1. Cùng loại và hai điểm cách nhau dưới 40 m thì tính là một chỗ. Giữ điểm có tọa độ đo được. Điểm chỉ có địa chỉ chữ, đã geocode, để mức tin thấp.
2. Khớp tên sau khi bỏ dấu, viết thường, và bỏ tiền tố như “nhà thuốc”, “chợ”, “trường”.
3. Một chỗ xuất hiện ở hai nguồn thì tăng độ tin, không tăng số đếm.
4. Nguồn chuẩn nhưng không có tọa độ (danh sách sở) dùng để biết OSM đang thiếu tên nào. Chỉ đưa vào khoảng cách sau khi geocode và người dùng có thể thấy cờ “tọa độ suy ra từ địa chỉ”.
5. Mỗi chỉ số kèm số chỗ và ngày cũ nhất trong các nguồn vừa dùng.

Thu thập trang công khai thì được: không đăng nhập, không lấy số điện thoại hay tên cá nhân, cách vài giây một request, lưu ngày lấy, dừng khi trang chặn. Không thu Google Maps. API Google bị hạn chế tại Việt Nam, điều khoản cấm lấy hàng loạt, và dữ liệu dễ gãy.

Đăng ký kinh doanh không nằm trong các nguồn dưới. Địa chỉ trụ sở không phải cửa hàng đang mở.

## Tiện ích trong 500 m

Ba lớp dùng chung cho mọi mục dưới, rồi thêm nguồn riêng của từng loại.

| Lớp nền | Tần suất | Giá | Vai trò |
| --- | --- | --- | --- |
| OpenStreetMap, file ngày tại [Geofabrik Việt Nam](https://download.geofabrik.de/asia/vietnam.html) | Mỗi ngày | Miễn phí, ghi nguồn, ODbL | Tọa độ và loại chỗ. Lớp khoảng cách chính |
| [Overture Places](https://docs.overturemaps.org/guides/places/) | Theo đợt phát hành, thường mỗi tháng | Miễn phí, CDLA Permissive 2.0 | Thêm cửa hàng OSM chưa vẽ. Giữ bảng riêng, không trộn vào file OSM |
| Trang hệ thống cửa hàng của từng chuỗi | Tuần hoặc tháng, tùy chuỗi | Miễn phí nếu tự đọc trang | Điểm có địa chỉ mới. Geocode một lần, cập nhật khi chuỗi thêm cửa |

### Chợ

| Nguồn | Sống đến mức nào | Ghi chú |
| --- | --- | --- |
| OSM `amenity=marketplace` | Ngày | Chợ cóc hay thiếu |
| File Excel Sở Công Thương, đăng lại tại [openscience.vn](https://openscience.vn/chi-tiet-du-lieu/du-lieu-ve-danh-sach-cac-cho-tren-dia-ban-thanh-pho-ha-noi-11740), gốc [data.hanoi.gov.vn](https://data.hanoi.gov.vn/) | Bản 18/06/2026, CC0 | Danh sách chuẩn tên chợ. Không có tọa độ. Đây là lớp đối soát, không phải lớp đo khoảng cách |

Ưu tiên: OSM để đo. Excel để biết chợ nào chưa có trên bản đồ, rồi geocode và gắn cờ.

### Hiệu thuốc

| Nguồn | Sống đến mức nào | Ghi chú |
| --- | --- | --- |
| OSM `amenity=pharmacy` | Ngày | Nội thành dày hơn ngoại thành |
| Overture Places | Tháng | Bù cửa hàng chuỗi và nhà thuốc nhỏ |
| [Cổng tra cứu Sở Y tế](https://suckhoethudo.vn/data-lookup), nhóm cơ sở bán lẻ thuốc, khoảng 1.062 bản ghi | Đồng bộ theo API quản lý dược của sở | Chuẩn pháp lý. Địa chỉ chữ, nhiều địa chỉ hành chính cũ |
| Trang cửa hàng [Long Châu Hà Nội](https://nhathuoclongchau.com.vn/he-thong-cua-hang/ha-noi) | Trang liệt kê khoảng 309 nhà thuốc | Chuỗi cập nhật khi mở cửa mới. Chỉ là một phần thị trường |
| Trang cửa hàng Pharmacity, An Khang | Theo đợt chuỗi cập nhật | Cùng vai trò với Long Châu |

Ưu tiên: gộp OSM, Overture và ba chuỗi. Danh sách sở dùng để nâng độ tin khi trùng tên, không đếm thêm nếu chưa có tọa độ chắc.

### Siêu thị và cửa hàng tiện lợi

Tách hai loại khi đếm. Siêu thị là `shop=supermarket`. Tiện lợi là Circle K, WinMart+, GS25, FamilyMart, BHX.

| Nguồn | Sống đến mức nào | Ghi chú |
| --- | --- | --- |
| OSM | Ngày | Hay gộp nhầm tiện lợi vào siêu thị. Lọc bằng tên và tag `shop=convenience` |
| Overture Places | Tháng | Mạnh ở chuỗi |
| Trang hệ thống WinMart, WinMart+, Co.opMart, Bách Hóa Xanh, Circle K, GS25, FamilyMart | Khi chuỗi sửa trang cửa hàng | Địa chỉ mới sau sáp nhập phường thường có trên chính trang chuỗi |

Không dùng các file PDF khuyến mãi ngân hàng làm nguồn. Đó là danh sách chiến dịch, thiếu cửa và không được cập nhật vì mục đích bản đồ.

### UBND

Sau tháng 7/2025 Hà Nội còn 126 xã, phường. Danh sách này đổi khi có nghị quyết, không đổi mỗi tuần.

| Nguồn | Sống đến mức nào | Ghi chú |
| --- | --- | --- |
| Nghị quyết sắp xếp đơn vị hành chính, rồi geocode trụ sở | Khi có đơn vị mới | Lớp chuẩn tên |
| OSM `amenity=townhall` | Ngày | Hay còn tên phường cũ hoặc thiếu trụ sở mới |
| Trang [hanoi.gov.vn](https://hanoi.gov.vn/) và trang từng phường | Khi phường đổi trụ sở | Địa chỉ chữ |

Ghép theo tên đơn vị mới. Một phường một điểm. Trụ sở cũ trên OSM cách điểm mới hơn 40 m thì bỏ, không đếm hai lần.

### Cửa hàng vật tư

Không có danh sách sở nào đủ và sống. Chợ vật liệu xây dựng lớn thì nằm ở mục chợ.

| Nguồn | Sống đến mức nào | Ghi chú |
| --- | --- | --- |
| OSM `shop=doityourself`, `shop=hardware` | Ngày | Rất thưa |
| Overture Places, lọc ngành xây dựng và đồ nghề | Tháng | Nguồn bù chính |
| Trang chuỗi lớn nếu có trang cửa hàng (khu vực kho, cửa hàng gạch, sơn) | Theo chuỗi | Chỉ phủ một phần |

Báo cáo mục này luôn kèm câu phủ yếu. Không suy ra “không có cửa hàng” khi đếm bằng 0.

### Quán ăn và cà phê

| Nguồn | Sống đến mức nào | Ghi chú |
| --- | --- | --- |
| OSM `restaurant`, `cafe`, `fast_food` | Ngày | Thiếu quán nhỏ, quán mới |
| Overture Places | Tháng | Dày hơn ở quán có trang mạng |
| [Foody](https://www.foody.vn/) khu vực Hà Nội | Quán mới và quán đóng xuất hiện theo đợt người dùng sửa | Có tọa độ, loại quán, trạng thái mở. Đọc trang công khai, không lấy số điện thoại. Tôn trọng điều khoản Foody |

Ba nguồn này trùng nhiều. Quy tắc 40 m là bắt buộc, nếu không một quán sẽ thành ba.

Không tách quán ăn sáng. Foody có giờ mở cửa thì chỉ lưu thêm, chưa dùng làm tiêu chí riêng.

### Công viên

| Nguồn | Sống đến mức nào | Ghi chú |
| --- | --- | --- |
| OSM `leisure=park` | Ngày | Công viên có tên. Đây là lớp “còn bao xa tới công viên” |
| Tỷ lệ cây trong 300 m | Xem mục mảng xanh | Một khu nhiều cây nhưng không có công viên vẫn có số |

Chưa thấy danh sách công viên thành phố dạng API. Không thu bài viết du lịch để đếm công viên.

### Trường học

Bỏ nhãn “trường tốt”. Chỉ khoảng cách và cấp.

| Nguồn | Sống đến mức nào | Ghi chú |
| --- | --- | --- |
| OSM `amenity=school`, `kindergarten`, kèm `isced:level` nếu có | Ngày | Có tọa độ. Cấp học thường thiếu |
| [Danh sách đơn vị giáo dục](https://hanoi.edu.vn/DsDonViGiaoDuc) và [THPT công lập](https://hanoi.edu.vn/c3conglap.aspx) | Khi sở cập nhật năm học | Chuẩn tên và cấp. Nhiều dòng không có địa chỉ, chỉ có website trường |
| Overture Places | Tháng | Bù trường tư OSM chưa vẽ |

Ghép theo tên trường. Cấp học lấy từ danh sách sở khi khớp được tên. Tọa độ lấy từ OSM. Trường chỉ có tên thì chưa đưa vào khoảng cách.

### Khu văn phòng

| Nguồn | Sống đến mức nào | Ghi chú |
| --- | --- | --- |
| OSM `office=*` và `landuse=commercial` | Ngày | Lỗ nhiều. Chỉ là manh mối |
| Overture Places, loại văn phòng | Tháng | Tòa nhà cho thuê thường có mặt ở đây hơn OSM |

Không có sổ tòa nhà văn phòng mở, cập nhật theo quý, trong ngân sách này. Mục này không được viết thành “khu văn phòng” nếu chỉ thấy vài điểm.

### Bệnh viện

Bán kính báo cáo 2 km. Tách bệnh viện và phòng khám. Cổng sở có khoảng 9.500 cơ sở chữa bệnh. Đó là mọi phòng khám, không phải 9.500 bệnh viện.

| Nguồn | Sống đến mức nào | Ghi chú |
| --- | --- | --- |
| OSM `amenity=hospital` | Ngày | Lớp bệnh viện để đo khoảng cách |
| OSM `amenity=clinic` | Ngày | Phòng khám, hiện riêng, không cộng vào số bệnh viện |
| [Cơ sở chữa bệnh trên suckhoethudo.vn](https://suckhoethudo.vn/data-lookup) | Theo dữ liệu sở | Chuẩn tên. Địa chỉ chữ. Lọc dòng có chữ “bệnh viện” trước khi geocode |
| Overture Places | Tháng | Bù phòng khám tư |

## Đi lại và đường

### Đường lớn, cấp đường, bề rộng, vỉa hè

| Nguồn | Sống đến mức nào | Ghi chú |
| --- | --- | --- |
| OSM `highway`, `width`, `lanes`, `sidewalk` | Ngày | Nguồn duy nhất đủ rẻ cho hình học đường |
| Overture Transportation | Tháng | Đối soát đường chính. Nhiều đoạn lấy từ OSM, nên không đếm là nguồn độc lập hoàn toàn |
| Vietmap hoặc Goong | Tuần với Vietmap, theo hợp đồng | Chỉ khi OSM lệch rõ ở khu mới. Tốn tiền. Chưa cần cho bề rộng ngõ |

Vỉa hè chỉ hiện khi OSM có tag. Không có trang nào khác ghi vỉa hè từng đoạn phố dưới dạng dữ liệu mở.

Cấp đường gần nhất là đường OSM gần ghim, không phải mặt tiền. Không kết luận xe cứu hỏa vào được.

### Nội đô

Không cần nguồn ngoài. Mốc cố định Hồ Gươm, khoảng 21.0285, 105.8520. Đo khoảng cách trên PostGIS.

### Ga metro

Chỉ ga đang chạy. Đoạn ngầm Nhổn còn lại chưa khai thác thì không tính là ga đến được.

| Nguồn | Sống đến mức nào | Ghi chú |
| --- | --- | --- |
| [metrohanoi.vn](https://metrohanoi.vn/) sơ đồ ga tuyến 2A và tuyến 3 | Khi có ga mới mở | Danh sách chuẩn ga đang khai thác. Ít ga, geocode một lần rồi sửa tay khi khai trương |
| OSM `station=subway` | Ngày | Có tọa độ. Loại ga đang xây bằng cách đối với sơ đồ hãng |
| GTFS Hà Nội trên [BusMaps](https://busmaps.com/en/vietnam/The-World-Bank/hanoi-gtfs), bản 02/10/2026 | Khi có bản GTFS mới | Có subway và xe buýt. Không phải API của Hanoi Metro |

Danh sách ga ngắn. Nguồn trang hãng là chuẩn. OSM là tọa độ. GTFS để kiểm không thiếu ga.

### Điểm xe buýt

| Nguồn | Sống đến mức nào | Ghi chú |
| --- | --- | --- |
| [timbus.vn](http://www.timbus.vn/) | Lịch và điểm dừng theo khai thác. Trang có GPS xe, phần đó là sống theo phút | Lấy điểm dừng và tuyến. Không cần vị trí từng xe cho bài toán này |
| OSM `highway=bus_stop` | Ngày | Đối soát tọa độ |
| GTFS BusMaps | Bản 02/10/2026, lịch ghi đến 31/12/2027 | Tải một lần, so với timbus khi lệch |
| BusMap Hà Nội | Nhà phát hành ghi dữ liệu tới 13/11/2025 | Ứng dụng, không có API công khai. Không ưu tiên nếu timbus lấy được điểm dừng |

Ghép điểm dừng trong 30 m thành một cột chờ. Giữ mã tuyến từ timbus hoặc GTFS.

### Ồn giao thông

Không có bản đồ tiếng ồn sống và miễn phí. Chỉ hai khoảng cách, cùng nguồn đường ở trên:

- Tới `highway=motorway` hoặc `trunk` gần nhất.
- Tới sân bay Nội Bài, một điểm cố định trên OSM `aeroway=aerodrome`.

## Dân số, không khí, địa hình

### Mật độ dân cư

Không có lớp dân số sống theo tháng ở mức 100 m.

| Nguồn | Sống đến mức nào | Ghi chú |
| --- | --- | --- |
| [WorldPop](https://hub.worldpop.org/rest/data/pop/G2_CN_POP_R25A_100m?iso3=VNM) constrained 100 m, R2025A | Theo đợt, năm sau điều tra là dự báo | Số chính để so giữa các khu |
| [GHSL GHS-POP](https://human-settlement.emergency.copernicus.eu/datasets.php) R2023A, 100 m | Bản nhiều năm, không phải điều tra hàng năm | Chỉ để hạ độ tin khi lệch WorldPop. Không hiện hai số |

Tổng dân số trong vòng 500 m. Không gọi đây là mật độ từng ngõ.

### Không khí

| Nguồn | Sống đến mức nào | Ghi chú |
| --- | --- | --- |
| [moitruongthudo.vn](https://moitruongthudo.vn/) | Theo giờ, AQI kiểu Việt Nam | Trạm của thành phố. Trang công khai, chưa thấy API tài liệu. Ưu tiên vì đúng chuẩn địa phương |
| [OpenAQ v3](https://docs.openaq.org/api) | Theo nhịp trạm đẩy lên | Miễn phí, khoảng 60 request/phút. Có key. Gọi từ NestJS, cache vài giờ |
| [PAM Air](https://pamair.org/dich-vu-pamair/dich-vu-api/) | Khoảng 5 phút, lưới dày | Chưa có giá. Chỉ thêm khi OpenAQ và cổng thành phố quá thưa |
| [WAQI](https://aqicn.org/api/) | Phút đến giờ | Miễn phí trong hạn mức. Sản phẩm công khai vì lợi nhuận cần thỏa thuận trước. Chưa dùng |

Gắn số đo với khoảng cách tới trạm. Trạm xa hơn 3 km thì không gán cho ô đất. Khi cùng một trạm có ở hai nguồn, lấy bản moitruongthudo nếu có, không cộng hai chỉ số.

### Độ cao

Bản tĩnh. Mặt đất không có nguồn sống miễn phí ở mức từng ô nhà.

| Nguồn | Sống đến mức nào | Ghi chú |
| --- | --- | --- |
| [FABDEM Việt Nam V1-0](https://data.bris.ac.uk/data/dataset/20egxk888rljr25vst4u3nhnyz) | Công bố 2021, từ Copernicus DEM 2010–2018, CC BY 4.0 | Cao độ mặt đất khoảng 30 m, đã gỡ nhà và cây. Dùng bản này |
| Copernicus DEM GLO-30 | Cập nhật theo đợt vệ tinh, vẫn là năm chứ không phải tuần | Chỉ đối soát. FABDEM hợp hơn vì đã bỏ chiều cao nhà |

Không dùng FABDEM V1-2 toàn cầu: giấy phép có phần phi thương mại.

Hiện cao độ tại ghim và chênh so với trung vị 500 m. Không viết “dễ ngập” từ riêng số này.

### Ngập

Hai hiện tượng khác nhau. Giữ hai chỉ số, không gộp.

| Hiện tượng | Nguồn | Sống đến mức nào | Ghi chú |
| --- | --- | --- | --- |
| Ngập đường khi mưa | [thoatnuochanoi.vn/ungngap](https://thoatnuochanoi.vn/ungngap) và mini app Bản đồ mưa ngập trên iHanoi | Phút, khi có mưa. Số liệu trạm Công ty Thoát nước Hà Nội | Đúng câu người dân hỏi. Trang có bản đồ. Chưa có API công bố cho bên thứ ba. Đọc được thì lưu điểm, độ sâu, giờ đo |
| Ngập sông theo chu kỳ | [JRC Global River Flood Hazard](https://data.jrc.ec.europa.eu/dataset/jrc-floods-floodmapgl_rp50y-tif) | Bản mô hình, không đổi theo trận mưa | Độ sâu chu kỳ 10 năm và 100 năm. Không phải bản đồ ngập Hà Nội. Bỏ lưu vực nhỏ và ngập do cống |

Điểm úng ngập là sự kiện, không phải tính chất cố định của ô đất. Báo cáo nên nói “trong các lần quan trắc đã lưu, điểm gần nhất cách bao xa và sâu bao nhiêu”, kèm thời điểm. Chưa lưu đủ mùa mưa thì ghi chưa đủ chuỗi.

### Mảng xanh

| Nguồn | Sống đến mức nào | Ghi chú |
| --- | --- | --- |
| [Dynamic World](https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_DYNAMICWORLD_V1) | Ảnh Sentinel-2 mỗi 2–5 ngày khi ít mây | 10 m, có xác suất lớp cây. CC BY 4.0. Đọc qua Google Earth Engine: gói miễn phí dành cho nghiên cứu và phi lợi nhuận. Sản phẩm thương mại cần kiểm giấy phép Earth Engine trước khi gọi |
| [ESA WorldCover](https://esa-worldcover.org/) | Bản theo năm | 10 m. Dùng khi chưa có quyền Earth Engine. Ổn định hơn một ảnh vệ tinh đơn |

Tỷ lệ ô cây trong 300 m. Dynamic World lấy ảnh ít mây gần nhất, không lấy một cảnh mây. WorldCover là phương án dự phòng và để đối soát.

Công viên có tên vẫn lấy từ OSM, không suy từ pixel cây.

### Mức phủ

Không có nguồn ngoài. Đếm số chỗ sau khi đã ghép trong 500 m, chia theo loại. Số thấp nghĩa là báo cáo mỏng.

## Việc người dùng khai và mốc giá nhà nước

Các ô loại hình, pháp lý, diện tích, mặt tiền, tầng, view không có nguồn. Người dùng nhập.

Giá đang cân nhắc cũng do người dùng nhập. Giá mỗi đơn vị là phép chia.

Bảng giá đất nhà nước không sống theo tuần. Văn bản là Nghị quyết 52/2025/NQ-HĐND, áp dụng từ 01/01/2026, 18 phụ lục theo tên đường. Không có API. Chỉ là mốc sàn sau khi nhập tay. Chưa đưa vào báo cáo tự động vì khớp tên đường dễ sai.

Tin rao trên các trang nhà đất là giá chào, cập nhật hàng ngày, và nằm ngoài phạm vi đã chốt. Chưa thu.

## Lịch làm mới

| Nhịp | Việc |
| --- | --- |
| Vài giờ | Không khí. Điểm ngập khi mùa mưa, nếu đọc được trang thoát nước |
| Mỗi ngày | PBF OpenStreetMap vào PostGIS |
| Mỗi tuần | Trang chuỗi nhà thuốc, siêu thị. Foody cho quán ăn |
| Mỗi tháng | Overture Places. So GTFS với timbus.vn |
| Khi có văn bản hoặc năm học mới | Chợ Sở Công Thương, trường Sở Giáo dục, ga metro, bảng giá đất |
| Một lần, rồi giữ | FABDEM, JRC ngập sông, mốc Hồ Gươm và Nội Bài |
