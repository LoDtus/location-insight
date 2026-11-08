# Phần schema để sau (GĐ3) — 018-location-data

Các thành phần này đã có trong bản đặc tả đầu, nhưng được hoãn theo `research.md` Bản ghi 8–10 cho tới khi có nhu cầu thật. Ghi lại ở đây để khi làm không phải thiết kế lại từ đầu. Khi làm, theo quy ước ở đầu `postgresql.dbml`: không enum Postgres, không khóa ngoại giữa `geo` và `public`.

| Thành phần | Bảng dự kiến | Làm khi nào | Ghi chú thiết kế |
| --- | --- | --- | --- |
| Tiêu chí trong database | `map_criteria`, `map_criterion_versions` | Có người không phải dev cần tự chỉnh ngưỡng | Chuyển `criteria_snapshot` thành dòng; phiên bản `draft → frozen` khi bản phát hành chứa nó được phát hành; `params` kiểm theo schema của từng method |
| Sửa tay đối tượng | `geo.feature_patches` (`layer_code`, `feature_key`, `action add/update/hide`, `payload`, `reason`, `revoked_at`) | Người dùng bắt đầu báo sai dữ liệu | Áp lúc dựng phiên bản lớp; kiểm tra "bản sửa mồ côi" |
| Điểm mẫu và tác động lưu DB | `map_golden_points`, `map_release_impacts` | Báo cáo CLI không còn đủ, cần xem trên admin | GĐ1–2 dùng file `tools/data/golden-points.json` + script in bảng chênh lệch |
| Benchmark theo phường | `map_benchmarks` (`version`, `criterion_id`, `scope`, `scope_code`, `p25/p50/p75`) | Có ranh phường sau sắp xếp 2025 | Chỉ để giải thích, không vào verdict |
| Bảng nối ranh hành chính | `geo.admin_unit_mappings` (`old_code`, `new_code`, `share`, `effective_on`) | Cùng lúc benchmark | |
| Không khí theo giờ | `geo.env_observations`, phân vùng RANGE theo tháng, giữ 90 ngày | Có key OpenAQ | Tiêu chí `timeseries`, trạm ≤ 3 km |
| Việc AI | `map_ai_jobs` (`input`, `prompt_version`, `model`, `status`, `output`, `citations`) | Đã chốt tiêu chí AI và nhà cung cấp | Phải qua technical-feasibility (hàng đợi, chi phí); AI không ghi đè số đo; tối đa `medium` |
| Bước khóa trước phát hành (`staged`) | Thêm trạng thái vào `map_dataset_versions.status` | Có người thứ hai duyệt | GĐ1–2: draft → published, kiểm tra chạy ngay lúc bấm phát hành |
| Nguồn và snapshot dạng bảng | `geo.sources`, `geo.source_snapshots` | Cần truy vấn danh mục nguồn trong app | GĐ1–2 dùng `catalog_paths` + `source_sha256` trong `layer_versions` |
| Phân vùng | `PARTITION BY LIST (layer_version_id)` | `grid_values` vượt ~20 triệu dòng hoặc `DELETE` khi dọn gây chậm | Khóa chính phải chứa khóa phân vùng |
