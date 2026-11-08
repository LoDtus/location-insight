# Phần schema để sau (GĐ3) — 018-location-data

Các thành phần này đã có trong bản đặc tả đầu, nhưng được hoãn theo `research.md` Bản ghi 8–10 cho tới khi có nhu cầu thật. Ghi lại ở đây để khi làm không phải thiết kế lại từ đầu. Khi làm, theo quy ước ở đầu `postgresql.dbml`: không enum Postgres, không khóa ngoại giữa `geo` và `public`.

| Thành phần | Bảng dự kiến | Làm khi nào | Ghi chú thiết kế |
| --- | --- | --- | --- |
| Tiêu chí trong database | `map_criteria`, `map_criterion_versions` | Có người không phải dev cần tự chỉnh ngưỡng | Chuyển `criteria_snapshot` thành dòng; phiên bản `draft → frozen` khi bản phát hành chứa nó được phát hành; `params` kiểm theo schema của từng method |
| Sửa tay đối tượng | `geo.feature_patches` (`layer_code`, `feature_key`, `action add/update/hide`, `payload`, `reason`, `revoked_at`) | Người dùng bắt đầu báo sai dữ liệu | Tạo qua UI admin; áp khi Lưu một gói mới (sinh phiên bản mới), không sửa phiên bản đã `ready`; kiểm tra "bản sửa mồ côi" |
| Điểm mẫu sửa trên UI | `map_golden_points` | Cần sửa điểm mẫu mà không deploy | GĐ1–2: `backend/src/modules/map/golden-points.json` trong git, tự chạy lúc phát hành, kết quả ở `map_dataset_versions.golden_report` |
| Mốc so sánh theo vùng | Xem dòng benchmark | Người dùng ngoại thành thấy mọi lô đều "yếu" | Giải hạn chế một bộ ngưỡng cho cả thành phố |
| Benchmark theo phường | `map_benchmarks` (`version`, `criterion_id`, `scope`, `scope_code`, `p25/p50/p75`) | Có ranh phường sau sắp xếp 2025 | Chỉ để giải thích, không vào verdict |
| Bảng nối ranh hành chính | `geo.admin_unit_mappings` (`old_code`, `new_code`, `share`, `effective_on`) | Cùng lúc benchmark | |
| Không khí theo giờ | `geo.env_observations`, phân vùng RANGE theo tháng, giữ 90 ngày | Có key OpenAQ | Tiêu chí `timeseries`, trạm ≤ 3 km |
| Việc AI | `map_ai_jobs` (`input`, `prompt_version`, `model`, `status`, `output`, `citations`) | Đã chốt tiêu chí AI và nhà cung cấp | Phải qua technical-feasibility (hàng đợi, chi phí); AI không ghi đè số đo; tối đa `medium` |
| Bước khóa trước phát hành (`staged`) | Thêm trạng thái vào `map_dataset_versions.status` | Có người thứ hai duyệt | GĐ1–2: draft → published, kiểm tra chạy ngay lúc bấm phát hành |
| Nguồn và snapshot dạng bảng | `geo.sources`, `geo.source_snapshots` | Cần truy vấn danh mục nguồn trong app | GĐ1–2 dùng `manifest.sources` trong `layer_versions` và `import_jobs` |
| Tự tải nguồn định kỳ | Cột `source_url`, `schedule` trong `geo.layers` + job tải | Làm tay OSM hằng tháng trở thành gánh nặng | Job chỉ tải và `pack` theo cùng code `tools/data`, rồi tạo import job như tải lên tay; vẫn phải admin Lưu. Không bao giờ đọc định dạng thô ngoài adapter có sẵn |
| Kho gói trên object storage | Volume → S3/R2 tương thích | Volume không đủ hoặc cần nhiều server | Đổi `package_path` thành URI; giữ tên theo sha256 |
| Tách role database | Role `app_reader` (SELECT `geo`), `geo_ingest` (module datasets), kết nối riêng | Trước khi lên production | GĐ1 dựa vào trigger + cờ `geo.write_mode`; role làm phòng thủ thêm một lớp, cần thêm biến kết nối trong `.env*` gốc |
| Khôi phục phiên bản từ gói | `POST /admin/map/layer-versions/{id}/restore`, import job `purpose = restore` | Lần đầu cần thu hồi về bản đã bị dọn (GĐ2) | Bảng, trạng thái và trigger đã sẵn; còn thiếu code nạp lại giữ nguyên id |
| Job kiểm toàn vẹn hằng tuần | Tính lại `content_hash`, đặt `integrity_ok` | GĐ2 | `content_hash` đã tính lúc Lưu |
| Người duyệt thứ hai cho Lưu và phát hành | Cột `approved_by` | Có người vận hành thứ hai | Người tải gói không được tự duyệt |
| Phân vùng | `PARTITION BY LIST (layer_version_id)` | `grid_values` vượt ~20 triệu dòng hoặc `DELETE` khi dọn gây chậm | Khóa chính phải chứa khóa phân vùng |
