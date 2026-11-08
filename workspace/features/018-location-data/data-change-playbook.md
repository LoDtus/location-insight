# Sổ tay thay đổi dữ liệu (018-location-data)

Mỗi tình huống ghi cách nhận biết, việc phải làm, chỗ dữ liệu đổi, và kết quả cũ ra sao. Cột **GĐ** cho biết tình huống được hỗ trợ từ giai đoạn nào ([research.md](research.md) Bản ghi 12).

Bảy quy tắc luôn đúng:

1. **Một đường ghi.** Dữ liệu nền chỉ vào database qua gói chuẩn tải lên `/admin/datasets`, rồi admin bấm "Lưu" sau khi kiểm tra đạt. Không SQL tay, không script ghi thẳng, kể cả trên máy dev.
2. **Không sửa thứ đã lưu.** Không sửa đối tượng, gói, bảng kê hay snapshot tiêu chí của bản đã phát hành. Mọi thay đổi là một gói mới với `label` mới, hoặc một bản phát hành mới.
3. **Phát hành phải qua cổng.** Phiên bản lớp phải `ready` và toàn vẹn, kiểm tra mức bản phải đạt, điểm mẫu tự chạy phải đạt.
4. **Một bảng kê cho tất cả.** Mọi tiêu chí và lớp bản đồ dùng cùng phiên bản lớp trong bảng kê của bản hiện hành.
5. **Kết quả đã lưu không tự đổi.** Người dùng bấm "Đánh giá lại" thì mới dùng bản mới.
6. **Thu hồi luôn tạo bản mới**, không xóa lịch sử.
7. **Không có khóa ngoại giữa `geo` và `public`.** `/reset` không đụng `geo`.

## Bảng tình huống

