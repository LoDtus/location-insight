# Kho dữ liệu

Chỗ làm việc với dữ liệu nền của Location Insight trên máy vận hành.

- **API không đọc thư mục này.** Dữ liệu chỉ vào database bằng một đường: đóng thành **gói chuẩn**, tải lên `/admin/datasets`, kiểm tra xong thì admin bấm "Lưu". Không có script nào ghi thẳng vào database. Xem [018-location-data](../workspace/features/018-location-data/README.md) và [khuôn gói](../workspace/features/018-location-data/package-contracts.md).
- **Git không chứa byte dữ liệu.** Git chỉ giữ khung thư mục, file hướng dẫn này, biên bản nguồn và manifest gói trong `catalog/`. Quy tắc nằm trong `.gitignore`.

## Bốn giai đoạn

Dữ liệu đi một chiều. Không sửa file ở giai đoạn trước để vá lỗi của giai đoạn sau.

| Giai đoạn | Ý nghĩa | Được sửa nội dung | Dùng để |
| --- | --- | --- | --- |
| `raw` | Đúng byte vừa tải | Không | Tải lại và đối soát nguồn |
| `interim` | Cắt Hà Nội, đổi định dạng, vẫn schema của nguồn. File làm tay (gán tọa độ, tách bảng từ PDF) cũng để ở đây | Có | Giảm dung lượng, làm tay |
| `processed` | Schema chung của dạng dữ liệu, mỗi nguồn một tệp | Có, vì làm lại được từ interim | So chất lượng từng nguồn |
| `packages` | Gói chuẩn tải lên UI: `manifest.json` + dữ liệu theo khuôn | **Không.** Sửa thì tạo label mới | Tải lên `/admin/datasets`, lưu trữ theo phiên bản |

- **Mỗi gói là một phiên bản của một lớp, không phải một tiêu chí.**
  - Lớp là (nguồn, chủ đề, dạng hình học), ví dụ `osm.places` hay `worldpop.pop_500m`.
  - Một gói `osm.places` phục vụ khoảng 12 tiêu chí, phân biệt bằng cột `category`.
  - Tiêu chí chợ đọc hai gói `osm.places` và `qhtd.places`.
- **Gộp trùng trong cùng một nguồn** (nút và vùng OSM của cùng một chợ) làm ở bước `processed → packages`.
- **Không gộp nhiều nguồn vào một gói**, vì mỗi nguồn có giấy phép riêng. Gộp giữa các nguồn (cùng loại, cách nhau dưới 40 m) do backend làm lúc đo.

## Bốn miền

`raw`, `interim` và `processed` chia theo miền để dễ tìm file. Miền không gắn với tiêu chí nào. Chỉ thêm miền khi dữ liệu không thuộc bốn nhóm này.

| Miền | Việc chứa |
| --- | --- |
| `places` | Điểm tiện ích |
| `transport` | Đường và giao thông công cộng |
| `environment` | Lưới và trạm đo |
| `admin` | Đơn vị hành chính, quy hoạch và văn bản |

`packages` không chia theo miền mà theo mã lớp, để khớp với database.

## Tên thư mục và phiên bản

```text
data/{raw|interim|processed}/{mien}/{nguon}/{phien-ban}/
data/packages/{layer_code}/{label}/package.zip
```

- **`phien-ban`** là ngày tải `YYYY-MM-DD`. Nếu nguồn có mã phát hành ổn định hơn ngày tải thì dùng mã đó: `fabdem/v1-0`, `worldpop/R2025A`.
- **`label`** của gói thường trùng ngày nguồn. Sửa lại gói thì thêm hậu tố: `2026-11-01-r2`.

Ví dụ:

```text
data/raw/places/osm/2026-11-01/vietnam-latest.osm.pbf
data/interim/places/osm/2026-11-01/hanoi.osm.pbf
data/processed/places/osm/2026-11-01/places.parquet
data/packages/osm.places/2026-11-01/package.zip
data/packages/osm.roads/2026-11-01/package.zip
data/packages/worldpop.pop_500m/R2025A/package.zip
```

## Catalog (được commit)

| File | Nội dung |
| --- | --- |
| `catalog/snapshots/{mien}/{nguon}/{phien-ban}.json` | Biên bản nguồn: URL, sha256, số bản ghi, giấy phép, lỗi đã biết. Mẫu: [snapshot.example.json](catalog/snapshot.example.json) |
| `catalog/packages/{layer_code}/{label}.json` | Bản sao `manifest.json` của gói, do `tools/data pack` chép ra |
| `catalog/criteria-map.md` | Bảng tiêu chí → lớp → nguồn, do script sinh từ `CRITERIA` trong backend. Không sửa tay |

