# 018 — Dữ liệu nền cho phân tích vị trí và phiên bản dữ liệu

**Feature ID:** 018-location-data
**Status:** In Review
**Last Updated:** 08/11/2026

## Tổng quan <!-- key: overview -->

Đây là kiến trúc database và quy trình để biến dữ liệu thô (OSM, WorldPop, WorldCover, JRC, CSDL quy hoạch Thủ đô…) thành số đo cho từng tiêu chí tại một tọa độ.

**Một đường ghi duy nhất:**
- Phần bất quy tắc được xử lý ở máy vận hành, kể cả làm tay, rồi đóng thành **gói chuẩn** theo 4 khuôn.
- Gói được tải lên `/admin/datasets`, kiểm tra trong vùng tạm, và chỉ vào database khi admin bấm "Lưu".
- Không có cách ghi dữ liệu nền nào khác.

**Hai lớp phiên bản:**
- **Phiên bản lớp:** sinh từ đúng một gói. Gói được giữ trong kho làm bản gốc.
- **Bản phát hành:** bảng kê ghi mỗi lớp dùng phiên bản nào, cộng bản chụp định nghĩa tiêu chí lấy từ code.

Mỗi lượt đánh giá ghim một bản phát hành. Mọi tiêu chí và lớp bản đồ dùng chung bảng kê đó.

Làm theo ba giai đoạn ([research.md](research.md) Bản ghi 12). Đặc tả này chi tiết cho GĐ1 và GĐ2; phần GĐ3 ở [future-schema.md](future-schema.md).

## Mục tiêu & Phạm vi <!-- key: goals_scope -->

**Trong phạm vi (GĐ1–2):**

- **Gói chuẩn và kho gói:** 4 khuôn `point@1`, `line@1`, `area@1` (GĐ2), `grid@1`. Manifest ghi nguồn gốc. Xem [package-contracts.md](package-contracts.md).
- **Nhập qua UI:** tải gói, nạp vào `geo_staging`, kiểm tra, xem khác biệt, rồi Lưu hoặc Bỏ. Tạo lớp mới trên UI.
- **Chặn ghi ngoài đường nhập:** role, trigger, `content_hash`, test kiến trúc.
- **Schema `geo` (PostGIS):** điểm, đường, vùng, lưới. Mỗi dòng gắn `layer_version_id`.
- **Bản phát hành:** `map_dataset_versions` thêm bảng kê lớp, bản chụp tiêu chí, kết quả kiểm tra và điểm mẫu. Có luồng nháp, phát hành, thu hồi; khôi phục phiên bản đã dọn từ gói.
- **Kết quả đo:** mỗi tiêu chí một dòng, có nguồn gốc. Có phiên bản method, quy tắc độ tin, điều kiện chặn, mục tiêu hiệu năng.
- **Sổ tay tình huống:** [data-change-playbook.md](data-change-playbook.md).

**Ngoài phạm vi:**

- Mọi thứ trong `future-schema.md`: tiêu chí trong database, sửa tay đối tượng qua UI, tự tải nguồn định kỳ, benchmark, AI, không khí, phân vùng.
- Đọc định dạng thô (GDB, DGN, PDF, PBF, GeoTIFF) trên server.
- Mã chuẩn hóa chi tiết của từng nguồn, giao diện admin chi tiết.
- Mở rộng ngoài Hà Nội, giá thị trường, quy hoạch theo thửa.

## Đối tượng liên quan <!-- key: actors -->

- **Người vận hành dữ liệu (ở máy):** tải nguồn, chuẩn hóa (có thể làm tay), chạy `tools/data pack` và `validate`. Không có quyền ghi database.
- **Admin (trên `/admin/datasets`):** tải gói, xem kiểm tra, Lưu hoặc Bỏ; tạo lớp; tạo bản nháp; phát hành, thu hồi, khôi phục.
- **Người dùng:** đánh giá tọa độ, so sánh, đánh giá lại khi có bản mới.
- **Job nền:** dọn phiên bản cũ, kiểm `content_hash`, xóa staging và gói bị bỏ.
- **Hệ thống ngoài (GĐ2):** Vietmap Reverse và Matrix.