| # | GĐ | Tình huống | Ví dụ | Làm gì | Chỗ đổi | Kết quả cũ |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 | **Làm mới nguồn, cùng khuôn** | OSM tháng 11 | Biên bản catalog mới → `package_tool.py pack` ra gói `osm.places` và `osm.roads` → tải lên → Lưu → bản nháp `kind = data` thay hai lớp | Kho gói, `geo.import_jobs`, `geo.layer_versions`, `*_features`, `layer_manifest` | Giữ nguyên |
| 2 | 2 | **Thêm nguồn bổ sung cho lớp đã có** | Chợ CSDL quy hoạch bù chợ OSM | Tạo lớp `qhtd.places` trên UI (`usage = internal`) và tải gói. Tiêu chí chợ khai `inputs: [osm.places, qhtd.places]`, gộp trùng dưới 40 m lúc đo. Không trộn hai nguồn vào một gói | `geo.layers`, `CRITERIA` | Giữ nguyên |
| 3 | 1 | **Thêm lớp mới cùng dạng hình học** | Trạm PCCC | Tạo lớp trên UI → tải gói → Lưu → đưa vào bảng kê. Không cần code | `geo.layers`, `layer_manifest` | Giữ nguyên |
| 4 | 1 | **Thêm tiêu chí mới, method đã có** | Khoảng cách tới PCCC (`nearest`) | Thêm vào `CRITERIA` trong code, deploy, phát hành bản `kind = criteria` (hoặc gộp với bản `data` nếu cần lớp mới). Thêm điểm mẫu có `expectations` cho tiêu chí mới | Code, `criteria_snapshot` | Hiện "chưa đánh giá tiêu chí này" |
| 5 | 1 | **Thêm tiêu chí cần method mới** | Đo theo đường đi bộ thật | Viết method mới (`walk@1`), deploy, rồi làm như #4. Kiểm tra `method_supported` chặn trường hợp phát hành trước khi deploy | Code | Như #4 |
| 6 | 1 | **Đổi ngưỡng, thang điểm, độ tin, điều kiện chặn** | Hiệu thuốc: ngưỡng "tốt" từ 150 m lên 200 m | Sửa `CRITERIA`, deploy. Backend vẫn tính theo snapshot cũ cho tới khi phát hành bản `kind = criteria`. Xem `golden_report` trước khi phát hành | Code, `criteria_snapshot`, `criteria_hash` | Giữ nguyên theo định nghĩa cũ |
| 7 | 1 | **Sửa cách tính của method** | Sửa lỗi `nearest` bỏ sót đối tượng ở rìa | Tăng `nearest@1` thành `nearest@2`, giữ code `@1` chừng nào còn bản `published` dùng nó. Phát hành bản `criteria` dùng `@2` | Code, `criteria_snapshot` | Giữ nguyên; bản rollback vẫn tính theo `@1` |
| 8 | 2 | **Đổi cách đo** | Bệnh viện: khoảng cách → thời gian đi (Vietmap) | Như #6, `method = travel_time`, dự phòng bằng `nearest` | Như #6 | Như #6 |
| 9 | 1 | **Bỏ tiêu chí** | Bỏ "Cửa hàng vật tư" vì quá thưa | Xóa khỏi `CRITERIA`, phát hành. Trọng số và chỉnh tay của người dùng giữ trong DB nhưng ẩn | Code | Vẫn hiện, ghi "tiêu chí đã ngừng" |
| 10 | 1 | **Đổi id tiêu chí** | `pharmacy_500m` → `pharmacy` | Tránh. Nếu buộc phải đổi: thêm bảng ánh xạ id cũ → mới trong code. Service chuyển trọng số và chỉnh tay của người dùng trong cùng bản phát hành | Code, `map_criterion_weights`, `map_criterion_overrides` | Hiện theo id cũ |
| 11 | 2 | **Thay nguồn bằng nguồn tốt hơn** | Đúng ô JRC `N30_E100`; thêm ô WorldCover phía nam | Gói mới có `coverage.geojson` rộng hơn | Như #1 | Chỗ trước là `no_data` sẽ có số khi đánh giá lại |
| 12 | 1 | **Nguồn đổi schema hoặc tên trường** | CSDL quy hoạch đổi `maLoaiDat` | Sửa bước chuẩn hóa ở máy. Gói vẫn theo khuôn cũ nên server không đổi gì | `tools/data` | Không ảnh hưởng |
| 13 | 1 | **Cần thêm cột vào khuôn** | Muốn lọc theo `attrs.opening_hours` trong SQL | Thêm khóa trong `attrs` thì không cần làm gì. Đưa lên cột thì tạo khuôn `point@2`: migration `geo`, bộ đọc mới, sửa `package-contracts.json`, đổi `geo.layers.contract`; khuôn `@1` vẫn đọc được | Code, migration | Không ảnh hưởng |
| 14 | 1 | **Gói bị từ chối** | `row_count_delta` lệch 30%, sai hệ tọa độ | Job `rejected`, xem `checks`. Lỗi do gói: sửa ở máy, `pack` với label mới. Nguồn thật sự đổi: sửa ngưỡng trong code kèm lý do trong commit | `geo.import_jobs` | Không ảnh hưởng |
| 15 | 1 | **Tải trùng gói** | Bấm tải hai lần | `PACKAGE_DUPLICATE`, không tạo job mới | — | — |
| 16 | 1 | **Chặn nguồn vì giấy phép** | Bên thứ ba yêu cầu gỡ | `PATCH` lớp `usage = blocked` kèm lý do → bản `hotfix` bỏ lớp (kiểm tra `source_blocked` chặn mọi bản còn dùng) → `retired` ngay, không chờ 30 ngày → xóa gói khỏi kho và bản sao lưu → xóa `evidence` mang tên đối tượng của lớp đó trong kết quả cũ, giữ số | `geo.layers`, kho gói, `map_place_measurements.evidence` | Giữ điểm, bỏ chi tiết |
| 17 | 2 | **Dữ liệu chỉ dùng nội bộ** | CSDL quy hoạch Thủ đô | `usage = internal`: tính được; API lớp bản đồ không trả; `evidence` chỉ ghi loại và khoảng cách; `preview` của job chỉ admin thấy | `geo.layers` | — |
| 18 | 1 | **Phát hiện lỗi sau khi đã phát hành** | Lệch tọa độ do sai hệ VN-2000 | Theo `diagrams/flow-rollback.mmd`: bản mới `kind = rollback`, bản lỗi `withdrawn`. Thêm điểm mẫu bắt được lỗi này | `map_dataset_versions` | Gắn nhãn "dữ liệu đã thu hồi, nên đánh giá lại" |
| 19 | 2 | **Thu hồi về bản có lớp đã `retired`** | Quay về bản cách đây 3 tháng | API trả `BASE_LAYER_RETIRED` → khôi phục từng phiên bản từ gói trong kho (giữ nguyên id) → thu hồi | `geo.layer_versions`, `geo.import_jobs` | — |
| 20 | 2 | **Dữ liệu bị đổi ngoài đường nhập** | Ai đó chạy `UPDATE` bằng superuser | Job kiểm hằng tuần thấy `content_hash` lệch → `integrity_ok = false`, báo admin, chặn phát hành bản dùng phiên bản đó → khôi phục phiên bản từ gói → điều tra theo log Postgres | `geo.layer_versions` | Kết quả tính trong khoảng bị đổi: gắn nhãn nên đánh giá lại |
| 21 | 1 | **Mất kho gói trên server** | Hỏng volume | Chép lại từ bản sao lưu, đối chiếu sha256 với `data/catalog/packages` trong git. Database không bị ảnh hưởng | Kho gói | — |
| 22 | 3 | **Sửa tay một đối tượng** | Chợ đã giải tỏa vẫn còn trên OSM | GĐ1–2: ghi vào `tools/data/patches/*.json` (commit git), `pack` lại với label mới, ghi trong `manual_steps`. GĐ3: bảng `feature_patches` | File patch | Giữ nguyên |
| 23 | 2 | **Đổi ranh hành chính** | Sắp xếp phường 07/2025 | Gói `admin.ward` mới có `valid_from`. Tên phường của địa điểm lấy từ Vietmap Reverse (ranh mới). Bảng nối cũ–mới để GĐ3 | `geo.area_features`, `map_places.ward_code` | Giữ mã cũ |
| 24 | 1 | **Đổi độ phân giải hoặc bán kính lưới** | 100 m → 50 m, hoặc dân số trong 800 m | Độ phân giải: thêm `geo.grids` mới (migration). Bán kính: lớp mới `worldpop.pop_800m`, tiêu chí đổi `inputs`, rồi phát hành `kind = criteria` | `geo.grids`, `geo.layers`, `CRITERIA` | Giữ nguyên |
| 25 | 2 | **Vietmap hết ngân sách hoặc lỗi** | Quá `MAP_DAILY_BUDGET` | `travel_time` → `nearest`, `status = fallback`, `confidence` giảm một bậc | `map_place_measurements` | — |
| 26 | 2 | **Số đo Vietmap hết hạn** | Thời gian đi đo cách đây 40 ngày | Hiện "số đo cũ", cho đo lại riêng tiêu chí đó | `expires_at` | — |
| 27 | 1 | **`/reset` trên máy dev** | Dựng lại database dev | `public` bị xóa và dựng lại; `geo` còn nguyên. Seed (`MapDatasetService`) tạo lại trigger bảo vệ và bản phát hành 1 từ phiên bản `ready` mới nhất mỗi lớp còn trong `geo`; `geo` trống thì bản 1 rỗng (chế độ mẫu). Không nạp gói mẫu: dữ liệu dev cũng đi qua UI. Không gỡ lớp bảo vệ nào của `/reset` | `map_dataset_versions` | Mất cùng toàn bộ dữ liệu dev, như hiện nay |
| 28 | 1 | **Hai việc cùng lúc** | Hai lần tải gói, hoặc sửa bản nháp khi đang phát hành | Mỗi lúc một job ở `validating` hoặc `saving` (khóa advisory; job khác nhận `IMPORT_BUSY`). Chỉ một bản `draft`. Phát hành khóa dòng bản nháp (`SELECT … FOR UPDATE`) nên không sửa được bảng kê trong lúc đó | `geo.import_jobs`, `map_dataset_versions` | — |
| 29 | 1 | **Dung lượng tăng** | Nhiều phiên bản lưới | Job dọn: ngoài bản hiện hành, bản liền trước, bản nháp quá 30 ngày → `retired` → xóa đối tượng → `VACUUM`. Gói vẫn ở kho. Lưới quá khoảng 20 triệu dòng thì cân nhắc phân vùng (`future-schema.md`) | `geo.*_features`, `geo.grid_values` | Không ảnh hưởng (kết quả tự chứa số đo) |
| 30 | 2 | **Mở rộng tỉnh khác** | Bắc Ninh | Gói mới có `coverage.geojson` rộng hơn; mở rộng hộp `inside_bbox` trong code | `coverage` | Giữ nguyên |
| 31 | 3 | **Không khí theo giờ, kết luận AI** | — | Không đi qua gói. Xem `future-schema.md` | — | — |

