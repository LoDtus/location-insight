# Sổ tay thay đổi dữ liệu (018-location-data)

Mỗi tình huống ghi cách nhận biết, việc phải làm, chỗ dữ liệu đổi và kết quả cũ ra sao. Cột **GĐ** cho biết tình huống được hỗ trợ từ giai đoạn nào (research.md Bản ghi 11).

Năm quy tắc luôn đúng:

1. Không sửa đối tượng đã nhập, không sửa bảng kê hay snapshot tiêu chí của bản đã phát hành. Mọi thay đổi là một phiên bản mới.
2. Phát hành phải đi qua: phiên bản lớp `ready`, chạy script điểm mẫu, kiểm tra mức bản lúc bấm phát hành.
3. Kết quả đã lưu không tự đổi. Người dùng bấm "Đánh giá lại" thì mới dùng bản mới.
4. Thu hồi luôn tạo bản mới, không xóa lịch sử.
5. Không có khóa ngoại giữa `geo` và `public`. `/reset` không đụng `geo`.

## Bảng tình huống

| # | GĐ | Tình huống | Ví dụ | Làm gì | Chỗ đổi | Kết quả cũ |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 | **Làm mới nguồn, cùng schema** | OSM tháng 11 | Biên bản catalog mới → `tools/data` dựng phiên bản `osm.places`, `osm.roads` mới → bản nháp `kind = data` thay hai lớp đó | `geo.layer_versions`, `*_features`, `layer_manifest` | Giữ nguyên |
| 2 | 2 | **Thêm nguồn bổ sung cho lớp đã có** | Chợ CSDL quy hoạch bù chợ OSM | Tạo lớp riêng `qhtd.places`. Tiêu chí chợ khai `inputs: [osm.places, qhtd.places]`; truy vấn gộp trùng cùng loại dưới 40 m lúc đo. Không trộn hai nguồn vào một lớp, vì giấy phép khác nhau (ODbL và internal) | `geo.layers`, `CRITERIA` | Giữ nguyên |
| 3 | 1 | **Thêm lớp mới** | Đường dây điện, PCCC | Thêm `geo.layers`, dựng phiên bản đầu, đưa vào bảng kê | `geo.layers`, `layer_manifest` | Giữ nguyên; tiêu chí mới không có trong kết quả cũ |
| 4 | 1 | **Thêm tiêu chí mới, method đã có** | "Khoảng cách tới PCCC" (`nearest`) | Thêm vào `CRITERIA` trong code, deploy, phát hành bản `kind = criteria` (hoặc gộp với bản `data` nếu cần lớp mới) | Code, `criteria_snapshot` | Kết quả cũ hiện "chưa đánh giá tiêu chí này" |
| 5 | 1 | **Thêm tiêu chí cần method mới** | Đo theo đường đi bộ thật | Code method mới, deploy, rồi làm như #4. Kiểm tra `METHOD_UNSUPPORTED` chặn trường hợp phát hành trước khi deploy | Code | Như #4 |
| 6 | 1 | **Đổi ngưỡng hoặc thang điểm** | Hiệu thuốc: ngưỡng "tốt" từ 150 m lên 200 m | Sửa `CRITERIA`, deploy. Backend vẫn tính theo snapshot cũ cho tới khi phát hành bản `kind = criteria`. Chạy điểm mẫu trước | Code, `criteria_snapshot`, `criteria_hash` | Giữ nguyên theo định nghĩa cũ |
| 7 | 2 | **Đổi cách đo** | Bệnh viện: khoảng cách → thời gian đi (Vietmap) | Như #6, `method = travel_time`, fallback `nearest` | Như #6 | Như #6 |
| 8 | 1 | **Bỏ tiêu chí** | Bỏ "Cửa hàng vật tư" vì quá thưa | Xóa khỏi `CRITERIA`, phát hành. Trọng số và chỉnh tay của người dùng giữ trong DB nhưng ẩn | Code | Vẫn hiện, ghi "tiêu chí đã ngừng" |
| 9 | 2 | **Thay nguồn bằng nguồn tốt hơn** | Đúng ô JRC `N30_E100`; thêm ô WorldCover phía nam | Phiên bản lớp mới, `coverage` rộng hơn | Như #1 | Chỗ trước đây `no_data` sẽ có số khi đánh giá lại |
| 10 | 1 | **Nguồn đổi schema hoặc tên trường** | CSDL quy hoạch đổi `maLoaiDat` | Kiểm tra `contract_columns` chặn → `failed`. Sửa adapter trong `tools/data`, commit, dựng lại (`pipeline_version` mới) | `geo.layer_versions` | Không ảnh hưởng |
| 11 | 1 | **Số lượng tăng hoặc giảm bất thường** | OSM mất 30% điểm buýt | `row_count_delta`: lệch quá ±20% so với bản đang phát hành thì chặn, quá ±5% thì cảnh báo. Lỗi do nguồn thật sự đổi thì sửa ngưỡng trong script kèm lý do trong commit | `checks` | Không ảnh hưởng |
| 12 | 1 | **Phát hiện lỗi sau khi đã phát hành** | Lệch tọa độ do sai hệ VN-2000 | Theo `diagrams/flow-rollback.mmd`: bản mới `kind = rollback`, bản lỗi `withdrawn` | `map_dataset_versions` | Gắn nhãn "dữ liệu đã thu hồi, nên đánh giá lại" |
| 13 | 1 | **Thu hồi về bản có lớp đã `retired`** | Quay về bản cách đây 2 tháng | API trả `BASE_LAYER_RETIRED` kèm danh sách lớp → dựng lại bằng `tools/data` từ `catalog_paths` (file raw còn giữ theo data/README), rồi thu hồi | `geo.layer_versions` | — |
| 14 | 3 | **Sửa tay một đối tượng** | Chợ đã giải tỏa vẫn còn trên OSM | GĐ1–2: ghi vào `tools/data/patches/*.json` (commit git), script áp lúc dựng lớp. GĐ3: bảng `feature_patches` | File patch | Giữ nguyên |
| 15 | 2 | **Đổi ranh hành chính** | Sắp xếp phường 07/2025 | Lớp `admin.ward` phiên bản mới có `valid_from`. Tên phường của địa điểm lấy từ Vietmap Reverse (ranh mới). Bảng nối cũ–mới để GĐ3 | `geo.area_features`, `map_places.ward_code` | Giữ mã cũ |
| 16 | 1 | **Gỡ dữ liệu vì giấy phép** | Nguồn bên thứ ba yêu cầu gỡ | `geo.layers.usage = blocked` → bản `hotfix` bỏ lớp đó (kiểm tra `SOURCE_BLOCKED` chặn mọi bản còn dùng) → `retired` ngay, không chờ 30 ngày → xóa `evidence` mang tên đối tượng của lớp đó trong kết quả cũ, giữ số | `geo.layers`, `map_place_measurements.evidence` | Giữ điểm, bỏ chi tiết |
| 17 | 2 | **Dữ liệu chỉ dùng nội bộ** | CSDL quy hoạch Thủ đô | `usage = internal`: tính được; API lớp bản đồ không trả; `evidence` chỉ ghi loại + khoảng cách | `geo.layers` | — |
| 18 | 1 | **Đổi độ phân giải lưới** | 100 m → 50 m | Thêm `geo.grids` mới, phiên bản lớp lưới mới | `geo.grids`, `geo.grid_values` | Giữ nguyên |
| 19 | 2 | **Vietmap hết ngân sách hoặc lỗi** | Quá `MAP_DAILY_BUDGET` | `travel_time` → `nearest`, `status = fallback`, `confidence` giảm một bậc | `map_place_measurements` | — |
| 20 | 2 | **Số đo Vietmap hết hạn** | Thời gian đi đo cách đây 40 ngày | Hiện "số đo cũ", cho đo lại riêng tiêu chí đó | `expires_at` | — |
| 21 | 1 | **`/reset` trên máy dev** | Dựng lại database dev | `public` bị xóa và dựng lại; `geo` còn nguyên. Seed tạo bản phát hành 1 từ phiên bản lớp `ready` mới nhất mỗi lớp. Không gỡ lớp bảo vệ nào của `/reset` | `map_dataset_versions` | Mất cùng toàn bộ dữ liệu dev, như hiện nay |
| 22 | 1 | **Hai người cùng làm bản nháp** | — | Chỉ một bản `draft` (unique partial index). Người thứ hai sửa tiếp bản nháp đang mở | `map_dataset_versions` | — |
| 23 | 1 | **Dung lượng tăng** | Nhiều phiên bản lưới | Job dọn: ngoài bản hiện hành, bản liền trước, bản nháp quá 30 ngày → `retired` → `DELETE` đối tượng. Lưới quá ~20 triệu dòng → cân nhắc phân vùng (`future-schema.md`) | `geo.*_features`, `geo.grid_values` | Không ảnh hưởng (kết quả tự chứa số đo) |
| 24 | 2 | **Mở rộng tỉnh khác** | Bắc Ninh | Phiên bản lớp mới có `coverage` rộng hơn | `coverage` | Giữ nguyên |
| 25 | 3 | **Không khí theo giờ, kết luận AI** | — | Xem `future-schema.md` | — | — |