Bản phát hành nào đang dùng phiên bản lớp nào nằm trong database (`/admin/datasets`, tab Phiên bản). Vì vậy không còn `catalog/current.json`.

## Giữ lại và sao lưu

| Giai đoạn | Giữ |
| --- | --- |
| `raw` | Hai bản mới nhất với nguồn cập nhật thường xuyên; một bản với nguồn tĩnh (cao độ, ngập sông, dân số) |
| `interim`, `processed` | Xóa được bất cứ lúc nào. Riêng file làm tay ở `interim` thì giữ cùng thời hạn với gói đã dùng nó |
| `packages` | Bản làm việc trên máy, xóa được sau khi đã tải lên. **Bản gốc là kho gói trên server** (bucket S3, tiền tố `datasets/packages/`): giữ mãi gói từng được phát hành, có sao lưu ra ngoài server |

Mất `raw` cũ không làm mất khả năng thu hồi, vì phiên bản cũ được khôi phục từ gói.

## Git

- **Commit được:** `README.md`, `.gitkeep`, và file trong `catalog/` có đuôi `.json`, `.yaml`, `.yml`, `.md`.
- **Không commit:** `.pbf`, GeoTIFF, GeoParquet, Excel, GTFS, JSON thu từ trang web, gói `.zip`, và mọi file nằm trong `raw`, `interim`, `processed`, `packages`.
- Volume Postgres đã bị bỏ qua riêng. Không copy database vào đây.

## Gói giả để thử giao diện

`python3 tools/data/mock_packages.py` sinh vào `mock/packages/` (git bỏ qua) bốn lớp nguồn `mock` (điểm, đường, vùng, lưới), một bản cập nhật, và các gói lỗi cố ý. `mock/packages/README.md` ghi lớp cần tạo và kết quả mong đợi của từng gói. Dữ liệu ngẫu nhiên, chỉ dùng trên máy dev.

## Thêm hoặc cập nhật một nguồn

1. **Chọn miền và mã nguồn:** viết thường, gạch ngang, ví dụ `osm`, `so-cong-thuong`, `qhtd-hanoi`.
2. **Tải về:** vào `raw/{mien}/{nguon}/{phien-ban}/`, không đổi tên field của file gốc. Viết biên bản snapshot, điền `quality` là `raw`.
3. **Chuẩn hóa:** cắt Hà Nội sang `interim`, rồi sang `processed`.
   - Phần không tự động được thì làm tay ở `interim`, ghi lại các bước.
   - Raster được tính ra lưới 100 m ở bước này.
4. **Chọn lớp:** nếu lớp chưa có trong database thì tạo trên `/admin/datasets` (mã, dạng hình học, khuôn, `usage`, câu ghi nguồn). Nguồn chưa rõ quyền thì để `usage = internal`.
5. **Đóng gói:** chạy `python3 tools/data/package_tool.py pack --layer … --label … --contract … --data … --source … --tool …` để ra `packages/{layer_code}/{label}/package.zip` và `catalog/packages/{layer_code}/{label}.json`. Có bước làm tay thì truyền `--manual-step "…"` (ghi vào `manualSteps`).
6. **Kiểm gói:** chạy `python3 tools/data/package_tool.py validate data/packages/{layer_code}/{label}/package.zip`, sửa tới khi không còn lỗi. Biên bản snapshot phải có `sha256` của file raw. Commit biên bản và manifest.
7. **Tải lên và lưu:** tải gói lên `/admin/datasets`, xem kiểm tra và khác biệt, rồi bấm Lưu. Sau đó tạo bản nháp và phát hành.
8. **Cập nhật tài liệu:** ghi nguồn mới vào [nguon-du-lieu.md](../workspace/features/000-ideas/nguon-du-lieu.md) nếu nó phục vụ một tiêu chí.

## Chuyển đổi từ cấu trúc cũ

`curated/` là giai đoạn cũ: gộp nhiều nguồn, nhập thẳng PostGIS. Không thêm file mới vào đó. `curated/places/2026-10-18/places.ndjson` sẽ được chuyển thành gói `osm.places/2026-10-18` bằng `tools/data/package_tool.py pack`, rồi xóa thư mục `curated/`.

Hai đường ghi cũ còn trong code và sẽ bỏ khi làm GĐ1 của 018:

- `tools/data/osm_places.py` ghi ra `curated/`. Sẽ đổi để ghi ra `processed/` theo khuôn `point@1`, rồi `pack`.
- `backend/scripts/import-places.ts` nạp thẳng vào `map_pois`. Sẽ bỏ hẳn: lớp bản đồ đọc `geo` theo bảng kê của bản hiện hành.