## Yêu cầu chức năng <!-- key: functional_requirements -->

- **FR-01 (Đóng gói ở máy):** `tools/data pack` sinh `package.zip` (manifest + dữ liệu theo khuôn). `tools/data validate` kiểm tra bằng `contracts/*.schema.json`, cùng bộ quy tắc với server. Manifest được chép vào `data/catalog/packages/` để commit.
- **FR-02 (Tải gói):** admin tải gói lên. Server:
  - kiểm hình dạng zip và manifest;
  - từ chối gói trùng `package_sha256` hoặc trùng `(layer, label)`;
  - lưu gói vào kho theo sha256, chỉ đọc;
  - tạo `geo.import_jobs`.

  Mỗi lúc chỉ một job được kiểm tra hoặc lưu.
- **FR-03 (Kiểm tra trong staging):** đọc dần dữ liệu vào `geo_staging`, chạy kiểm tra mức lớp, tính `diff_summary` so với phiên bản trong bản hiện hành, lấy 20 dòng mẫu. Kết quả là `validated` hoặc `rejected`.
- **FR-04 (Lưu hoặc Bỏ):**
  - **Lưu:** trong một transaction, chép sang `geo` và tính `content_hash`; phiên bản thành `ready`. Có cảnh báo thì phải ghi lý do.
  - **Bỏ:** xóa staging. Job `validated` quá 7 ngày không quyết thì tự bỏ.
- **FR-05 (Lớp):** admin tạo lớp (mã, dạng hình học, khuôn, nguồn, `usage`, ghi nguồn). Sau khi tạo, chỉ sửa được `usage`, ghi nguồn và mô tả. Đổi `usage` phải kèm lý do.
- **FR-06 (Bản nháp):** chép bảng kê từ bản hiện hành, hoặc từ `base_version` khi thu hồi, rồi thay phiên bản cho từng lớp. Chỉ nhận phiên bản `ready` có `integrity_ok` không phải `false`. Mỗi lúc chỉ một bản nháp.
- **FR-07 (Phát hành):** khóa dòng bản nháp rồi chạy kiểm tra mức bản (playbook). Sau đó chạy điểm mẫu tự động (`golden-points.json`), so bản nháp với bản hiện hành và ghi `golden_report`. Vi phạm `expectations` thì chặn. Trong một transaction:
  - chụp `CRITERIA` vào `criteria_snapshot` (kèm `method_version`) và tính `criteria_hash`;
  - ghi `backend_commit`;
  - đặt `status = published`;
  - xóa cache.
- **FR-08 (Thu hồi):** tạo bản `kind = rollback`, chép bảng kê và snapshot của bản tốt, phát hành ngay. Bản lỗi chuyển sang `withdrawn` kèm lý do.
  - Có phiên bản đã `retired`: trả `BASE_LAYER_RETIRED`.
  - `method_version` không còn được hỗ trợ: chặn.
- **FR-09 (Khôi phục, GĐ2):** phiên bản `retired` được nạp lại từ gói trong kho qua import job `purpose = restore`, giữ nguyên id. Gói mất hoặc lệch sha256 thì báo lỗi.
- **FR-10 (Đánh giá):** lấy bảng kê và snapshot của bản hiện hành (cache Redis theo `version`) rồi đo theo `method@version`. Mỗi tiêu chí ghi một dòng `map_place_measurements`:
  - kèm `lineage` (phiên bản lớp, `backend_commit`), `confidence`, `blocking_hit`;
  - ngoài `coverage` thì `no_data`.