## Kiểm tra mặc định

- **Kiểm tra mức gói và mức lớp:** chạy trên server khi nhận gói, ghi vào `geo.import_jobs.checks`, rồi chép sang `geo.layer_versions.checks` khi Lưu. `package_tool.py validate` chạy cùng quy tắc ở máy để bắt lỗi sớm.
- **Kiểm tra mức bản:** chạy lúc bấm phát hành.

| Mã | Mức | Kiểm gì |
| --- | --- | --- |
| `package_shape` | chặn (gói) | Zip đúng các mục cho phép, không thư mục con hay symlink, trong giới hạn dung lượng và tỷ lệ nén |
| `package_duplicate` | chặn (gói) | `package_sha256` chưa được nhập |
| `manifest_schema` | chặn (gói) | Manifest đúng khuôn (`parseManifest`); có `sources` với giấy phép; `manualSteps` nếu có bước làm tay |
| `layer_known`, `contract_supported`, `label_unique` | chặn (gói) | Lớp có trong `geo.layers` và chưa bị chặn, khuôn khớp lớp và server hỗ trợ, `(layer, label)` chưa có |
| `pipeline_dirty` | cảnh báo (gói) | `pipeline.dirty = true`: gói dựng từ code chưa commit |
| `data_checksum`, `row_count_match` | chặn (lớp) | `data_sha256`, `row_count` và `categories` khớp manifest |
| `contract_columns` | chặn (lớp) | Đủ cột bắt buộc theo khuôn, đúng kiểu |
| `geometry_valid` | chặn (lớp) | Hình học hợp lệ sau `ST_MakeValid`, không rỗng, đúng SRID |
| `inside_bbox` | chặn (lớp) | 99,9% đối tượng nằm trong hộp Hà Nội mở rộng 5 km |
| `duplicate_key` | chặn (lớp) | `feature_key` không trùng (trừ khuôn `area`) |
| `row_count_delta` | chặn/cảnh báo (lớp) | Lệch so với phiên bản đang phát hành: ±20% chặn, ±5% cảnh báo (cả từng `category`) |
| `coverage_change` | cảnh báo (lớp) | Diện tích `coverage` giảm |
| `category_unused` | cảnh báo (lớp) | Có `category` mà không tiêu chí nào dùng |
| `criteria_inputs_present` | chặn (bản) | Mọi `inputs` của tiêu chí đều có lớp trong bảng kê |
| `layers_ready` | chặn (bản) | Mọi phiên bản lớp trong bảng kê đang `ready` và `integrity_ok` không phải `false` |
| `method_supported` | chặn (bản) | Backend hỗ trợ mọi `method` cùng `method_version` |
| `source_blocked` | chặn (bản) | Không có lớp `usage = blocked` |
| `golden_points` | chặn (bản) | Điểm mẫu tự chạy: không vi phạm `expectations`. Số kết luận bị lật và độ lệch điểm ghi vào `golden_report` để admin xem |

## Lịch vận hành gợi ý

| Việc | Chu kỳ | Tình huống |
| --- | --- | --- |
| OSM: `pack` rồi tải lên | Tháng | 1 |
| CSDL quy hoạch Thủ đô | Khi có bản công bố mới | 1 hoặc 12 |
| WorldPop, WorldCover, JRC, FABDEM | Khi có phát hành mới (năm) | 11 |
| Ranh hành chính | Khi có nghị quyết | 23 |
| Kiểm `content_hash` | Tuần (job) | 20 |
| Sao lưu kho gói ra ngoài server | Sau mỗi lần Lưu, ít nhất hằng tuần | 21 |
| Thử khôi phục một gói từ bản sao lưu | Quý | 21 |
