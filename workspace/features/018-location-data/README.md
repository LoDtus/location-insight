# 018 — Dữ liệu nền cho phân tích vị trí và phiên bản dữ liệu

**Feature ID:** 018-location-data
**Status:** In Review
**Last Updated:** 08/11/2026

## Tổng quan <!-- key: overview -->

Đây là kiến trúc database và quy trình để biến dữ liệu thô (OSM, WorldPop, WorldCover, JRC, CSDL quy hoạch Thủ đô…) thành số đo cho từng tiêu chí tại một tọa độ. Có hai lớp phiên bản:

- **Phiên bản lớp:** dữ liệu của một lớp, dựng từ các biên bản trong `data/catalog`.
- **Bản phát hành:** bảng kê ghi mỗi lớp dùng phiên bản nào, cộng bản chụp định nghĩa tiêu chí lấy từ code.

Mỗi lượt đánh giá ghim một bản phát hành. Nhờ vậy kết quả luôn giải thích được, và dữ liệu mới không làm đổi kết quả cũ.

Làm theo ba giai đoạn ([research.md](research.md) Bản ghi 11). Đặc tả này chi tiết cho GĐ1 và GĐ2; phần GĐ3 nằm ở [future-schema.md](future-schema.md).

## Mục tiêu & Phạm vi <!-- key: goals_scope -->

**Trong phạm vi (GĐ1–2):**

- **Schema `geo` (PostGIS):** điểm, đường, vùng, lưới. Mỗi dòng gắn `layer_version_id`.
- **Bản phát hành:** `map_dataset_versions` mở rộng thêm bảng kê lớp (`layer_manifest`) và bản chụp tiêu chí (`criteria_snapshot`). Có luồng nháp, phát hành, thu hồi.
- **Kết quả đo:** mỗi tiêu chí một dòng, có nguồn gốc (`lineage`). Có mô hình chấm điểm và mục tiêu hiệu năng.
- **Kiểm tra và chạy thử:** kiểm tra chất lượng và điểm mẫu chạy bằng script trong `tools/data`.
- **Sổ tay tình huống:** [data-change-playbook.md](data-change-playbook.md).

**Ngoài phạm vi:**

- Mọi thứ trong `future-schema.md`: tiêu chí trong database, sửa tay đối tượng, benchmark, AI, không khí, phân vùng.
- Mã ETL chi tiết của từng nguồn, giao diện admin chi tiết.
- Mở rộng ngoài Hà Nội, giá thị trường, quy hoạch theo thửa.

## Đối tượng liên quan <!-- key: actors -->

- **Người vận hành dữ liệu:** chạy `tools/data` để dựng phiên bản lớp, rồi chạy script điểm mẫu.
- **Admin:** tạo bản nháp, chọn phiên bản lớp, phát hành hoặc thu hồi.
- **Người dùng:** đánh giá tọa độ, đánh giá lại khi có bản mới.
- **Job nền:** dọn phiên bản lớp cũ.
- **Hệ thống ngoài (GĐ2):** Vietmap Reverse và Matrix.

## Yêu cầu chức năng <!-- key: functional_requirements -->

- **FR-01 (Dựng phiên bản lớp):** `tools/data` đối chiếu sha256 với biên bản catalog, tạo `geo.layer_versions` ở trạng thái `building`, COPY đối tượng vào, tính `feature_key` và `diff_summary`, chạy kiểm tra rồi ghi vào `checks`. Kết quả là `ready` nếu không có kiểm tra chặn nào fail, ngược lại là `failed`.
- **FR-02 (Bản nháp):** admin tạo bản nháp. Bảng kê được chép từ bản hiện hành, hoặc từ `base_version` khi thu hồi, rồi thay phiên bản cho từng lớp (chỉ nhận phiên bản `ready`). Mỗi lúc chỉ có một bản nháp.
- **FR-03 (Phát hành):** lúc bấm, hệ thống kiểm tra:
  - mọi `inputs` của tiêu chí đều có lớp trong bảng kê;
  - mọi lớp đều `ready` và không có nguồn `blocked`;
  - mọi `method` đều được backend hỗ trợ.

  Sau đó hệ thống chụp `CRITERIA` từ code vào `criteria_snapshot` và tính `criteria_hash`. Trong một transaction: `status = published`, rồi xóa cache bản hiện hành. Nếu có cảnh báo, admin phải ghi lý do.