- **FR-11 (Chấm điểm):** theo Bản ghi 10 và 14:
  - tuyến tính giữa ngưỡng tốt và xấu;
  - kết luận mạnh, trung tính, yếu;
  - điểm tổng tính lúc đọc từ trọng số người dùng, giới hạn ở `cap` khi có điều kiện chặn, kèm `coverage`.
- **FR-12 (Lớp bản đồ):** API lớp bản đồ đọc `geo.point_features` theo bảng kê của bản hiện hành, chỉ lớp `public`. `map_pois` ngừng được ghi; bỏ khi code GĐ1 xong, cùng script `backend/scripts/import-places.ts` (đường ghi thẳng cũ).
- **FR-13 (So sánh):** màn so sánh cảnh báo khi các địa điểm ghim bản phát hành khác nhau, và có nút đánh giá lại tất cả theo bản hiện hành.
- **FR-14 (Dọn):** phiên bản lớp không có trong bảng kê của bản hiện hành, bản liền trước hoặc bản nháp, và đã như vậy quá 30 ngày, thì:
  - chuyển `retired`;
  - xóa đối tượng qua hàm dọn, rồi `VACUUM`;
  - gói vẫn giữ trong kho.

  Gói của job bị bỏ hoặc fail thì xóa sau 30 ngày.
- **FR-15 (Toàn vẹn, GĐ2):** job hằng tuần tính lại `content_hash` của các phiên bản `ready`. Lệch thì đặt `integrity_ok = false`, báo admin, chặn phát hành.
- **FR-16 (Sau `/reset`):** seed gọi service nhập với gói mẫu trong `backend/test/fixtures/packages/` khi `geo` trống, rồi tạo bản phát hành 1 từ phiên bản `ready` mới nhất mỗi lớp.
- **FR-17 (Báo dữ liệu mới):** khi phát hành, người dùng có địa điểm đã lưu nhận thông báo.
- **FR-18 (Vietmap, GĐ2):** Reverse lấy phường và tên đường. Matrix lấy thời gian đi cho tiêu chí `travel_time`; hết ngân sách thì đo bằng `nearest` với `status = fallback`.

## Quy tắc nghiệp vụ <!-- key: business_rules -->

- **BR-01 (Một đường ghi):** dữ liệu nền chỉ vào `geo` qua import job đã `validated` và được admin Lưu. Không SQL tay, không script ghi thẳng, kể cả trên máy dev. Ngoại lệ không phải dữ liệu nền:
  - số đo Vietmap lúc đánh giá;
  - chuỗi thời gian (GĐ3);
  - dữ liệu người dùng và kết quả đánh giá.
- **BR-02 (Bất biến):** không sửa gói, đối tượng hay phiên bản đã `ready`. `layer_manifest`, `criteria_snapshot` và `criteria_hash` không đổi sau khi rời `draft`. Database chặn bằng trigger.
- **BR-03 (Gói là bản gốc):** mỗi phiên bản lớp trỏ tới đúng một gói theo `package_sha256`. Gói từng thuộc bản `published` thì giữ mãi. Sửa gì cũng là `label` mới.
- **BR-04 (Một gói là một phiên bản của một lớp):** không phải một tiêu chí. Một gói chỉ chứa một nguồn.
- **BR-05 (Một bảng kê cho tất cả):** tiêu chí chỉ khai mã lớp. Một lượt đánh giá chỉ đọc một bản phát hành. Lớp bản đồ theo cùng bảng kê.
- **BR-06 (Ghim):** đánh giá chỉ dùng bảng kê và snapshot của bản đã ghim. Kết quả cũ không tự cập nhật.
- **BR-07 (Không có dữ liệu khác với bằng 0):** ngoài `coverage` thì `no_data`, `verdict = unknown`, không vào điểm tổng.
- **BR-08 (Độ tin):** `confidence` bằng `base_confidence` của tiêu chí, hạ một bậc khi:
  - dùng phương án dự phòng;
  - số đối tượng dưới `min_support`;
  - lớp có cảnh báo đã chấp nhận.

  Điểm mạnh, yếu nổi bật và điểm tổng chỉ tính tiêu chí có độ tin từ `medium` trở lên.
