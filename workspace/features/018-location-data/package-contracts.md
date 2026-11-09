# Khuôn gói dữ liệu chuẩn (018-location-data)

Mọi phiên bản lớp sinh ra từ một gói tải lên qua `/admin/datasets` ([research.md](research.md) Bản ghi 12). Tài liệu này là quy ước chung cho ba nơi:

- `python3 tools/data/package_tool.py pack` sinh gói;
- `python3 tools/data/package_tool.py validate` kiểm gói ở máy;
- module `ingest` của backend kiểm lại khi nhận.

Giá trị máy đọc được (giới hạn, regex, cột của từng khuôn, hộp Hà Nội, ngưỡng lệch) nằm ở một file:
`backend/src/modules/map/datasets/package-contracts.json`. Backend (`package-contracts.ts`) và `tools/data/package_tool.py` cùng đọc file này. Server là nơi quyết định cuối: kết quả `validate` ở máy chỉ giúp bắt lỗi sớm, server không tin nó.

Trường của manifest viết camelCase, giống JSON của API.

## 1. Gói

- **Định dạng:** file zip, gồm đúng các file sau ở gốc, không có thư mục con:

  | File | Bắt buộc | Nội dung |
  | --- | --- | --- |
  | `manifest.json` | Có | Mục 2 |
  | `data.csv` hoặc `data.geojsonl.gz` | Có | Theo khuôn (mục 3) |
  | `coverage.geojson` | Không | Đa giác vùng có dữ liệu. Không có thì dùng hộp Hà Nội |

- **Giới hạn:**
  - Gói tối đa 200 MB.
  - Tổng sau giải nén tối đa 1 GB.
  - Tỷ lệ nén tối đa 1:100.
  - Tối đa 3 mục trong zip.
  - Không chấp nhận symlink hay đường dẫn chứa `..` hoặc `/`.
- **Tên trên máy:** `data/packages/{layer_code}/{label}/package.zip`. Trên server, gói nằm ở kho S3 `datasets/packages/{layer_code}/{package_sha256}.zip`; tên file người gửi bị bỏ qua.
- **Đường tải:** trình duyệt xin phiếu (`POST /admin/map/imports/upload-tickets`), PUT thẳng gói lên `datasets/incoming/{uploadId}.zip` bằng URL ký sẵn, rồi nộp (`POST /admin/map/imports`). Backend tải gói về thư mục tạm, kiểm, chép sang chỗ cố định theo sha256 và xóa bản tạm.
- **Không ghi đè:**
  - Sửa bất cứ gì thì tạo `label` mới: `2026-11-01` sửa lại thành `2026-11-01-r2`.
  - `(layer_code, label)` là duy nhất.
  - `package_sha256` đã nhập rồi thì bị từ chối.

## 2. `manifest.json`

```json
{
  "contract": "point@1",
  "layer": "osm.places",
  "label": "2026-11-01",
  "sourceDate": "2026-11-01",
  "crs": "EPSG:4326",
  "sources": [
    {
      "catalog": "data/catalog/snapshots/places/osm/2026-11-01.json",
      "url": "https://download.geofabrik.de/asia/vietnam-latest.osm.pbf",
      "sha256": "…",
      "license": "ODbL-1.0"
    }
  ],
  "pipeline": { "tool": "tools/data/osm_places.py", "commit": "a1b2c3d", "dirty": false },
  "manualSteps": [],
  "rowCount": 12723,
  "categories": { "market": 412, "pharmacy": 2210 },
  "dataSha256": "…",
  "gridCode": null,
  "params": {},
  "notes": ""
}
```

| Trường | Quy tắc |
| --- | --- |
| `contract` | Khuôn server hỗ trợ: `point@1`, `line@1`, `area@1`, `grid@1` |
| `layer` | Phải có trong `geo.layers` và cùng `geometry_kind` với khuôn. Phần sau dấu chấm là **chủ đề** mà tiêu chí đọc: `places`, `roads`, `pop_100m`, `green_100m`, `flood_rp100`, `elev_100m` (backend `criteria.ts`) |
| `label` | `^[0-9A-Za-z][0-9A-Za-z._-]{0,39}$` |
| `crs` | `EPSG:4326`. Khuôn `line` và `area` chấp nhận thêm `EPSG:3405`, server đổi sang 4326. Không đoán hệ tọa độ |
| `sources` | Ít nhất 1. `catalog` trỏ tới biên bản đã commit trong `data/catalog/snapshots`; `license` bắt buộc |
| `pipeline.commit` | Commit của `tools/data`. `dirty: true` (có thay đổi chưa commit) là cảnh báo |
| `manualSteps` | Bắt buộc khi có bước làm tay, ví dụ "gán tọa độ 37 chợ theo địa chỉ, file làm việc `data/interim/places/so-cong-thuong/2026-11-01/geocode.xlsx`" |
| `rowCount`, `categories`, `dataSha256` | Server tính lại và so; lệch là lỗi chặn |
| `gridCode`, `params` | Chỉ khuôn `grid`: lưới đích và tham số đã dùng để tính (ví dụ `{"radius_m": 500}`). Tiêu chí không tự khai bán kính (Bản ghi 14) |