- **FR-04 (Thu hồi):** tạo bản `kind = rollback`, chép bảng kê và `criteria_snapshot` của bản tốt, phát hành ngay. Bản lỗi chuyển sang `withdrawn` kèm lý do.
- **FR-05 (Đánh giá):** lấy bảng kê và snapshot của bản hiện hành (cache Redis theo `version`) rồi đo theo method. Mỗi tiêu chí ghi một dòng `map_place_measurements` kèm `lineage`. Ghim nằm ngoài `coverage` thì kết quả là `no_data`.
- **FR-06 (Chấm điểm):** theo Bản ghi 10: tuyến tính giữa ngưỡng tốt và xấu, kết luận mạnh/trung tính/yếu, điểm tổng tính lúc đọc từ trọng số của người dùng, kèm `coverage`.
- **FR-07 (Điểm mẫu):** script đọc `tools/data/golden-points.json` (khoảng 50 điểm), đánh giá theo bản nháp và theo bản hiện hành, rồi in bảng chênh lệch: số kết luận bị lật, độ lệch điểm theo tiêu chí, các điểm vi phạm `expectations`. Admin ghi tóm tắt vào ghi chú phát hành.
- **FR-08 (Dọn):** phiên bản lớp không có trong bảng kê của bản hiện hành, bản liền trước hoặc bản nháp, và đã như vậy quá 30 ngày, chuyển sang `retired`. Đối tượng bị `DELETE`, dòng phiên bản được giữ lại.
- **FR-09 (Sau `/reset`):** seed tạo bản phát hành 1 từ các phiên bản lớp `ready` mới nhất trong `geo`. Nếu chưa có thì dùng chế độ mẫu như hiện nay.
- **FR-10 (Báo dữ liệu mới):** khi phát hành, người dùng có địa điểm đã lưu nhận thông báo.
- **FR-11 (Vietmap, GĐ2):** Reverse lấy phường và tên đường. Matrix lấy thời gian đi cho tiêu chí `travel_time`; hết ngân sách thì đo bằng `nearest` với `status = fallback`.

## Quy tắc nghiệp vụ <!-- key: business_rules -->

- **BR-01 (Bất biến):** không sửa đối tượng đã nhập. `layer_manifest`, `criteria_snapshot` và `criteria_hash` không đổi sau khi đã `published`.
- **BR-02 (Ghim):** đánh giá chỉ dùng bảng kê và snapshot của bản đã ghim. Kết quả cũ không tự cập nhật.
- **BR-03 (Không có dữ liệu khác với bằng 0):** ngoài `coverage` thì `no_data`, `verdict = unknown`, không vào điểm tổng.
- **BR-04 (Mạnh/yếu nổi bật):** chỉ tính các tiêu chí có `confidence` từ `medium` trở lên.
- **BR-05 (Ưu tiên nguồn đo):** đo nội bộ trước, Vietmap sau. AI để GĐ3.
- **BR-06 (Điểm tổng):** tính lúc đọc, không lưu.
- **BR-07 (Dữ liệu `internal`):** không trả đối tượng ra API; `evidence` chỉ ghi loại và khoảng cách.
- **BR-08 (Giữ lại):** không dọn lớp thuộc bản hiện hành, bản liền trước hoặc bản nháp.
- **BR-09 (Số phiên bản):** tăng dần, không tái sử dụng. Thu hồi luôn tạo số mới.
- **BR-10 (Đổi tiêu chí):** sửa `CRITERIA` trong code làm `criteria_hash` khác bản hiện hành. Thay đổi chỉ có hiệu lực sau khi phát hành bản `kind = criteria`. Backend vẫn tính theo snapshot cũ cho tới lúc đó.

## Tóm tắt luồng người dùng <!-- key: user_flow_summary -->