- **BR-09 (Điều kiện chặn):** tiêu chí khai `blocking` thì khi xảy ra, điểm tổng bị giới hạn ở `cap` và điều kiện đứng đầu báo cáo.
- **BR-10 (Phiên bản method):** đổi kết quả của một method thì tăng `method_version`. Code của phiên bản cũ giữ lại chừng nào còn bản `published` dùng nó.
- **BR-11 (Ưu tiên nguồn đo):** đo nội bộ trước, Vietmap sau. AI để GĐ3.
- **BR-12 (Điểm tổng):** tính lúc đọc, không lưu.
- **BR-13 (Dữ liệu `internal`):** không trả đối tượng ra API công khai. `evidence` chỉ ghi loại và khoảng cách. Kho gói không phục vụ qua HTTP.
- **BR-14 (Giữ lại):** không dọn lớp thuộc bản hiện hành, bản liền trước hoặc bản nháp.
- **BR-15 (Số phiên bản):** tăng dần, không tái sử dụng. Thu hồi luôn tạo số mới.
- **BR-16 (Đổi tiêu chí):** sửa `CRITERIA` chỉ có hiệu lực sau khi phát hành bản `kind = criteria`.

## Tóm tắt luồng người dùng <!-- key: user_flow_summary -->

1. **Ở máy:** người vận hành tải nguồn, viết biên bản catalog, chuẩn hóa (có thể làm tay), chạy `pack` và `validate`, commit manifest.
2. **Tải và lưu:** trên `/admin/datasets`, admin tải gói lên. Hệ thống kiểm tra trong vùng tạm và hiện kiểm tra, khác biệt, dòng mẫu. Admin bấm Lưu (ghi lý do nếu có cảnh báo) hoặc Bỏ.
3. **Phát hành:** admin tạo bản nháp, chọn phiên bản lớp mới, bấm Phát hành. Kiểm tra mức bản và điểm mẫu chạy tự động; đạt thì bản mới thành hiện hành. Người dùng có địa điểm đã lưu nhận thông báo.
4. **Đánh giá:** người dùng đánh giá một tọa độ. Backend đo theo bảng kê bằng 1–3 câu SQL (và Vietmap ở GĐ2), rồi trả điểm mạnh, yếu và điều kiện chặn.
5. **Khi có lỗi:** admin thu hồi về bản tốt trước đó trong một bước, khôi phục phiên bản đã dọn từ kho gói nếu cần.

## Bối cảnh kỹ thuật <!-- key: technical_context -->

- **PostGIS:** đổi image sang `postgis/postgis` bản 17, giữ volume cũ. Bản ghi 1.
- **Một đường ghi:** Bản ghi 12.
  - Module `backend/src/modules/map/ingest` nhận multipart, đọc dần (stream) dữ liệu, `COPY` vào `geo_staging` (UNLOGGED). PostGIS lo hình học (`ST_GeomFromGeoJSON`, `ST_MakeValid`, `ST_Transform`, `ST_Subdivide`).
  - Không có worker Python trên server.
  - Quy tắc khuôn viết một lần ở `contracts/*.schema.json`, Python và TypeScript cùng dùng.
- **Quyền database:**
  - `app_reader` chỉ `SELECT` trên `geo`.
  - `geo_ingest` chỉ module `ingest` dùng: `INSERT`, không `UPDATE`; `DELETE` qua hàm dọn.
  - Bỏ `geo_loader`. Chuỗi kết nối và mật khẩu role chỉ nằm trong `.env*` gốc.
