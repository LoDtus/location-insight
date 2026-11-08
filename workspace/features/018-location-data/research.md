# Nghiên cứu kỹ thuật — Dữ liệu nền và phiên bản dữ liệu (018)

Các dự án tham khảo (chỉ lấy mẫu hình, không thêm phụ thuộc mới):

| Dự án | Lấy gì | Không lấy gì |
| --- | --- | --- |
| [omniscale/imposm3](https://github.com/omniscale/imposm3) | Nhập vào schema `import`, kiểm xong mới "deploy" sang bảng chính, giữ bản `backup` để quay lại | Đổi schema cả khối: hai phiên bản không cùng truy vấn được |
| [osm2pgsql](https://github.com/osm2pgsql-dev/osm2pgsql) (flex output) | Cấu hình nhập theo file khai báo, mỗi lớp một bảng đích | Cập nhật liên tục theo phút: không cần với tiêu chí thay đổi theo tháng |
| [OvertureMaps](https://github.com/OvertureMaps) (GERS, release, changelog) | Bản phát hành có tên cố định, id ổn định qua các bản, changelog thêm/xóa/sửa, bảng nối id nguồn | Hạ tầng Parquet trên S3 |
| [dbt-labs/dbt-core](https://github.com/dbt-labs/dbt-core) | Tầng staging, intermediate, mart; kiểm tra dữ liệu chạy ngay sau mỗi model | Thêm công cụ dbt: pipeline hiện đã có Python và SQL |
| [great-expectations/great_expectations](https://github.com/great-expectations/great_expectations) | Kiểm tra chất lượng có mức chặn hoặc cảnh báo, lưu kết quả kiểm tra | Cài framework: vài chục câu SQL kiểm tra là đủ |
| [feast-dev/feast](https://github.com/feast-dev/feast) | Định nghĩa đặc trưng (tiêu chí) có phiên bản, ghim phiên bản khi phục vụ, tính trước (materialize) | Online store riêng |
| [koordinates/kart](https://github.com/koordinates/kart), [treeverse/lakeFS](https://github.com/treeverse/lakeFS), [iterative/dvc](https://github.com/iterative/dvc) | Phiên bản theo bản chụp có checksum, so khác biệt giữa hai bản | Kho phiên bản riêng: `data/catalog` + sha256 đã làm việc này |
| [radiantearth/stac-spec](https://github.com/radiantearth/stac-spec) | Mô tả raster bằng metadata: phạm vi, độ phân giải, ngày | Dựng máy chủ STAC |
| [UDST/pandana](https://github.com/UDST/pandana), [r5py](https://github.com/r5py/r5py) | Tính trước chỉ số tiếp cận lên lưới hoặc nút | Mạng định tuyến riêng: thời gian đi đã giao cho Vietmap |
| [uber/h3](https://github.com/uber/h3), [zachasme/h3-pg](https://github.com/zachasme/h3-pg) | Lưới ô có mã số nguyên, tra ô bằng một phép tính | Bắt buộc dùng H3 (xem Bản ghi 4) |

---

## Bản ghi quyết định 1 — Nơi chứa dữ liệu nền <!-- key: decision_record -->

**Status:** Accepted
**Category:** Technology Choice
**Door Type:** One-way (expensive to reverse)

### Bối cảnh <!-- key: context -->

Cần chỗ chứa điểm, đường, vùng và lưới cho Hà Nội, truy vấn theo bán kính trong vài mili giây cho mỗi lượt đánh giá. Postgres hiện chưa có PostGIS.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| PostGIS trong Postgres hiện có | Cao: cùng database, cùng backup | Cao | Trung bình | Chuẩn của imposm3, osm2pgsql. Chỉ đổi image |
| Đọc file GeoParquet/GeoTIFF trong backend | Thấp: Node xử lý không gian kém | Thấp | Cao | Không có chỉ mục không gian, phải tự làm |
| Lat/lng + Haversine (như `map_pois` hiện nay) | Cao | Cao | Cao | Ổn cho điểm, không làm được điểm-trong-vùng và khoảng cách tới đường |

### Quyết định <!-- key: decision -->

Dùng PostGIS, image `postgis/postgis` bản 17. Đây là cách các dự án tham khảo đều dùng, và là cách duy nhất làm được loại đất, ranh phường và khoảng cách tới đường ngay trong database.

### Hệ quả <!-- key: consequences -->

- Bảng dữ liệu nền nằm trong schema riêng `geo` và dùng migration SQL viết tay. TypeORM `synchronize` không hiểu kiểu `geography` và bảng phân vùng.
- Backend đọc `geo` bằng SQL thuần qua repository riêng.

### Khả năng đảo ngược <!-- key: reversibility -->

Dữ liệu nền dựng lại được từ kho gói chuẩn (Bản ghi 12). Bỏ PostGIS nghĩa là viết lại tầng truy vấn, nhưng kết quả đánh giá cũ không mất vì đã tự chứa số đo.

---

## Bản ghi quyết định 2 — Cách giữ nhiều phiên bản dữ liệu nền <!-- key: decision_record -->

**Status:** Superseded by Decision Record 8
**Category:** Data Migration
**Door Type:** One-way (expensive to reverse)

### Bối cảnh <!-- key: context -->

Khi nhập bản mới cần kiểm tra và chạy thử trước, phát hành không làm gián đoạn, thu hồi nhanh khi lỗi, và so được bản mới với bản cũ.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Đổi schema kiểu imposm3 (`import` → `public` → `backup`) | Trung bình | Cao | Chỉ một bản backup | Hai bản không cùng truy vấn được, khó chạy thử song song |
| Mỗi phiên bản một bảng (`places_2026_10_18`) | Thấp | Thấp: SQL động khắp nơi | Cao | Nhiều bảng, khó kiểm soát |
| Một bảng mỗi dạng hình học, cột `layer_version_id`, phân vùng LIST theo cột đó | Cao | Cao: SQL tĩnh, chỉ thêm điều kiện phiên bản | Cao | Xóa phiên bản cũ = `DROP` một phân vùng, nhanh và không phình bảng |
| Bảng lịch sử SCD2 (`valid_from`, `valid_to` từng dòng, kiểu dbt snapshot) | Trung bình | Trung bình | Cao | Hợp với dữ liệu sửa lẻ tẻ; nhập lại cả nguồn thì gần như mọi dòng đều đổi |

### Quyết định <!-- key: decision -->

Chọn phương án 3. Một bản phát hành là một bảng kê ghi mỗi lớp dùng phiên bản nào (như release của Overture). Truy vấn luôn lọc theo phiên bản trong bảng kê của bản phát hành đang dùng. Phát hành và thu hồi chỉ là đổi con trỏ, giống tinh thần "deploy" và "revert" của imposm3, nhưng hai phiên bản cùng tồn tại để chạy thử và so khác biệt.

### Hệ quả <!-- key: consequences -->

- Mỗi truy vấn đánh giá phải lấy `layer_version_id` từ bảng kê. Bảng kê được cache theo bản phát hành.
- Cần chính sách giữ lại (Bản ghi 6) để dung lượng không tăng mãi.
- Sửa tay một điểm đi qua một lớp sửa riêng (`feature_patches`), không sửa trực tiếp dữ liệu đã nhập.

### Khả năng đảo ngược <!-- key: reversibility -->

Đổi sang cách đổi schema chỉ cần nhập lại từ kho gói. Bảng kê và kết quả đánh giá giữ nguyên.

---

## Bản ghi quyết định 3 — Định danh ổn định cho đối tượng <!-- key: decision_record -->

**Status:** Accepted
**Category:** Data Migration
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Cần so khác biệt giữa hai bản (bao nhiêu chợ thêm, bớt), giữ được bản sửa tay qua lần nhập lại, và gộp hai nguồn cùng loại.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Chỉ dùng id của nguồn | Cao | Cao | Cao | Nguồn không có id (CSDL quy hoạch) thì đổi theo mỗi lần xuất |
| UUID cấp phát và đối chiếu không gian (kiểu GERS) | Thấp | Thấp: cần bảng đăng ký và thuật toán khớp | Thấp | Quá nặng cho một người |
| `feature_key` = `nguồn:id` nếu có; không có thì băm (loại, tên chuẩn hóa, tọa độ làm tròn 10 m) | Cao | Cao | Cao | Đủ để so khác biệt; dịch quá 10 m thì coi là xóa rồi thêm |

### Quyết định <!-- key: decision -->

Dùng `feature_key`. Đối tượng gộp từ nhiều nguồn giữ danh sách `feature_key` gốc trong `attrs.merged_from`, giống bảng nối id nguồn (bridge file) của Overture.

### Hệ quả <!-- key: consequences -->

Bản sửa tay gắn với `feature_key`. Nếu khóa đổi, bản sửa không còn khớp; lúc đó kiểm tra chất lượng báo cảnh báo "bản sửa mồ côi".

### Khả năng đảo ngược <!-- key: reversibility -->

Thêm cách định danh khác chỉ cần thêm cột.

---

## Bản ghi quyết định 4 — Dữ liệu dạng ô (raster) <!-- key: decision_record -->

**Status:** Accepted
**Category:** Performance & Scale
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Dân số, mảng xanh, ngập và độ cao vốn là raster. Tiêu chí cần các tổng hợp như "tổng dân số trong 500 m" hay "tỷ lệ phủ xanh trong 300 m".

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| `postgis_raster`, tính lúc truy vấn | Trung bình | Thấp: cú pháp raster khó, chậm với bán kính | Cao | |
| Tính trước trong Python, ghi giá trị theo ô lưới 100 m (vuông, EPSG:3405) | Cao | Cao | Cao | Tra một dòng. Giống cách pandana tính trước rồi tra |
| Tính trước theo ô H3 (độ phân giải 9, khoảng 175 m) | Trung bình: cần extension h3-pg | Trung bình | Cao | Ô thô hơn ngưỡng 300–500 m |

### Quyết định <!-- key: decision -->

Lưới vuông 100 m theo hệ VN-2000 / UTM 48N, cùng hệ với CSDL quy hoạch. `cell_id` là số nguyên ghép từ hàng và cột. Lưới định nghĩa một lần trong `geo.grids` nên đổi độ phân giải là một lưới mới, không sửa lưới cũ.

### Hệ quả <!-- key: consequences -->

Hà Nội khoảng 330 nghìn ô. Mỗi chỉ số là một phân vùng nhỏ. Sai số vị trí nhỏ hơn 71 m, chấp nhận được với các chỉ số đã là trung bình vùng.

### Khả năng đảo ngược <!-- key: reversibility -->

Thêm lưới H3 là thêm một dòng `geo.grids` và nhập lại.

---

## Bản ghi quyết định 5 — Phiên bản tiêu chí và ghim khi đánh giá <!-- key: decision_record -->

**Status:** Superseded by Decision Record 9
**Category:** New Architecture Pattern
**Door Type:** One-way (expensive to reverse)

### Bối cảnh <!-- key: context -->

Ngưỡng, cách đo, nguồn và trọng số mặc định của tiêu chí sẽ đổi. Kết quả cũ phải giải thích được theo định nghĩa lúc tính.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Giữ trong code, phiên bản theo commit | Cao | Cao | Thấp: không truy được kết quả cũ theo định nghĩa nào | Như hiện nay |
| Bảng `map_criteria` + `map_criterion_versions` không sửa, chỉ thêm; bản phát hành ghim phiên bản | Trung bình | Cao | Cao | Như cách Feast ghim phiên bản feature view |
| Lưu cả định nghĩa vào từng kết quả | Cao | Trung bình | Cao | Trùng dữ liệu nhiều |

### Quyết định <!-- key: decision -->

Chọn phương án 2. Code giữ **phương pháp** (hàm đo theo `method`), database giữ **tham số** (lớp đầu vào, bán kính, ngưỡng, thang điểm). Một phiên bản tiêu chí đã thuộc bản phát hành thì không sửa được nữa. Đổi gì cũng là tạo phiên bản mới ở bản nháp.

### Hệ quả <!-- key: consequences -->

- Thêm tiêu chí có phương pháp sẵn chỉ cần thêm dòng. Phương pháp mới vẫn cần code và deploy.
- Mỗi phương pháp kiểm `params` bằng schema (class-validator), không chấp nhận JSON tùy ý.

### Khả năng đảo ngược <!-- key: reversibility -->

Có thể sinh lại hằng số trong code từ bảng nếu cần quay về.

---

## Bản ghi quyết định 6 — Phát hành, thu hồi, giữ lại <!-- key: decision_record -->

**Status:** Superseded by Decision Record 8 (phần giữ lại và dọn) — phần "thu hồi bằng bản mới" vẫn giữ
**Category:** Data Migration
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Cần quy tắc cho số phiên bản, việc thu hồi, và dọn dữ liệu cũ.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Sửa lại bản đang chạy khi lỗi | Cao | Cao | Thấp: mất dấu kết quả đã tính | Loại |
| Quay lui = tạo bản mới chép bảng kê của bản tốt trước đó, đánh dấu bản lỗi `withdrawn` | Cao | Cao | Cao | Số phiên bản luôn tăng, lịch sử không bị viết lại |

### Quyết định <!-- key: decision -->

- Số phát hành là số nguyên tăng dần, mở rộng từ `map_dataset_versions`.
- Không xóa hay sửa bản đã phát hành. Thu hồi là tạo bản mới chép bảng kê cũ.
- Giữ dữ liệu nền của bản hiện hành, bản liền trước và các bản nháp; phiên bản lớp không còn bản nào trỏ tới sau 30 ngày thì `DROP` phân vùng.
- Kết quả đánh giá tự chứa số đo và bằng chứng nên không phụ thuộc dữ liệu nền cũ.

### Hệ quả <!-- key: consequences -->

Kết quả tính trên bản đã thu hồi được gắn nhãn "dữ liệu đã thu hồi, nên đánh giá lại".

### Khả năng đảo ngược <!-- key: reversibility -->

Đổi số ngày giữ lại là đổi cấu hình.

---

## Bản ghi quyết định 7 — Dữ liệu biến động và kết quả từ bên ngoài <!-- key: decision_record -->

**Status:** Accepted
**Category:** Integration Feasibility
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Không khí đổi theo giờ, thời gian đi qua Vietmap đổi theo giao thông, kết luận AI đổi theo tin tức. Các nguồn này không nằm gọn trong một bản phát hành.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Gói vào bản phát hành | Thấp | Thấp: phải phát hành mỗi giờ | Cao | Loại |
| Ngoài bản phát hành; số đo ghi thời điểm quan sát và hạn dùng (`expires_at`) | Cao | Cao | Cao | Giống point-in-time của Feast: biết giá trị đúng tại lúc nào |

### Quyết định <!-- key: decision -->

Chọn phương án 2.
- Không khí ghi vào `geo.env_observations`, phân vùng theo tháng, giữ 90 ngày.
- Thời gian đi Vietmap chỉ lưu giá trị đã suy ra (số phút, nhà cung cấp, thời điểm gọi), không lưu nguyên văn phản hồi.
- AI ghi kèm `prompt_version`, `model` và nguồn trích dẫn.

### Hệ quả <!-- key: consequences -->

Kết quả có tiêu chí hết hạn hiển thị "số đo cũ" và cho đo lại riêng tiêu chí đó, không phải tính lại cả phiếu.

### Khả năng đảo ngược <!-- key: reversibility -->

Đổi thời hạn là đổi tham số tiêu chí.

---

## Bản ghi quyết định 8 — Thu gọn lưu trữ cho giai đoạn đầu và sống chung với TypeORM <!-- key: decision_record -->

**Status:** Accepted — Supersedes Decision Record 2 và phần giữ lại/dọn của Decision Record 6. Phần nhập (`catalog_paths`, `source_sha256`), seed sau `/reset` và role `geo_loader` được sửa bởi Decision Record 12
**Category:** Data Migration
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Khi rà lại bản đầu so với mã nguồn, thấy bốn vấn đề:

1. `map_dataset_versions`, `map_places` và `map_place_analyses` là entity do TypeORM `synchronize` quản lý. Nếu thêm cột bằng SQL tay, `synchronize` có thể xóa các cột đó.
2. `/reset` gọi `dropDatabase()` rồi `synchronize()`. Theo `PostgresQueryRunner.clearDatabase`, TypeORM chỉ dọn schema mà entity dùng và `current_schema()`, tức là `public`. Schema `geo` còn nguyên, nhưng khóa ngoại từ `geo` sang `public` bị `CASCADE` xóa mất.
3. Khoảng 15 enum Postgres: thêm giá trị phải `ALTER TYPE`, và TypeORM xử lý enum kém.
4. Khối lượng thật nhỏ: OSM 16 nghìn điểm, loại đất 13 nghìn vùng, lưới khoảng 2 triệu ô, khoảng 12–15 bản phát hành một năm. Phân vùng theo phiên bản không đáng với độ phức tạp nó thêm vào.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Giữ bản đầu (phân vùng, enum, khóa ngoại chéo schema, bảng nguồn) | Thấp: đụng synchronize và /reset | Thấp | — | |
| Bảng thường + `layer_version_id`; varchar + CHECK; không khóa ngoại chéo schema; bảng kê dạng `jsonb` trong `map_dataset_versions` | Cao | Cao | Cao: thêm phân vùng hoặc bảng kê dạng bảng sau được | |

### Quyết định <!-- key: decision -->

Chọn phương án 2:

- **`geo`:** migration SQL chạy lặp được (`IF NOT EXISTS`), không có entity. Backend đọc bằng SQL tham số hóa.
- **`public`:** cột mới khai báo trong entity. Unique partial index "chỉ một draft" tạo bằng SQL idempotent trong service, như `messaging-schema.service.ts` đang làm.
- **Không có khóa ngoại giữa `geo` và `public`:** service kiểm `layer_manifest` trỏ tới phiên bản lớp có `status = ready`.
- **Không có enum Postgres.**
- **Một lớp = (nguồn, chủ đề, dạng hình học):** ví dụ `osm.places`, `osm.roads`. Loại tiện ích là cột `category`, nên một lần nhập OSM chỉ ra một phiên bản lớp `osm.places`.
- **Hai nguồn cùng loại thì thành hai lớp:** ví dụ `osm.places` và `qhtd.places`. Tiêu chí khai cả hai trong `inputs` và gộp trùng (dưới 40 m) lúc đo. Không trộn vào một lớp, vì giấy phép khác nhau (ODbL và internal). Phần `merged_from` nhiều nguồn ở Bản ghi 3 được thay bằng cách này.
- **Không có bảng nguồn và snapshot:** `layer_versions` ghi `catalog_paths` và `source_sha256`, trỏ tới `data/catalog` sẵn có.
- **Dọn bằng `DELETE`:** phiên bản lớp `retired` thì xóa đối tượng, giữ dòng phiên bản. Không dọn lớp thuộc bản hiện hành, bản liền trước hoặc bản draft.
- **Seed sau `/reset`:** nếu `geo` có phiên bản lớp `ready`, tạo bản phát hành 1 từ phiên bản `ready` mới nhất của mỗi lớp cùng định nghĩa tiêu chí hiện tại. Nếu không có, giữ chế độ mẫu như hiện nay. Seed không gỡ lớp bảo vệ nào của `/reset`.

### Hệ quả <!-- key: consequences -->

- Bảng kê dạng `jsonb` vẫn trả lời được câu "bản nào còn trỏ tới phiên bản lớp X" bằng `jsonb_each_text`.
- Mất khả năng `DROP PARTITION` tức thì, chấp nhận được với khối lượng hiện tại.
- Những gì để sau ghi trong `future-schema.md`.

### Khả năng đảo ngược <!-- key: reversibility -->

- Thêm phân vùng: tạo bảng phân vùng mới rồi `INSERT … SELECT`.
- Đổi bảng kê sang dạng bảng: đọc `jsonb` ra dòng.

---

## Bản ghi quyết định 9 — Định nghĩa tiêu chí trong code, bản chụp trong bản phát hành <!-- key: decision_record -->

**Status:** Accepted — Supersedes Decision Record 5
**Category:** New Architecture Pattern
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Bản ghi 5 đưa tiêu chí vào database để admin sửa, kéo theo schema kiểm tra cho từng method, API sửa và trạng thái frozen. Thực tế người đổi ngưỡng là dev, và việc này hiếm. Điều thật sự cần là truy được kết quả cũ đã tính theo định nghĩa nào.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Bảng `map_criteria` + `map_criterion_versions` (Bản ghi 5) | Trung bình | Thấp ở giai đoạn này | Cao | |
| Định nghĩa trong code; lúc tạo bản phát hành chụp định nghĩa vào `criteria_snapshot` + `criteria_hash` | Cao: giống `CRITERIA` đang có | Cao: review qua git, test được | Cao | |

### Quyết định <!-- key: decision -->

Chọn phương án 2.

- `CRITERIA` trong code có thêm `inputs` (code lớp), `params` và `scoring`.
- Đánh giá luôn dùng `criteria_snapshot` của bản đã ghim, không dùng hằng số đang chạy. Nhờ vậy bản rollback tính đúng theo định nghĩa cũ.
- Đổi định nghĩa thì `criteria_hash` khác, kèm theo việc phải tạo bản phát hành `kind = criteria`.
- Backend khởi động kiểm: mọi `method` trong snapshot của bản hiện hành đều được hỗ trợ.

### Hệ quả <!-- key: consequences -->

- Admin không chỉnh ngưỡng trên giao diện. Muốn chỉnh thì sửa code và phát hành.
- Thêm tiêu chí dùng method có sẵn vẫn không cần đổi schema, nhưng cần deploy.

### Khả năng đảo ngược <!-- key: reversibility -->

Chuyển sang bảng (`future-schema.md`) bằng cách đọc `criteria_snapshot` của bản hiện hành làm phiên bản 1.

---

## Bản ghi quyết định 10 — Mô hình chấm điểm và mục tiêu hiệu năng <!-- key: decision_record -->

**Status:** Accepted
**Category:** Performance & Scale
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Bản đầu chưa nói rõ cách quy số đo ra điểm, cách gộp điểm tổng khi thiếu dữ liệu, và thời gian cho phép của một lượt đánh giá.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Quy số đo ra điểm theo bậc thang | Cao | Cao | Cao | Nhảy điểm đột ngột ở ranh bậc |
| Tuyến tính giữa ngưỡng tốt và xấu, kẹp 0–10 (như `place-evaluation.ts`) | Cao | Cao | Cao | Liên tục, dễ giải thích |
| Truy vấn: mỗi tiêu chí một câu SQL | Cao | Cao | Cao | Khoảng 20 lượt gọi DB |
| Truy vấn: gộp các tiêu chí `nearest` và `count` vào một câu `LATERAL` | Cao | Trung bình | Cao | 1–3 lượt gọi DB |

### Quyết định <!-- key: decision -->

- **Quy ra điểm:** `scoring = {direction, good, bad}`, tuyến tính, kẹp 0–10. Tiêu chí dạng mã (loại đất) dùng bảng `codes → điểm`.
- **Kết luận:** điểm lớn hơn 6 là `strong`, nhỏ hơn 4 là `weak`, còn lại `neutral`. `no_data` thì `unknown`.
- **Điểm tổng:** Σ(trọng số × điểm) / Σ trọng số. Chỉ tính các tiêu chí `ok` hoặc `fallback` có `confidence` từ `medium` trở lên. Kèm `coverage`; dưới 60% thì báo cáo ghi "dữ liệu mỏng, điểm tổng chỉ để tham khảo".
- **Truy vấn:** gộp `nearest` và `count` thành một câu `LATERAL` cho mỗi dạng hình học; tra lưới bằng một câu `WHERE cell_id = ANY(…)`.
- **Mục tiêu:** p95 dưới 300 ms khi không gọi Vietmap. Mỗi câu đánh giá đặt `statement_timeout` 2 s.

### Hệ quả <!-- key: consequences -->

Ngưỡng 4 và 6 cùng hệ số trọng số nằm trong `criteria_snapshot`, nên đổi là một bản phát hành `kind = criteria`.

### Khả năng đảo ngược <!-- key: reversibility -->

Đổi công thức chỉ là đổi code và phát hành. Kết quả cũ giữ điểm đã tính.

---

## Bản ghi quyết định 11 — Chia giai đoạn <!-- key: decision_record -->

**Status:** Accepted — bảng giai đoạn cập nhật trong Decision Record 12
**Category:** New Architecture Pattern
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Bản đầu có 26 bảng và 15 endpoint, trong khi chưa có tiêu chí nào tính từ dữ liệu thật.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Làm trọn đặc tả một lần | Thấp | Thấp | — | Nhiều tuần trước khi có điểm thật đầu tiên |
| Ba giai đoạn, giữ ba nguyên tắc gốc (không sửa dữ liệu đã nhập, ghim bản, có vùng phủ) từ đầu | Cao | Cao | Cao | |

### Quyết định <!-- key: decision -->

| Giai đoạn | Nội dung | Bảng |
| --- | --- | --- |
| **GĐ1 — có điểm thật** | PostGIS; nhập OSM (điểm, đường) và WorldPop; tiêu chí tiện ích, đường lớn, nội đô, dân số; bản phát hành có bảng kê và bản chụp tiêu chí; số đo theo tiêu chí; kiểm tra chất lượng trong script | `geo.layers`, `geo.layer_versions`, `geo.point_features`, `geo.line_features`, `geo.area_features`, `geo.grids`, `geo.grid_values`, `map_place_measurements` + cột mới trong `map_dataset_versions`, `map_place_analyses` |
| **GĐ2 — vận hành an toàn, thêm nguồn** | Script điểm mẫu; thu hồi; loại đất và yếu tố bất lợi từ CSDL quy hoạch; `DuongBo` (bề rộng); ô WorldCover và JRC còn thiếu; Vietmap Reverse và Matrix | Không bảng mới; thêm cột `ward_code`, `street_name`, `expires_at` |
| **GĐ3 — khi có nhu cầu** | Theo `future-schema.md` | |

### Hệ quả <!-- key: consequences -->

`interfaces/rest-api.yml` chỉ có các thao tác của GĐ1–2.

### Khả năng đảo ngược <!-- key: reversibility -->

Mỗi giai đoạn chỉ thêm, không viết lại giai đoạn trước.

---

## Bản ghi quyết định 12 — Một đường ghi duy nhất: gói chuẩn tải lên qua UI <!-- key: decision_record -->

**Status:** Accepted — sửa phần nhập, seed và quyền của Decision Record 8; thay bảng giai đoạn của Decision Record 11
**Category:** New Architecture Pattern
**Door Type:** One-way (expensive to reverse)

### Bối cảnh <!-- key: context -->

- Dữ liệu thô rất đa dạng và bất quy tắc: GDB hơn 300 lớp ở hệ VN-2000, DGN, PDF, raster nhiều ô, danh sách không có tọa độ. Một người vận hành chấp nhận làm tay phần này.
- Đặc tả trước cho `tools/data` ghi thẳng vào `geo` bằng role `geo_loader`. Cách đó để lại ba vấn đề:
  - Phải mở cổng Postgres production ra ngoài, hoặc dựng dữ liệu ở máy dev rồi tìm cách chuyển lên.
  - Có hai đường ghi: script và backend.
  - Không có chỗ nào giữ đúng thứ đã được nạp.
- Người dùng muốn **cấm hẳn việc ghi trực tiếp** vào database hay backend. Mọi dữ liệu nền phải qua `/admin/datasets`, được kiểm tra rồi mới lưu.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| `tools/data` ghi thẳng `geo` (đặc tả trước) | Trung bình | Trung bình | Cao | Hai đường ghi, phải mở cổng database, không có kho gói |
| UI nhận file thô, worker Python trên server tự xử lý từng nguồn | Thấp: thêm container và GDAL trên server | Thấp: mỗi nguồn một bộ chuyển trên server | Trung bình | Không xử lý được GDB, DGN, PDF; đọc file độc hại bằng GDAL trên server là rủi ro |
| **UI nhận gói đã chuẩn hóa theo 4 khuôn; NestJS kiểm tra và nạp bằng PostGIS** | Cao: chỉ NestJS + PostGIS | Cao: một bộ nạp cho mỗi dạng hình học | Cao | Phần bất quy tắc làm ở máy; server chỉ hiểu khuôn |

### Quyết định <!-- key: decision -->

Chọn phương án 3. Mọi phiên bản lớp sinh ra từ đúng một gói tải lên qua UI. Các ràng buộc:

**Gói và khuôn** (chi tiết ở [package-contracts.md](package-contracts.md)):
- Gói là file zip gồm `manifest.json` và một file dữ liệu theo khuôn `point@1`, `line@1`, `area@1` hoặc `grid@1`.
- Manifest ghi nguồn gốc: biên bản catalog, sha256 file raw, giấy phép, commit của script và các bước làm tay.
- Raster (WorldPop, WorldCover, JRC, FABDEM) được tính ra lưới ở máy rồi tải lên bằng khuôn `grid@1`.
- `tools/data/package_tool.py pack` sinh gói, `validate` kiểm gói ở máy. Giá trị khuôn viết một lần trong `backend/src/modules/map/datasets/package-contracts.json`, Python và TypeScript cùng đọc.

**Kiểm tra xong mới lưu (hai bước):**
1. Tải lên → nạp vào schema `geo_staging` (bảng `UNLOGGED`) → chạy kiểm tra và tính khác biệt so với phiên bản đang phát hành.
2. Admin xem kết quả rồi bấm "Lưu" thì chép sang `geo` trong một transaction, phiên bản thành `ready`. Bấm "Bỏ" thì xóa staging.
- Kiểm tra chặn fail thì không có nút "Lưu". Có cảnh báo thì phải ghi lý do.
- Gói có `package_sha256` đã nhập rồi thì bị từ chối.

**Chỉ một đường ghi, chặn ở database chứ không chỉ quy ước:**
- **Role:**
  - GĐ1 (đã làm): trigger cùng cờ phiên giao dịch `geo.write_mode`. Mọi `INSERT` vào bảng đối tượng cần `SET LOCAL geo.write_mode = 'ingest'` và phiên bản đang `building`; `DELETE` cần cờ `purge`; `UPDATE` và `TRUNCATE` luôn bị chặn. Cách này chặn được cả khi backend kết nối bằng role chủ database như hiện nay.
  - Khi triển khai production: tách thêm role `app_reader` (chỉ `SELECT` trên `geo`, không thấy `geo_staging`) và `geo_ingest` (chỉ module datasets dùng), xem `future-schema.md`.
- **Trigger:**
  - Chặn `INSERT` vào phiên bản không ở `building`.
  - Chặn `UPDATE` phiên bản `ready`, trừ khi chuyển sang `retired`.
  - Chặn đổi `layer_manifest` và `criteria_snapshot` của bản phát hành không còn `draft`.
- **Phát hiện ghi lén:**
  - `content_hash` (sha256 các dòng sắp theo `feature_key`) được tính lúc `ready`.
  - Một job hằng tuần tính lại; lệch thì báo admin và chặn phát hành mọi bản dùng phiên bản đó.
  - Superuser vẫn vượt được mọi chặn. Điều đảm bảo được là việc đó **bị phát hiện**.
- **Mã nguồn:**
  - Một test kiến trúc làm fail nếu có câu `INSERT`, `UPDATE` hay `DELETE` vào `geo.` nằm ngoài `backend/src/modules/map/ingest`.
  - `tools/data` không còn chuỗi kết nối database. Bỏ role `geo_loader`.
- **Áp dụng cả trên máy dev:** trigger chặn như production; dữ liệu dev cũng tải qua UI. Seed sau `/reset` chỉ dựng lại bản phát hành 1 từ các phiên bản `ready` còn trong `geo`, không chèn dữ liệu bằng SQL tay. Không gỡ lớp bảo vệ nào của `/reset`.

**Kho gói là bản gốc, database là bản sao để truy vấn:**
- Server lưu gói vào kho S3 sẵn có theo `datasets/packages/{layer_code}/{sha256}.zip`, không ghi đè.
- Máy vận hành giữ bản làm việc ở `data/packages`.
- Manifest được commit vào `data/catalog/packages/`.
- Gói từng thuộc một bản đã phát hành thì giữ mãi. Gói bị bỏ hoặc fail thì xóa sau 30 ngày.
- Sao lưu kho gói ra ngoài server.
- Phiên bản lớp đã `retired` được khôi phục từ gói, giữ nguyên id, nên bảng kê cũ vẫn đúng.

**Ba ngoại lệ không đi qua gói**, vì chúng không phải dữ liệu nền:
1. Số đo gọi API lúc đánh giá (Vietmap).
2. Chuỗi thời gian theo giờ (OpenAQ, GĐ3), do job nền ghi.
3. Dữ liệu người dùng (địa điểm đã lưu, trọng số, chỉnh tay) và kết quả đánh giá.

**Bảng giai đoạn cập nhật (thay Decision Record 11):**

| Giai đoạn | Nội dung |
| --- | --- |
| GĐ1 | PostGIS; khuôn `point@1`, `line@1`, `grid@1` (đã làm thêm `area@1`); trang tải gói, staging, lưu; kho gói; trigger chặn ghi; OSM điểm và đường, WorldPop; tiêu chí tiện ích, đường lớn, nội đô, dân số; bản phát hành; số đo theo tiêu chí; điểm mẫu tự chạy lúc phát hành (Decision Record 14) |
| GĐ2 | Khuôn `area@1` (loại đất, yếu tố bất lợi từ CSDL quy hoạch); DuongBo; ô WorldCover và JRC còn thiếu; khôi phục phiên bản từ gói; job kiểm `content_hash`; Vietmap Reverse và Matrix |
| GĐ3 | Theo `future-schema.md` |

### Hệ quả <!-- key: consequences -->

- **Không cần:** worker Python, bộ tự tải nguồn hay cron trên server. Cập nhật OSM hằng tháng là chạy `pack` ở máy rồi tải lên.
- **Server không bao giờ đọc định dạng thô** (GDB, DGN, PDF, PBF).
- **Tải file lên mở ra rủi ro mới** (zip bomb, path traversal, gói giả manifest). Xem threat model T13–T18.
- **Nguồn gốc trong manifest là lời khai.** Server không kiểm được file raw, chỉ kiểm được gói khớp sha256 đã commit trong git.
- **Thêm lớp mới cùng dạng hình học** thì tạo dòng `geo.layers` trên UI, không cần code. **Cần code** khi có tiêu chí mới, method mới, khuôn mới, hoặc đưa một thuộc tính trong `attrs` lên thành cột (khuôn `@2`).

### Khả năng đảo ngược <!-- key: reversibility -->

- Gói là đơn vị độc lập. Đổi cách nạp (ví dụ thêm worker) không đổi gói.
- Bỏ đường UI thì phải cấp lại quyền ghi cho một role script. Đây là một chiều về mặt bảo mật, nên ghi là One-way.

---

## Bản ghi quyết định 13 — Tổ chức thư mục `data` theo lớp, không theo tiêu chí <!-- key: decision_record -->

**Status:** Accepted
**Category:** Data Migration
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

- Người dùng muốn sắp lại `data/` và cân nhắc gom thư mục theo tiêu chí chấm.
- `data/README.md` hiện có giai đoạn `curated`: gộp trùng giữa các nguồn, "để nhập PostGIS". Điều này trái với quy tắc hai nguồn là hai lớp (Decision Record 8).

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Thư mục theo tiêu chí | Thấp | Thấp | Cao | Nguồn và tiêu chí quan hệ nhiều–nhiều (OSM phục vụ khoảng 12 tiêu chí; chợ dùng 2 nguồn), nên phải nhân bản file; tiêu chí đổi nhanh hơn nguồn |
| Giữ `curated` gộp nhiều nguồn | Trung bình | Trung bình | Cao | Trái quy tắc giấy phép; không khớp đơn vị nhập là lớp |
| **`raw`, `interim`, `processed` theo nguồn; `packages` theo mã lớp; bản đồ tiêu chí sinh tự động** | Cao | Cao | Cao | Thư mục khớp với thứ database quản lý |

### Quyết định <!-- key: decision -->

- `data/packages/{layer_code}/{label}/package.zip` thay cho `curated`. **Mỗi gói là một phiên bản của một lớp, không phải một tiêu chí.**
- `data/catalog/packages/{layer_code}/{label}.json` là bản sao manifest, được commit.
- `data/catalog/criteria-map.md` do script sinh từ `CRITERIA.inputs` (tiêu chí → lớp → nguồn). Không sửa tay.
- Gộp trùng trong cùng một nguồn (nút và vùng OSM của cùng một chợ) làm ở bước `processed → package`. Gộp giữa các nguồn để lúc đo.
- Bỏ `catalog/current.json`. Bản đang dùng là bản phát hành trong database.

### Hệ quả <!-- key: consequences -->

- Thư mục `data/curated/places/2026-10-18` hiện có sẽ được chuyển thành gói `osm.places` khi chạy `tools/data/package_tool.py pack` cho bản đó.
- Bốn miền (`places`, `transport`, `environment`, `admin`) vẫn dùng cho `raw`, `interim` và `processed` để dễ tìm file.

### Khả năng đảo ngược <!-- key: reversibility -->

Chỉ là cách sắp thư mục trên máy. Dời lại bằng script.

---

## Bản ghi quyết định 14 — Bổ sung cho tiêu chí và chấm điểm sau khi rà hạn chế <!-- key: decision_record -->

**Status:** Accepted — bổ sung Decision Record 9 và 10
**Category:** New Architecture Pattern
**Door Type:** Two-way (cheap to reverse)

### Bối cảnh <!-- key: context -->

Khi rà thiết kế, thấy năm chỗ có thể làm sai kết quả mà không ai biết:

1. `criteria_snapshot` chụp tham số nhưng không chụp **cách tính**. Sửa câu SQL của `nearest` thì cả bản rollback cũng tính theo code mới.
2. Tham số của tiêu chí lưới (bán kính 500 m) bị buộc ngầm vào dữ liệu đã tính sẵn. Sửa `radius_m` không đổi dữ liệu và không báo lỗi.
3. Chưa có quy tắc gán `confidence`, trong khi điểm tổng và danh sách mạnh/yếu đều lọc theo nó.
4. Điểm tổng là trung bình, nên một lô ngập sâu vẫn đạt điểm cao nhờ gần chợ.
5. Màn so sánh có thể đặt cạnh nhau các lượt đánh giá ghim bản khác nhau. Bước điểm mẫu là thủ công nên dễ bị bỏ qua.

### Các phương án đã xem xét <!-- key: options_considered -->

| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
| --- | --- | --- | --- | --- |
| Ghi thành giới hạn đã biết | Cao | Cao | Cao | Sai lặng lẽ vẫn xảy ra |
| **Thêm vài trường vào `CRITERIA`, snapshot và kiểm tra lúc phát hành; không thêm bảng** | Cao | Cao | Cao | |

### Quyết định <!-- key: decision -->

- **Phiên bản method:**
  - Mỗi method có số phiên bản trong code (`nearest@1`). Snapshot ghi `method` cùng `method_version`.
  - Đổi kết quả của method thì tăng số. Code của phiên bản cũ giữ lại chừng nào còn bản `published` dùng nó; kiểm tra `method_supported` so khớp cả số phiên bản.
  - `lineage` ghi thêm commit của backend.
- **Tiêu chí lưới chỉ trỏ mã lớp** (`worldpop.pop_500m`), không có tham số bán kính. Bán kính là thuộc tính của lớp, ghi trong manifest.
- **Độ tin:** mỗi tiêu chí khai `base_confidence`. Hạ một bậc khi:
  - đo bằng phương án dự phòng (`fallback`);
  - số đối tượng tìm thấy dưới `min_support` của tiêu chí;
  - lớp có cảnh báo đã được chấp nhận lúc lưu.
- **Điều kiện chặn:**
  - Tiêu chí có thể khai `blocking: {when, cap}`, ví dụ ngập chu kỳ 100 năm sâu hơn 1 m thì điểm tổng tối đa là 4.
  - Lúc đọc, điểm tổng bị giới hạn ở mức `cap`, và điều kiện chặn đứng đầu báo cáo.
  - Số đo lưu cờ `blocking_hit`.
- **Một bảng kê cho mọi tiêu chí và lớp bản đồ:**
  - Tiêu chí chỉ khai mã lớp, không ghim phiên bản riêng.
  - Một lượt đánh giá chỉ đọc một bản phát hành.
  - Lớp bản đồ cũng đọc theo bảng kê của bản hiện hành, thay cho việc nạp `map_pois` riêng.
- **Điểm mẫu tự chạy lúc phát hành:**
  - Backend đánh giá các điểm trong `backend/src/modules/map/golden-points.json` (commit git) theo bản nháp và theo bản hiện hành.
  - Vi phạm `expectations` thì chặn phát hành. Bảng chênh lệch lưu vào `map_dataset_versions.golden_report`.
- **So sánh khác bản:** màn so sánh cảnh báo khi các cột có `dataset_version` khác nhau, và có nút "Đánh giá lại tất cả theo bản hiện hành".

### Hệ quả <!-- key: consequences -->

- **Không thêm bảng.** Thêm cột `golden_report` và `checks`, cùng các cột `method_version` và `blocking_hit` trong số đo.
- **Phát hành chậm hơn khoảng 15 giây** (khoảng 50 điểm × 300 ms).
- **Giới hạn đã biết (chấp nhận ở GĐ1–2, phải hiện trong báo cáo):**
  - Khoảng cách tính theo đường chim bay cho tới khi có thời gian đi thật.
  - Một bộ ngưỡng cho cả thành phố.
  - Gộp trùng giữa nguồn lúc đo nên bản đồ và báo cáo có thể lệch số đếm.
  - Rủi ro ODbL với dữ liệu phái sinh khi phân phối công khai.

### Khả năng đảo ngược <!-- key: reversibility -->

Mọi thứ nằm trong code và cột `jsonb`. Bỏ một quy tắc là sửa code và phát hành bản `kind = criteria`.
