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

Dữ liệu nền dựng lại được từ `data/curated`. Bỏ PostGIS nghĩa là viết lại tầng truy vấn, nhưng kết quả đánh giá cũ không mất vì đã tự chứa số đo.

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

Đổi sang cách đổi schema chỉ cần nhập lại từ `curated`. Bảng kê và kết quả đánh giá giữ nguyên.

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

**Status:** Accepted — Supersedes Decision Record 2 và phần giữ lại/dọn của Decision Record 6
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

**Status:** Accepted
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