- **Trigger:** chặn ghi vào phiên bản không ở `building`, chặn sửa phiên bản `ready`, chặn sửa bản phát hành không còn `draft`. Trigger trên bảng `map_*` tạo bằng SQL idempotent trong service, giống `messaging-schema.service.ts`.
- **Kho gói:** volume `data-packages` (không vào git), tên theo sha256, chỉ đọc. Sao lưu ra ngoài server. Bản làm việc ở `data/packages/{layer_code}/{label}/`. Bản ghi 13.
- **Hai cách quản lý schema:**
  - `geo` và `geo_staging` dùng migration SQL chạy lặp được.
  - `map_*` dùng entity TypeORM.
  - Không có khóa ngoại giữa hai vùng, không dùng enum Postgres. Bản ghi 8.
- **`/reset`:** `geo` giữ nguyên sau reset. Seed theo FR-16. Không gỡ lớp bảo vệ nào của `/reset`.
- **Lớp và định danh:** lớp là (nguồn, chủ đề, dạng hình học); loại tiện ích là cột `category`; khóa đối tượng là `feature_key`, tính ở máy. Bản ghi 3 và 8.
- **Raster:** tính ra lưới 100 m (EPSG:3405) ở máy, tải lên bằng khuôn `grid@1`. Bán kính là thuộc tính của lớp. Bản ghi 4 và 14.
- **Tiêu chí:** trong code, kèm `method_version`, `base_confidence`, `min_support` và `blocking`; bản phát hành giữ bản chụp. Bản ghi 9 và 14.
- **Chấm điểm và hiệu năng:** p95 dưới 300 ms khi không gọi Vietmap; `LATERAL`; `statement_timeout` 2 s. Phát hành lâu hơn khoảng 15 giây vì điểm mẫu. Bản ghi 10.

## Phụ thuộc <!-- key: dependencies -->

- `013-map`:
  - mở rộng `map_dataset_versions`, `map_place_analyses` và màn so sánh;
  - thay luồng phát hành một bước;
  - lớp bản đồ đọc `geo` thay `map_pois`.
- `004-rbac`: quyền `admin:access`.
- `014-notification`: thông báo có dữ liệu mới.

## Ràng buộc <!-- key: constraints -->

- Một người vận hành; không thêm kho dữ liệu, framework ETL hay worker trên server.
- Byte dữ liệu và gói không vào git; chỉ biên bản catalog và manifest gói được commit.
- Không đưa bí mật vào repo; biến môi trường chỉ ở `.env*` gốc; không dùng `any`; kiểm tra đầu vào (gồm file tải lên) theo `.cursor/rules/security.md`.
- Kết quả cũ không tự đổi. `/reset` chỉ dành cho máy dev, không gỡ lớp bảo vệ.
- **Giới hạn đã biết ở GĐ1–2, phải hiện cho người dùng hoặc admin:**
  - Superuser vẫn ghi được vào `geo`; chỉ phát hiện được, trễ tối đa 1 tuần.
  - Nguồn gốc trong manifest là lời khai.
  - Khoảng cách tính theo đường chim bay cho tới khi có thời gian đi thật.
  - Một bộ ngưỡng cho cả thành phố.
  - Gộp trùng giữa nguồn lúc đo nên số đếm trên bản đồ và báo cáo có thể lệch.
  - Chỉ một admin, không có người duyệt thứ hai.
  - Rủi ro ODbL với dữ liệu phái sinh khi phân phối công khai.

## Tài liệu liên quan (Artifacts) <!-- key: artifacts -->

- **Idea:** [location-data-idea.md](location-data-idea.md)
- **Technical Research:** [research.md](research.md), 14 bản ghi quyết định; bản ghi 2, 5 và một phần bản ghi 6, 8, 11 đã bị thay.
- **Khuôn gói:** [package-contracts.md](package-contracts.md)
- **Database:**
  - [postgresql.dbml](postgresql.dbml) (GĐ1–2)
  - [future-schema.md](future-schema.md) (GĐ3)
