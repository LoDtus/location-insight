# 018 — Dữ liệu nền cho phân tích vị trí và phiên bản dữ liệu

**Feature ID:** 018-location-data
**Status:** In Review
**Last Updated:** 08/11/2026

## Tổng quan <!-- key: overview -->

Đây là kiến trúc database và quy trình để biến dữ liệu thô (OSM, WorldPop, WorldCover, JRC, CSDL quy hoạch Thủ đô…) thành số đo cho từng tiêu chí tại một tọa độ. Kiến trúc có ba tầng phiên bản:

- **phiên bản lớp:** dữ liệu của một lớp, dựng từ các snapshot nguồn;
- **phiên bản tiêu chí:** ngưỡng, cách đo, thang điểm;
- **bản phát hành:** bảng kê ghim một phiên bản lớp và một phiên bản tiêu chí cho mỗi mục.

Mỗi lượt đánh giá ghim một bản phát hành, nên luôn giải thích được, và dữ liệu mới không bao giờ làm đổi kết quả cũ.

## Mục tiêu & Phạm vi <!-- key: goals_scope -->

**Trong phạm vi:**

- Schema `geo` (PostGIS) cho điểm, đường, vùng, lưới, chuỗi thời gian; phân vùng theo phiên bản lớp.
- Tiêu chí có phiên bản trong database. Bản phát hành có bảng kê, kiểm tra chất lượng, điểm mẫu, báo cáo tác động, thu hồi.
- Kết quả đo theo từng tiêu chí, có nguồn gốc (lineage); hàng đợi việc AI cho tiêu chí bất ổn.
- Sổ tay xử lý 25 tình huống thay đổi dữ liệu: [data-change-playbook.md](data-change-playbook.md).

**Ngoài phạm vi:**

- Mã ETL cụ thể của từng nguồn, prompt AI, giao diện admin chi tiết.
- Mở rộng ngoài Hà Nội (thiết kế không chặn việc này).
- Giá thị trường, quy hoạch theo thửa.

## Đối tượng liên quan <!-- key: actors -->

- **Người vận hành dữ liệu:** chạy `tools/data` để nhập lớp mới vào `geo`.
- **Admin:** dựng bản nháp, xem kiểm tra và tác động, phát hành hoặc thu hồi, chỉnh tiêu chí, sửa tay đối tượng.
- **Người dùng:** đánh giá tọa độ, đánh giá lại khi có bản mới.
- **Job nền:** lấy số đo không khí theo giờ, chạy việc AI, dọn phiên bản cũ, tính benchmark và tác động khi `stage`.
- **Hệ thống ngoài:** Vietmap (Reverse, Matrix), OpenAQ, nhà cung cấp AI.

## Yêu cầu chức năng <!-- key: functional_requirements -->

- **FR-01 (Đăng ký nguồn):** mỗi file nhập phải khớp một biên bản `data/catalog` (sha256). Database ghi lại thành `geo.source_snapshots`.
- **FR-02 (Dựng phiên bản lớp):** nhập vào phân vùng mới với trạng thái `building`, rồi áp sửa tay, rồi kiểm tra chất lượng; đạt thì `ready`, không đạt thì `failed`. Tính khác biệt so với phiên bản đang phát hành theo `feature_key`.
- **FR-03 (Tiêu chí có phiên bản):** tạo và sửa phiên bản `draft`. Phiên bản thành `frozen` khi thuộc một bản đã staged. `params` và `scoring` được kiểm theo schema của từng method.
- **FR-04 (Bản nháp):** tạo bản nháp chép bảng kê từ bản hiện hành, rồi thay, thêm hoặc bỏ lớp và tiêu chí. Mỗi lúc chỉ có một bản nháp.
- **FR-05 (Stage):** khóa bảng kê, chạy kiểm tra mức bản, tính `map_benchmarks`, chạy điểm mẫu ra `map_release_impacts`.
- **FR-06 (Phát hành):** chỉ khi bản đã staged và không có kiểm tra chặn nào fail. Có cảnh báo thì phải ghi lý do. Phát hành trong một transaction và xóa cache bản hiện hành.
- **FR-07 (Thu hồi):** tạo bản `rollback` chép bảng kê của bản tốt và phát hành ngay; bản lỗi thành `withdrawn`.
- **FR-08 (Đánh giá):** đo theo method với các lớp trong bảng kê. Mỗi tiêu chí ghi một dòng `map_place_measurements` có `lineage`. Tiêu chí `volatile` có `expires_at`.
- **FR-09 (AI):** tiêu chí `method = ai`, hoặc tiêu chí ra `no_data` mà có `ai_allowed`, thì tạo `map_ai_jobs`. Kết quả phải có nguồn trích dẫn, nếu không thì `verdict = unknown`.
- **FR-10 (Dọn):** phiên bản lớp không bản nào trỏ tới quá 30 ngày thì `retired`, rồi `DROP` phân vùng, rồi `purged`.
- **FR-11 (Sửa tay):** admin ẩn, sửa hoặc thêm đối tượng theo `feature_key`, có lý do. Các lần dựng lớp sau tự áp lại.
- **FR-12 (Báo dữ liệu mới):** khi phát hành, người dùng có địa điểm đã lưu nhận thông báo "có dữ liệu mới".

