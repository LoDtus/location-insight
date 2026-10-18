# Kho dữ liệu

Chỗ chứa dữ liệu tải về của Location Insight. API không đọc các file này. API đọc PostGIS sau khi bản curated đã được nhập.

Byte dữ liệu không vào git. Git chỉ giữ khung thư mục, file hướng dẫn này, và biên bản nhập ở `catalog/`. Quy tắc nằm trong `.gitignore`.

## Bốn giai đoạn

Dữ liệu đi một chiều. Không sửa file ở giai đoạn trước để vá lỗi của giai đoạn sau.

| Giai đoạn | Ý nghĩa | Được sửa nội dung | Dùng để |
| --- | --- | --- | --- |
| `raw` | Đúng byte vừa tải | Không | Tải lại và đối soát nguồn |
| `interim` | Cắt Hà Nội, đổi định dạng, vẫn schema của nguồn | Có, vì làm lại được từ raw | Giảm dung lượng trước khi chuẩn hóa |
| `processed` | Một schema chung, mỗi nguồn một tệp, chưa gộp trùng | Có, vì làm lại được từ interim | So chất lượng từng nguồn |
| `curated` | Đã gộp trùng, có độ tin, đúng thứ báo cáo cần | Có, vì làm lại được từ processed | Nhập PostGIS |

Gộp trùng chỉ xảy ra ở `curated`. Hai điểm cùng loại, cách nhau dưới 40 m, là một chỗ. Quy tắc đầy đủ nằm trong [nguon-du-lieu.md](../workspace/features/000-ideas/nguon-du-lieu.md).

`interim` và `processed` xóa được. `raw` giữ hai bản mới nhất với nguồn tải hàng ngày, và một bản với nguồn tĩnh (cao độ, ngập sông, dân số). `curated` chỉ giữ bản đang nhập vào database.

## Bốn miền

Tiêu chí mới thêm thư mục nguồn bên trong miền có sẵn. Chỉ thêm miền khi dữ liệu không thuộc bốn nhóm này.

| Miền | Việc chứa | Tiêu chí |
| --- | --- | --- |
| `places` | Điểm tiện ích | Chợ, nhà thuốc, siêu thị, quán ăn, trường, bệnh viện, công viên, văn phòng, vật tư |
| `transport` | Đường và giao thông công cộng | Đường lớn, cấp đường, vỉa hè, xe buýt, metro, khoảng cách sân bay |
| `environment` | Lưới và trạm đo | Dân số, không khí, cao độ, ngập, mảng xanh |
| `admin` | Đơn vị và văn bản | UBND, ranh phường, bảng giá đất nhà nước |

Mốc cố định (Hồ Gươm, sân bay Nội Bài) không cần file. Ghi tọa độ trong cấu hình backend.

## Tên thư mục và phiên bản

```text
data/{giai-doan}/{mien}/{nguon}/{phien-ban}/
```

`phien-ban` là ngày tải `YYYY-MM-DD`. Nếu nguồn có mã phát hành ổn định hơn ngày tải, dùng mã đó: `fabdem/v1-0`, `worldpop/R2025A`.

Ví dụ:

```text
data/raw/places/osm/2026-10-18/vietnam-latest.osm.pbf
data/interim/places/osm/2026-10-18/hanoi.osm.pbf
data/processed/places/osm/2026-10-18/places.parquet
data/curated/places/2026-10-18/places.parquet
```

`curated` không chia theo nguồn vì các nguồn đã gộp. Vẫn chia theo miền, rồi một phiên bản.

Mỗi phiên bản có một biên bản ở `catalog/snapshots/{mien}/{nguon}/{phien-ban}.json`. File mẫu là [snapshot.example.json](catalog/snapshot.example.json). Biên bản ghi URL, checksum, số bản ghi, giấy phép, và lỗi đã biết. Đó là phần theo dõi được commit.

`catalog/current.json` trỏ tới phiên bản đang dùng của từng nguồn. Tạo file này khi lần nhập đầu tiên xong. Mẫu là [current.example.json](catalog/current.example.json).

## Git

Commit được: `README.md`, `.gitkeep`, file trong `catalog/` có đuôi `.json`, `.yaml`, `.yml`, `.md`.

Không commit: `.pbf`, GeoTIFF, GeoParquet, Excel, GTFS, JSON thu từ trang web, và mọi file nằm trong `raw`, `interim`, `processed`, `curated`.

Volume Postgres đã bị bỏ qua riêng. Không copy database vào đây.

## Thêm một nguồn

1. Chọn miền. Nguồn chợ là `places`, nguồn ga metro là `transport`.
2. Đặt mã nguồn ngắn, viết thường, gạch ngang: `osm`, `overture-places`, `long-chau`, `foody`, `timbus`.
3. Tải vào `raw/{mien}/{nguon}/{phien-ban}/`. Không đổi tên field của file gốc.
4. Viết biên bản snapshot. Điền `quality` thành `raw`.
5. Cắt Hà Nội sang `interim`, chuẩn hóa sang `processed`, rồi mới gộp vào `curated` của miền đó.
6. Cập nhật `catalog/current.json` khi bản curated đã được nhập PostGIS.
7. Ghi nguồn mới vào [nguon-du-lieu.md](../workspace/features/000-ideas/nguon-du-lieu.md) nếu nó phục vụ một tiêu chí.

Schema chung của `processed` và `curated` cho dữ liệu điểm:

| Cột | Ý nghĩa |
| --- | --- |
| `source` | Mã nguồn |
| `source_id` | Id gốc, nếu có |
| `name` | Tên hiển thị |
| `category` | Mã tiêu chí: `market`, `pharmacy`, `supermarket`, `convenience`, `restaurant`, `school`, `hospital`, `clinic`, `park`, `hardware`, `office`, `bus_stop`, `metro_station`, `townhall` |
| `lon`, `lat` | WGS84 |
| `address` | Địa chỉ chữ, có thể trống |
| `retrieved_at` | Ngày của phiên bản |
| `coord_confidence` | `measured` nếu nguồn có tọa độ, `geocoded` nếu suy từ địa chỉ |

Dữ liệu lưới (cao độ, dân số, mảng xanh, ngập sông) không ép vào schema điểm. Giữ GeoTIFF ở `processed`, và ở `curated` chỉ để lại raster đã cắt, cùng hệ tọa độ, cùng khung Hà Nội.

Không khí và điểm ngập theo giờ ghi thẳng vào bảng PostGIS. Không nhân bản thành file trong `curated`. Vẫn lưu bản tải thô trong `raw/environment/` nếu cần đối soát.