- **Diagrams:**
  - [diagrams/erd-location-data.mmd](diagrams/erd-location-data.mmd)
  - [diagrams/flow-data-release.mmd](diagrams/flow-data-release.mmd)
  - [diagrams/flow-rollback.mmd](diagrams/flow-rollback.mmd)
  - [diagrams/sequence-evaluation.mmd](diagrams/sequence-evaluation.mmd)
  - [diagrams/state-import-job.mmd](diagrams/state-import-job.mmd)
  - [diagrams/state-layer-version.mmd](diagrams/state-layer-version.mmd)
  - [diagrams/state-dataset-release.mmd](diagrams/state-dataset-release.mmd)
- **API Contracts:** [interfaces/rest-api.yml](interfaces/rest-api.yml) (admin, GĐ1–2)
- **Sổ tay tình huống:** [data-change-playbook.md](data-change-playbook.md)
- **Threat model:** [threat-model.md](threat-model.md)
- **Kho dữ liệu:** [data/README.md](../../../data/README.md)

## Tiêu chí nghiệm thu (Acceptance Criteria) <!-- key: acceptance_criteria -->

- [ ] **AC-01:** Given bản 5 là bản hiện hành và có một lượt đánh giá đã ghim bản 5, When phát hành bản 6 với OSM mới, Then lượt cũ vẫn trả đúng số đo cũ, còn đánh giá lại thì `dataset_version = 6`.
- [ ] **AC-02:** Given gói có `row_count_delta` lệch 30%, When tải lên, Then job `rejected`, không có nút Lưu và `geo` không có dòng mới.
- [ ] **AC-03:** Given bản 6 bị lỗi, When admin thu hồi về bản 5, Then bản 7 (`kind = rollback`) có `layer_manifest` và `criteria_snapshot` trùng bản 5, bản 6 chuyển `withdrawn`, mất dưới 1 phút và không phải nhập lại dữ liệu.
- [ ] **AC-04:** Given sửa ngưỡng hiệu thuốc trong code và deploy, When chưa phát hành bản mới, Then đánh giá vẫn dùng ngưỡng cũ trong `criteria_snapshot`.
- [ ] **AC-05:** Given ghim nằm ngoài `coverage` của lớp mảng xanh, When đánh giá, Then tiêu chí ra `no_data`, `verdict = unknown` và không vào điểm tổng.
- [ ] **AC-06:** Given `geo` có phiên bản lớp `ready`, When chạy `/reset` trên máy dev, Then `geo` còn nguyên và có bản phát hành 1 dựng từ các phiên bản đó. Given `geo` trống, Then gói mẫu được nạp qua service nhập.
- [ ] **AC-07:** Given mỗi dòng `map_place_measurements` mới, Then `lineage` liệt kê đủ `layer_versions` đã dùng (đều nằm trong bảng kê của bản đã ghim) và `backend_commit`.
- [ ] **AC-08:** Given đánh giá một tọa độ ở nội thành với dữ liệu GĐ1, Then p95 dưới 300 ms khi không gọi Vietmap.
- [ ] **AC-09 (GĐ2):** Given Vietmap hết ngân sách, When đánh giá tiêu chí `travel_time`, Then kết quả dùng `nearest` với `status = fallback` và `confidence` giảm một bậc.
- [ ] **AC-10:** Given lớp có `usage = internal`, When gọi API lớp bản đồ hoặc đọc `evidence`, Then không thấy tên hay hình học đối tượng của lớp đó.
- [ ] **AC-11:** Given kết nối database bằng role `app_reader` hoặc `geo_ingest`, When chạy `UPDATE geo.point_features …`, Then bị từ chối. Given phiên bản `ready`, When `INSERT` thêm đối tượng vào phiên bản đó, Then trigger từ chối.
- [ ] **AC-12:** Given có câu `INSERT INTO geo.` ngoài module `ingest`, When chạy test, Then test kiến trúc fail.
- [ ] **AC-13:** Given gói đã nhập, When tải lại đúng gói đó, Then trả `PACKAGE_DUPLICATE`. Given zip có mục `../x` hoặc tỷ lệ nén trên 1:100, Then trả `PACKAGE_SHAPE_INVALID` và không giải nén ra ngoài thư mục tạm.
- [ ] **AC-14:** Given điểm mẫu có `expectations` "chợ gần nhất dưới 300 m = strong", When bản nháp làm điểm đó thành `weak`, Then phát hành bị chặn với `GOLDEN_FAILED` kèm `golden_report`.
- [ ] **AC-15 (GĐ2):** Given phiên bản `ready` bị `UPDATE` bằng superuser, When job toàn vẹn chạy, Then `integrity_ok = false` và bản nháp chứa phiên bản đó không phát hành được.
- [ ] **AC-16 (GĐ2):** Given bản 3 có phiên bản lớp đã `retired`, When khôi phục từ kho rồi thu hồi về bản 3, Then phiên bản được nạp lại với đúng id, `content_hash` như cũ.
- [ ] **AC-17:** Given tiêu chí ngập có `blocking.cap = 4` và ghim nằm trong vùng ngập sâu, When đánh giá, Then điểm tổng không quá 4 và điều kiện chặn hiện đầu báo cáo.
- [ ] **AC-18:** Given hai địa điểm ghim bản 5 và bản 6, When mở màn so sánh, Then có cảnh báo khác bản và nút đánh giá lại.

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