## Quy tắc nghiệp vụ <!-- key: business_rules -->

- **BR-01 (Bất biến):** không sửa đối tượng đã nhập, không sửa bảng kê từ `staged` trở đi, không sửa phiên bản tiêu chí `frozen`.
- **BR-02 (Ghim):** một lượt đánh giá chỉ dùng lớp và tiêu chí trong bảng kê của bản đã ghim. Kết quả cũ không tự cập nhật.
- **BR-03 (Không có dữ liệu khác với bằng 0):** ghim nằm ngoài `coverage` của lớp thì `status = no_data`, `verdict = unknown`, không tính vào điểm tổng.
- **BR-04 (Mạnh hoặc yếu):** `verdict` theo ngưỡng tuyệt đối của `scoring`. Chỉ đưa vào danh sách mạnh, yếu nổi bật khi `confidence` từ `medium` trở lên. `percentile` theo phường chỉ để giải thích thêm.
- **BR-05 (Ưu tiên nguồn đo):** đo nội bộ trước, rồi Vietmap, rồi AI. AI không ghi đè số đo `ok` hay `fallback`, và `confidence` của AI tối đa là `medium`.
- **BR-06 (Điểm tổng):** tính lúc đọc từ `auto_score` (hoặc điểm chỉnh tay) nhân trọng số của người dùng; không lưu.
- **BR-07 (Dữ liệu internal):** đối tượng từ nguồn `internal` không được trả nguyên văn; `evidence` chỉ ghi loại và khoảng cách.
- **BR-08 (Giữ lại):** không dọn lớp thuộc bảng kê của bản hiện hành, bản liền trước, hoặc bản draft/staged.
- **BR-09 (Số phiên bản):** số phát hành tăng dần, không tái sử dụng. Thu hồi luôn tạo số mới.

## Tóm tắt luồng người dùng <!-- key: user_flow_summary -->

1. Người vận hành tải nguồn và viết biên bản, chạy `tools/data`. Lớp mới vào `geo` với trạng thái `ready` hoặc `failed`.
2. Admin tạo bản nháp, chọn lớp và tiêu chí mới, bấm Stage, xem kiểm tra và tác động trên điểm mẫu.
3. Admin bấm Phát hành. Người dùng có địa điểm đã lưu nhận thông báo.
4. Người dùng đánh giá một tọa độ: backend đo theo bảng kê, gọi Vietmap nếu cần, đẩy việc AI cho tiêu chí bất ổn, trả điểm mạnh, yếu ngay (trạng thái `partial` nếu còn việc AI chưa xong).
5. Phát hiện lỗi: admin thu hồi về bản tốt trước đó trong một bước.

Sơ đồ đầy đủ ở mục Tài liệu liên quan.

## Bối cảnh kỹ thuật <!-- key: technical_context -->

- **PostGIS:** bật trong Postgres hiện có (`postgis/postgis` bản 17). Schema `geo` dùng migration SQL viết tay, không dùng TypeORM `synchronize`. Xem [research.md](research.md) Bản ghi 1.
- **Phân vùng:** bảng đối tượng phân vùng `LIST (layer_version_id)`. Phát hành và thu hồi chỉ đổi con trỏ; dọn bằng `DROP PARTITION`. Bản ghi 2.
- **Định danh:** `feature_key` = `nguồn:id`, hoặc băm (loại, tên, tọa độ làm tròn 10 m) với nguồn không có id. Bản ghi 3.
- **Raster:** tính trước trong Python lên lưới 100 m (EPSG:3405), tra một dòng khi đánh giá. Bản ghi 4.
- **Tiêu chí:** code giữ phương pháp, database giữ tham số có phiên bản. Bản ghi 5.
- **Phát hành:** chỉ tiến tới, thu hồi bằng bản mới. Bản ghi 6.
- **Dữ liệu biến động** (không khí, thời gian đi, AI): nằm ngoài bản phát hành và có hạn dùng. Bản ghi 7.
- **Truy vấn đánh giá:** mỗi method là một câu SQL tham số hóa, lọc theo `layer_version_id` lấy từ bảng kê. Bảng kê cache Redis theo `version`.
- **`map_pois` hiện có:** trở thành view trên `geo.point_features` của bản hiện hành, để lớp bản đồ của `013-map` không phải đổi.
- **Quyền database:** role `geo_loader` chỉ ghi `geo`; backend chỉ đọc `geo`.

## Phụ thuộc <!-- key: dependencies -->

- `013-map`: mở rộng `map_places`, `map_place_analyses`, `map_dataset_versions`; thay luồng phát hành một bước.
- `004-rbac`: quyền `admin:access`.
- `014-notification`: thông báo có dữ liệu mới.