1. Người vận hành tải nguồn, viết biên bản catalog, chạy `tools/data`. Phiên bản lớp mới vào `geo` ở trạng thái `ready` hoặc `failed`, kèm kiểm tra và khác biệt.
2. Admin tạo bản nháp và chọn phiên bản lớp mới. Người vận hành chạy script điểm mẫu và ghi tóm tắt vào ghi chú.
3. Admin bấm Phát hành; kiểm tra mức bản phải đạt. Người dùng có địa điểm đã lưu nhận thông báo.
4. Người dùng đánh giá một tọa độ: backend đo theo bảng kê bằng 1–3 câu SQL (và Vietmap ở GĐ2), rồi trả điểm mạnh, yếu.
5. Phát hiện lỗi: admin thu hồi về bản tốt trước đó trong một bước.

## Bối cảnh kỹ thuật <!-- key: technical_context -->

- **PostGIS:** đổi image sang `postgis/postgis` bản 17, giữ volume cũ. [research.md](research.md) Bản ghi 1.
- **Hai cách quản lý schema:**
  - `geo` dùng migration SQL chạy lặp được, không có entity.
  - `map_*` dùng entity TypeORM; cột mới phải khai báo trong entity, nếu không `synchronize` sẽ xóa.
  - Không có khóa ngoại giữa `geo` và `public`.
  - Không dùng enum Postgres.
  - Chi tiết ở Bản ghi 8.
- **`/reset`:** `clearDatabase` của TypeORM chỉ dọn schema entity và `current_schema()`, nên `geo` giữ nguyên sau reset. Seed dựng lại bản phát hành 1 (FR-09). Không gỡ lớp bảo vệ nào của `/reset`.
- **Lớp:** mỗi lớp là (nguồn, chủ đề, dạng hình học), ví dụ `osm.places`; loại tiện ích là cột `category`. Bản ghi 8.
- **Định danh:** `feature_key`. Bản ghi 3.
- **Raster:** tính sẵn lên lưới 100 m (EPSG:3405). Bản ghi 4.
- **Tiêu chí:** nằm trong code; bản phát hành giữ bản chụp. Bản ghi 9.
- **Chấm điểm và hiệu năng:** p95 dưới 300 ms khi không gọi Vietmap; gộp truy vấn bằng `LATERAL`; `statement_timeout` 2 s. Bản ghi 10.
- **`map_pois`:**
  - GĐ1 giữ nguyên bảng và nạp từ phiên bản `osm.places` của bản hiện hành mỗi khi phát hành.
  - Lớp bản đồ của `013-map` không đổi.
  - Không biến `map_pois` thành view vì nó vẫn là entity.
- **Quyền database:** role `geo_loader` chỉ ghi `geo`; backend chỉ đọc `geo`.

## Phụ thuộc <!-- key: dependencies -->

- `013-map`: mở rộng `map_dataset_versions` và `map_place_analyses`, thay luồng phát hành một bước.
- `004-rbac`: quyền `admin:access`.
- `014-notification`: thông báo có dữ liệu mới.

## Ràng buộc <!-- key: constraints -->

- Một người vận hành; không thêm kho dữ liệu hay framework ETL.
- Byte dữ liệu không vào git, chỉ biên bản `data/catalog`.
- Không đưa bí mật vào repo; biến môi trường chỉ ở `.env*` gốc; không dùng `any`.
- Kết quả cũ không tự đổi. `/reset` chỉ dành cho máy dev, không gỡ lớp bảo vệ.

## Tài liệu liên quan (Artifacts) <!-- key: artifacts -->

- **Idea:** [location-data-idea.md](location-data-idea.md)
- **Technical Research:** [research.md](research.md), 11 bản ghi quyết định; bản ghi 2, 5 và một phần bản ghi 6 đã bị thay.
- **Database:**
  - [postgresql.dbml](postgresql.dbml) (GĐ1–2)
  - [future-schema.md](future-schema.md) (GĐ3)
- **Diagrams:**
  - [diagrams/erd-location-data.mmd](diagrams/erd-location-data.mmd)
  - [diagrams/flow-data-release.mmd](diagrams/flow-data-release.mmd)
  - [diagrams/flow-rollback.mmd](diagrams/flow-rollback.mmd)
  - [diagrams/sequence-evaluation.mmd](diagrams/sequence-evaluation.mmd)
  - [diagrams/state-layer-version.mmd](diagrams/state-layer-version.mmd)
  - [diagrams/state-dataset-release.mmd](diagrams/state-dataset-release.mmd)