- Có tự đánh giá lại các địa điểm đã lưu khi có bản mới không? Đề xuất: chỉ thông báo.
- Chọn những điểm nào cho `golden-points.json` (khoảng 50 điểm: nội thành, ven đô, ngoại thành, khu bãi sông)? GĐ1 cần tối thiểu 10 điểm.
- Sao lưu kho gói ở đâu: ổ ngoài hay kho lưu trữ đám mây (cần mã hóa vì có dữ liệu `internal`)?
- Điều khoản Vietmap cho phép lưu tên đường và phường lấy từ Reverse trong bao lâu (GĐ2)?
- Dữ liệu phái sinh từ OSM kết hợp dữ liệu nội bộ có bị coi là cơ sở dữ liệu phái sinh theo ODbL không? Cần hỏi người hiểu giấy phép trước khi mở công khai.

## Nhật ký cập nhật <!-- key: update_log -->

- **Bản đầu:** kiến trúc 3 tầng phiên bản, 26 bảng, 7 bản ghi quyết định, sổ tay 25 tình huống.
- **Rà lại theo mã nguồn và chia giai đoạn (Bản ghi 8–11):**
  - Sửa ba lỗi: xung đột với TypeORM `synchronize`, khóa ngoại chéo schema bị `/reset` xóa, enum Postgres.
  - Tiêu chí chuyển về code, bản phát hành giữ bản chụp.
  - Bỏ phân vùng, bảng nguồn và bước `staged`.
  - Thêm mô hình chấm điểm và mục tiêu hiệu năng.
- **Một đường ghi qua gói chuẩn, và các bổ sung sau khi rà hạn chế (Bản ghi 12–14):**
  - Mọi dữ liệu nền vào qua gói tải lên `/admin/datasets`, có staging, rồi admin Lưu.
  - Chặn ghi ngoài đường nhập bằng role, trigger, `content_hash` và test kiến trúc.
  - Kho gói là bản gốc, khôi phục phiên bản đã dọn từ gói.
  - `data/` tổ chức theo lớp, `packages` thay `curated`.
  - Thêm phiên bản method, quy tắc độ tin, điều kiện chặn, điểm mẫu tự chạy, cảnh báo so sánh khác bản; lớp bản đồ theo bảng kê.
  - Thêm bảng `geo.import_jobs` và schema `geo_staging`; API có thêm 8 route; sổ tay có 31 tình huống; threat model có T13–T18.