## Kiểm tra mặc định

Kiểm tra mức lớp chạy trong `tools/data` và ghi vào `geo.layer_versions.checks`. Kiểm tra mức bản chạy trong backend lúc bấm phát hành.

| Mã | Mức | Kiểm gì |
| --- | --- | --- |
| `source_checksum` | chặn (lớp) | sha256 file khớp biên bản catalog |
| `contract_columns` | chặn (lớp) | Đủ cột bắt buộc theo adapter, đúng kiểu |
| `geometry_valid` | chặn (lớp) | `ST_IsValid`, không rỗng, đúng SRID |
| `inside_bbox` | chặn (lớp) | 99,9% đối tượng nằm trong hộp Hà Nội mở rộng 5 km |
| `row_count_delta` | chặn/cảnh báo (lớp) | Lệch so với phiên bản đang phát hành: ±20% chặn, ±5% cảnh báo (cả từng `category`) |
| `duplicate_key` | chặn (lớp) | `feature_key` không trùng trong một phiên bản (trừ lớp vùng) |
| `coverage_change` | cảnh báo (lớp) | Diện tích `coverage` giảm |
| `criteria_inputs_present` | chặn (bản) | Mọi `inputs` của tiêu chí trong `CRITERIA` đều có lớp trong bảng kê |
| `layers_ready` | chặn (bản) | Mọi phiên bản lớp trong bảng kê đang `ready` |
| `method_supported` | chặn (bản) | Backend hỗ trợ mọi `method` |
| `source_blocked` | chặn (bản) | Không có lớp `usage = blocked` |
| `golden_points` | thủ công | Script điểm mẫu đã chạy; admin ghi tóm tắt vào ghi chú phát hành |

## Lịch vận hành gợi ý

| Nguồn | Chu kỳ | Tình huống |
| --- | --- | --- |
| OSM | Tháng | 1 |
| CSDL quy hoạch Thủ đô | Khi có bản công bố mới | 1 hoặc 10 |
| WorldPop, WorldCover, JRC, FABDEM | Khi có phát hành mới (năm) | 9 |
| Ranh hành chính | Khi có nghị quyết | 15 |