## 3. Bốn khuôn

Cột chung cho các khuôn đối tượng:

| Cột | Kiểu | Quy tắc |
| --- | --- | --- |
| `feature_key` | chuỗi ≤ 120 | Bắt buộc, duy nhất trong gói (trừ `area`). `nguồn:id` nếu nguồn có id; không có thì băm (category, tên chuẩn hóa, tọa độ làm tròn 10 m), theo Bản ghi 3 |
| `category` | `^[a-z][a-z_]{1,29}$` | Bắt buộc. Loại không có tiêu chí nào dùng là cảnh báo, không phải lỗi |
| `name` | chuỗi ≤ 200 | Có thể rỗng |
| `is_planned` | `true`/`false` | Mặc định `false` |
| `attrs` | object JSON ≤ 4 KB | Thuộc tính khác. Thêm khóa mới không cần đổi khuôn |

### `point@1` — `data.csv`

CSV UTF-8 có dòng tiêu đề, dấu phẩy, theo RFC 4180.

```csv
feature_key,category,kind,name,lat,lng,is_planned,attrs
osm:n123456,market,marketplace,Chợ Hôm,21.01522,105.85301,false,"{""opening_hours"":""05:00-19:00""}"
```

`lat` và `lng` là số thập phân trong hộp Hà Nội mở rộng 5 km.

### `line@1` — `data.geojsonl.gz`

GeoJSON Text Sequence (RFC 8142): mỗi dòng một `Feature`, nén gzip, nên server đọc dần được. Hình học là `LineString` hoặc `MultiLineString`.

Thuộc tính thêm:
- `road_class`: `motorway`, `trunk`, `primary`, `secondary`, `tertiary`, `residential` hoặc `alley`.
- `width_m`: số dương hoặc `null`.

### `area@1` — `data.geojsonl.gz` (GĐ2)

Như `line@1`, hình học là `Polygon` hoặc `MultiPolygon`.

Thuộc tính thêm:
- `code`, ví dụ mã loại đất `ODT`;
- `valid_from`, `valid_to` dạng `YYYY-MM-DD`.

Khi nạp, server chạy `ST_MakeValid` rồi `ST_Subdivide` (tối đa 256 đỉnh mỗi mảnh), nên không cần chia ở máy.

### `grid@1` — `data.csv`

```csv
cell_id,value
1834522,1532.4
1834523,
```

- `cell_id` phải nằm trong phạm vi của `gridCode`.
- `value` rỗng nghĩa là ô ngoài vùng phủ, không phải 0. Ô trong vùng phủ mà không có hiện tượng thì ghi `0` (ví dụ ô không ngập), nếu không tiêu chí sẽ báo "chưa có dữ liệu".
- Giá trị theo từng ô 100 m, không tính sẵn theo bán kính: bán kính là tham số của tiêu chí (research.md Bản ghi 15).
- Raster gốc (WorldPop, WorldCover, JRC, FABDEM) được tính ra lưới ở máy. Server không nhận GeoTIFF.

## 4. Đổi khuôn

- **Thêm khóa trong `attrs`:** không đổi khuôn.
- **Tăng số khuôn** (`point@2`) khi thêm cột bắt buộc, đổi nghĩa một cột, hoặc đưa một khóa `attrs` lên thành cột của bảng `geo`.
  - Server giữ bộ đọc của khuôn cũ cho tới khi không còn lớp nào khai khuôn đó.
  - Đổi khuôn của một lớp là sửa `geo.layers.contract` qua migration, kèm commit code.

## 5. Kiểm tra khi nhận

Server chạy các kiểm tra theo thứ tự dưới đây. Mã kiểm tra khớp với bảng trong [data-change-playbook.md](data-change-playbook.md).

1. **Gói:** `package_shape` (số mục, tên, giới hạn dung lượng và tỷ lệ nén), `package_duplicate`.
2. **Manifest:** `manifest_schema`, `layer_known`, `contract_supported`, `label_unique`.
3. **Dữ liệu:** `data_checksum`, `contract_columns`, `row_count_match`, `geometry_valid`, `inside_bbox`, `duplicate_key`.
4. **So với bản đang phát hành:** `row_count_delta`, `coverage_change`, `category_unused`.

## 6. Kho gói

| Nơi | Vai trò | Giữ bao lâu |
| --- | --- | --- |
| Kho S3 (bucket của 016-media-storage, tiền tố `datasets/packages/`, không có URL công khai) | **Bản gốc**: đúng file đã nạp | Gói từng thuộc bản `published`: giữ mãi. Gói bị bỏ hoặc fail: 30 ngày |
| `data/packages/` trên máy vận hành | Bản làm việc | Tùy người vận hành |
| `data/catalog/packages/{layer}/{label}.json` (git) | Bản sao manifest | Mãi mãi |
| Bản sao lưu ngoài server | Phòng mất volume | Như bản gốc |

Mất kho thì nạp lại từ bản sao lưu. Manifest trong git cho biết sha256 để đối chiếu.
