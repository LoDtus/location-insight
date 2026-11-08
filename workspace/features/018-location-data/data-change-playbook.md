# Sổ tay thay đổi dữ liệu (018-location-data)

Mỗi tình huống ghi: nhận biết thế nào, làm gì, bảng nào đổi, và kết quả cũ ra sao. Bốn quy tắc luôn đúng:

1. Không sửa dòng đã nhập, không sửa bản phát hành đã `staged` trở đi. Mọi thay đổi là một phiên bản mới.
2. Phát hành phải đi qua: kiểm tra chất lượng, rồi chạy điểm mẫu, rồi admin xem báo cáo.
3. Kết quả đánh giá đã lưu không bao giờ tự đổi. Người dùng bấm "Đánh giá lại" thì mới dùng bản mới.
4. Thu hồi luôn là tạo bản mới (tiến tới), không xóa lịch sử.

## Bảng tình huống

| # | Tình huống | Ví dụ | Làm gì | Bảng đổi | Kết quả cũ |
| --- | --- | --- | --- | --- | --- |
| 1 | **Làm mới nguồn, cùng schema** | OSM tháng 11 | Snapshot mới, rồi phiên bản lớp mới cho từng lớp lấy từ nguồn đó, rồi bản nháp `kind = data` thay các lớp đó | `source_snapshots`, `layer_versions`, `*_features`, `map_dataset_layers` | Giữ nguyên, gắn bản cũ |
| 2 | **Thêm nguồn bổ sung cho lớp đã có** | Chợ trong CSDL quy hoạch bù chợ OSM | Phiên bản lớp mới có hai `layer_version_inputs` (`primary` và `supplement`, có `priority`). Gộp trùng cùng loại cách nhau dưới 40 m, giữ `attrs.merged_from` | `layer_version_inputs` | Giữ nguyên |
| 3 | **Thêm lớp mới** | Đường dây điện, PCCC | Thêm `geo.layers`, dựng phiên bản đầu, thêm vào bảng kê | `layers`, `map_dataset_layers` | Giữ nguyên; tiêu chí mới không có trong kết quả cũ |
| 4 | **Thêm tiêu chí mới, phương pháp đã có** | "Khoảng cách tới PCCC" (`nearest`) | Thêm `map_criteria` và phiên bản 1 (`draft`), khai `inputs`, `params`, `scoring`, đưa vào bảng kê tiêu chí. Không deploy code | `map_criteria`, `map_criterion_versions`, `map_dataset_criteria` | Kết quả cũ hiện "chưa đánh giá tiêu chí này" |
| 5 | **Thêm tiêu chí cần phương pháp mới** | Đo theo đường đi bộ thật | Code phương pháp mới vào `criterion_method`, deploy, rồi làm như #4. Bản phát hành chỉ staged được khi backend đang chạy hỗ trợ method đó | Enum + như #4 | Như #4 |
| 6 | **Đổi ngưỡng hoặc thang điểm** | Hiệu thuốc: tốt từ 150 m thành 200 m | Phiên bản tiêu chí mới, bản nháp `kind = criteria` (không cần nhập dữ liệu) | `map_criterion_versions`, `map_dataset_criteria` | Giữ nguyên, hiện theo định nghĩa cũ |
| 7 | **Đổi cách đo** | Bệnh viện: khoảng cách thành thời gian đi (Vietmap) | Phiên bản mới `method = travel_time`, `fallback_method = nearest`. Báo cáo tác động phải xem kỹ | Như #6 | Như #6 |
| 8 | **Bỏ tiêu chí** | Bỏ "Cửa hàng vật tư" vì quá thưa | Bỏ khỏi bảng kê bản mới, đặt `map_criteria.deprecated_at`. Trọng số, chỉnh tay của người dùng giữ lại nhưng ẩn | `map_dataset_criteria`, `map_criteria` | Vẫn hiện, ghi "tiêu chí đã ngừng" |
| 9 | **Thay nguồn bằng nguồn tốt hơn** | Ô JRC đúng (`N30_E100`), thêm ô WorldCover phía nam | Phiên bản lớp mới; `coverage` rộng hơn | Như #1 | Chỗ trước đây `no_data` sẽ có số khi đánh giá lại |
| 10 | **Nguồn đổi schema hoặc tên trường** | CSDL quy hoạch đổi `maLoaiDat` | Bước nhập đối chiếu hợp đồng cột và dừng ngay (`failed`). Sửa adapter trong `tools/data`, tăng `pipeline_version`, nhập lại | `layer_versions` | Không ảnh hưởng |
| 11 | **Số lượng tăng hoặc giảm bất thường** | OSM mất 30% điểm buýt | Kiểm tra `row_count_delta` (chặn nếu lệch quá ±20%, cảnh báo nếu quá ±5%). Muốn chấp nhận phải ghi lý do khi phát hành | `quality_checks` | Không ảnh hưởng |
| 12 | **Phát hiện lỗi sau khi đã phát hành** | Lệch tọa độ do sai hệ VN-2000 | Làm theo `diagrams/flow-rollback.mmd`: bản mới `kind = rollback`, bản lỗi thành `withdrawn` | `map_dataset_versions` | Kết quả trên bản lỗi được gắn nhãn "nên đánh giá lại" |
| 13 | **Sửa tay một đối tượng** | Chợ đã giải tỏa vẫn còn trên OSM | Thêm `feature_patches` (`hide`). Có hiệu lực từ phiên bản lớp dựng sau đó; cần ngay thì làm bản `hotfix` dựng lại đúng lớp đó | `feature_patches` | Giữ nguyên |
| 14 | **Bản sửa tay mồ côi** | `feature_key` đổi sau khi nguồn sửa tên | Kiểm tra `orphan_patches` cảnh báo; admin gắn lại khóa hoặc thu hồi bản sửa | `feature_patches` | — |
| 15 | **Đổi ranh hành chính** | Sắp xếp phường 07/2025 | Lớp `admin.ward` phiên bản mới có `valid_from`. Thêm `admin_unit_mappings` cũ sang mới để `map_benchmarks` và báo cáo cũ quy đổi được | `area_features`, `admin_unit_mappings` | Kết quả cũ giữ mã phường cũ, hiển thị kèm tên mới qua bảng nối |
| 16 | **Gỡ dữ liệu vì giấy phép** | Nguồn bên thứ ba yêu cầu gỡ | Đặt `sources.usage = blocked`, dựng lại các lớp không có nguồn đó, phát hành `hotfix`, `DROP` phân vùng cũ ngay (không chờ 30 ngày). Xóa `evidence` chứa tên đối tượng của nguồn đó trong kết quả cũ, giữ số | `sources`, `layer_versions`, `map_place_measurements.evidence` | Giữ điểm số, bỏ chi tiết |
| 17 | **Dữ liệu chỉ dùng nội bộ** | CSDL quy hoạch Thủ đô | `usage = internal`: lớp vẫn dùng để tính. API lớp bản đồ không trả đối tượng; `evidence` chỉ ghi loại và khoảng cách | `sources` | — |
| 18 | **Đổi độ phân giải lưới** | 100 m thành 50 m | Thêm `geo.grids` mới, phiên bản lớp lưới mới trên lưới đó | `grids`, `grid_values` | Giữ nguyên |
| 19 | **Dữ liệu theo giờ bị gián đoạn** | OpenAQ lỗi 6 giờ | Không khí lấy giá trị mới nhất trong khung `params.max_age`; quá hạn thì `no_data` | `env_observations` | Số đo cũ hết `expires_at` thì hiện "số đo cũ" |
| 20 | **Vietmap hết ngân sách hoặc lỗi** | Quá `MAP_DAILY_BUDGET` | `travel_time` chuyển sang `fallback_method`, `status = fallback`, `confidence` giảm một bậc | `map_place_measurements` | — |
| 21 | **Đổi prompt hoặc model AI** | Prompt ngập úng v2 | Tăng `prompt_version`. Job cũ giữ nguyên; đánh giá lại thì tạo job mới (khóa unique có `prompt_version`) | `map_ai_jobs` | Giữ nguyên |
| 22 | **AI trả kết quả không có nguồn** | — | `verdict = unknown`, `confidence = low`. Không dùng cho điểm tổng | `map_place_measurements` | — |
| 23 | **Mở rộng tỉnh khác** | Bắc Ninh | Lớp giữ nguyên code, phiên bản mới có `coverage` rộng hơn, hoặc thêm lớp theo vùng. Benchmark tính theo `scope` | `layer_versions.coverage` | Giữ nguyên |
| 24 | **Hai người cùng làm bản nháp** | — | Chỉ một bản `draft` hoặc `staged` tại một thời điểm (unique partial index). Người thứ hai thêm vào bản nháp đang mở | `map_dataset_versions` | — |
| 25 | **Dung lượng phình** | Nhiều phiên bản lưới | Job dọn: `retired` sau 30 ngày không ai trỏ, rồi `DROP` phân vùng. Không bao giờ dọn lớp trong bảng kê của bản hiện hành hoặc bản liền trước | `layer_versions` | Không ảnh hưởng (kết quả tự chứa số đo) |