## Ràng buộc <!-- key: constraints -->

- Một người vận hành; không thêm kho dữ liệu hay framework ETL mới.
- Byte dữ liệu không vào git, chỉ biên bản `data/catalog`.
- Không bí mật trong repo; biến môi trường chỉ ở `.env*` gốc; không dùng `any`.
- Kết quả cũ không tự đổi.

## Tài liệu liên quan (Artifacts) <!-- key: artifacts -->

- Idea: [location-data-idea.md](location-data-idea.md)
- Technical Research: [research.md](research.md), gồm 7 bản ghi quyết định và bảng tham khảo dự án GitHub
- Database Schemas: [postgresql.dbml](postgresql.dbml)
- Diagrams:
  - ERD: [diagrams/erd-location-data.mmd](diagrams/erd-location-data.mmd)
  - Luồng phát hành: [diagrams/flow-data-release.mmd](diagrams/flow-data-release.mmd)
  - Luồng thu hồi: [diagrams/flow-rollback.mmd](diagrams/flow-rollback.mmd)
  - Trình tự đánh giá: [diagrams/sequence-evaluation.mmd](diagrams/sequence-evaluation.mmd)
  - Trạng thái phiên bản lớp: [diagrams/state-layer-version.mmd](diagrams/state-layer-version.mmd)
  - Trạng thái bản phát hành: [diagrams/state-dataset-release.mmd](diagrams/state-dataset-release.mmd)
  - Trạng thái phiên bản tiêu chí: [diagrams/state-criterion-version.mmd](diagrams/state-criterion-version.mmd)
- API Contracts: [interfaces/rest-api.yml](interfaces/rest-api.yml) (admin)
- Sổ tay tình huống: [data-change-playbook.md](data-change-playbook.md)
- Threat model: [threat-model.md](threat-model.md)

## Tiêu chí nghiệm thu (Acceptance Criteria) <!-- key: acceptance_criteria -->

- [ ] **AC-01:** Given bản 5 đang hiện hành và một lượt đánh giá đã ghim bản 5, When phát hành bản 6 với OSM mới, Then lượt cũ trả đúng số đo cũ, còn đánh giá lại thì `dataset_version = 6`.
- [ ] **AC-02:** Given phiên bản lớp có `row_count_delta` lệch 30%, When stage bản nháp chứa nó, Then không phát hành được (`RELEASE_BLOCKED`).
- [ ] **AC-03:** Given bản 6 lỗi, When admin thu hồi về bản 5, Then bản 7 (`kind = rollback`) có bảng kê trùng bản 5, bản 6 thành `withdrawn`, mất dưới 1 phút và không nhập lại dữ liệu.
- [ ] **AC-04:** Given tiêu chí mới dùng method `nearest` sẵn có, When admin tạo tiêu chí và phát hành, Then lượt đánh giá mới có tiêu chí đó mà không phải deploy hay đổi schema.
- [ ] **AC-05:** Given phiên bản tiêu chí đã `frozen`, When admin PATCH, Then trả 409 `CRITERION_VERSION_FROZEN`.
- [ ] **AC-06:** Given ghim nằm ngoài `coverage` của lớp mảng xanh, When đánh giá, Then tiêu chí ra `no_data`, `verdict = unknown` và không vào điểm tổng.
- [ ] **AC-07:** Given Vietmap hết ngân sách, When đánh giá tiêu chí `travel_time`, Then số đo dùng `nearest`, `status = fallback`, `confidence` giảm một bậc.
- [ ] **AC-08:** Given lớp từ nguồn `internal`, When gọi API lớp bản đồ hoặc đọc `evidence`, Then không có tên hay hình học của đối tượng nguồn đó.
- [ ] **AC-09:** Given mỗi `map_place_measurements` mới, Then `lineage` chứa đủ `layer_versions` và `criterion_version_id`.
- [ ] **AC-10:** Given phiên bản lớp không bản nào trỏ tới quá 30 ngày và không thuộc bản hiện hành hay bản liền trước, When job dọn chạy, Then phân vùng bị `DROP` và trạng thái là `purged`.

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

- Có tự đánh giá lại các địa điểm đã lưu khi có bản mới không, hay chỉ thông báo? Đề xuất: chỉ thông báo, kèm số tiêu chí có thể đổi theo báo cáo tác động.
- Có cần người thứ hai duyệt trước khi phát hành không? Đề xuất: chưa cần, vì chỉ có một admin và thu hồi được ngay.
- Chọn ~50 điểm mẫu nào (nội thành, ven đô, ngoại thành, khu bãi sông)?
- Điều khoản Vietmap về thời gian được lưu tên đường và phường lấy từ Reverse.

## Nhật ký cập nhật <!-- key: update_log -->

- Bản đầu: kiến trúc database 3 tầng phiên bản, 7 bản ghi quyết định, sổ tay 25 tình huống, API admin, threat model.