- **API Contracts:** [interfaces/rest-api.yml](interfaces/rest-api.yml) (admin, GĐ1–2)
- **Sổ tay tình huống:** [data-change-playbook.md](data-change-playbook.md)
- **Threat model:** [threat-model.md](threat-model.md)

## Tiêu chí nghiệm thu (Acceptance Criteria) <!-- key: acceptance_criteria -->

- [ ] **AC-01:** Given bản 5 là bản hiện hành và có một lượt đánh giá đã ghim bản 5, When phát hành bản 6 với OSM mới, Then lượt cũ vẫn trả đúng số đo cũ, còn đánh giá lại thì `dataset_version = 6`.
- [ ] **AC-02:** Given phiên bản lớp có kiểm tra chặn fail (ví dụ `row_count_delta` lệch 30%), When chọn nó vào bản nháp, Then bị từ chối (`LAYER_NOT_READY`).
- [ ] **AC-03:** Given bản 6 bị lỗi, When admin thu hồi về bản 5, Then bản 7 (`kind = rollback`) có `layer_manifest` và `criteria_snapshot` trùng bản 5, bản 6 chuyển `withdrawn`, mất dưới 1 phút và không phải nhập lại dữ liệu.
- [ ] **AC-04:** Given sửa ngưỡng hiệu thuốc trong code và deploy, When chưa phát hành bản mới, Then đánh giá vẫn dùng ngưỡng cũ trong `criteria_snapshot`.
- [ ] **AC-05:** Given ghim nằm ngoài `coverage` của lớp mảng xanh, When đánh giá, Then tiêu chí ra `no_data`, `verdict = unknown` và không được tính vào điểm tổng.
- [ ] **AC-06:** Given `geo` có phiên bản lớp `ready`, When chạy `/reset` trên máy dev, Then `geo` còn nguyên và hệ thống có bản phát hành 1 dựng từ các phiên bản đó.
- [ ] **AC-07:** Given mỗi dòng `map_place_measurements` mới, Then `lineage` liệt kê đủ `layer_versions` đã dùng.
- [ ] **AC-08:** Given đánh giá một tọa độ ở nội thành với dữ liệu GĐ1, Then p95 dưới 300 ms khi không gọi Vietmap.
- [ ] **AC-09 (GĐ2):** Given Vietmap hết ngân sách, When đánh giá tiêu chí `travel_time`, Then kết quả dùng `nearest` với `status = fallback` và `confidence` giảm một bậc.
- [ ] **AC-10:** Given lớp có `usage = internal`, When gọi API lớp bản đồ hoặc đọc `evidence`, Then không thấy tên hay hình học đối tượng của lớp đó.

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

- Có tự đánh giá lại các địa điểm đã lưu khi có bản mới không? Đề xuất: chỉ thông báo.
- Chọn khoảng 50 điểm mẫu nào cho `golden-points.json` (nội thành, ven đô, ngoại thành, khu bãi sông)?
- Điều khoản Vietmap cho phép lưu tên đường và phường lấy từ Reverse trong bao lâu (GĐ2)?

## Nhật ký cập nhật <!-- key: update_log -->

- Bản đầu: kiến trúc 3 tầng phiên bản, 26 bảng, 7 bản ghi quyết định, sổ tay 25 tình huống.
- Rà lại theo mã nguồn và chia giai đoạn (Bản ghi 8–11):
  - Sửa ba lỗi: xung đột với TypeORM `synchronize`, khóa ngoại chéo schema bị `/reset` xóa, enum Postgres.
  - Tiêu chí chuyển về code, bản phát hành giữ bản chụp.
  - Bỏ phân vùng, bảng nguồn và bước `staged`.
  - GĐ1 còn 8 bảng mới cộng cột mới; phần còn lại chuyển sang `future-schema.md`.
  - Thêm mô hình chấm điểm và mục tiêu hiệu năng.