## Kiểm tra chất lượng mặc định

| Mã | Mức | Kiểm gì |
| --- | --- | --- |
| `contract_columns` | chặn | Đủ cột bắt buộc theo adapter, đúng kiểu |
| `geometry_valid` | chặn | `ST_IsValid`, không rỗng, đúng SRID |
| `inside_bbox` | chặn | 99,9% đối tượng nằm trong hộp Hà Nội mở rộng 5 km |
| `row_count_delta` | chặn hoặc cảnh báo | Lệch so với phiên bản trước: quá ±20% thì chặn, quá ±5% thì cảnh báo |
| `required_categories` | chặn | Mỗi `category` mà tiêu chí cần có ít nhất 1 đối tượng |
| `duplicate_key` | chặn | `feature_key` không trùng trong một phiên bản (trừ lớp vùng đã chia nhỏ) |
| `coverage_change` | cảnh báo | Diện tích `coverage` giảm |
| `orphan_patches` | cảnh báo | Bản sửa tay không khớp đối tượng nào |
| `criteria_inputs_present` | chặn (mức bản) | Mọi `inputs` của tiêu chí trong bảng kê đều có lớp |
| `method_supported` | chặn (mức bản) | Backend đang chạy hỗ trợ mọi `method` |
| `golden_expectations` | chặn (mức bản) | Điểm mẫu không vi phạm `expectations` |
| `license_usage` | chặn (mức bản) | Không có lớp dựng từ nguồn `blocked` |

## Lịch vận hành gợi ý

| Nguồn | Chu kỳ | Ghi chú |
| --- | --- | --- |
| OSM | Tháng | Tình huống 1 |
| CSDL quy hoạch Thủ đô | Khi có bản công bố mới | Tình huống 1 hoặc 10 |
| WorldPop, WorldCover, JRC, FABDEM | Khi có phát hành mới (năm) | Tình huống 9 |
| OpenAQ | Giờ (job nền) | Tình huống 19 |
| Ranh hành chính | Khi có nghị quyết | Tình huống 15 |
