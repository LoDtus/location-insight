# Dữ liệu nền cho phân tích vị trí và quy trình phiên bản dữ liệu

**Feature ID:** 018-location-data
**Type:** New Feature
**Status:** Ready for Planning

## Vấn đề <!-- key: problem -->

Điểm mạnh, điểm yếu của một tọa độ hiện là số mẫu sinh theo tọa độ (`sample: true`). Dữ liệu thô đã có trong `data/raw` nhưng chưa có chỗ chứa chung trong database, chưa có cách biết một kết quả được tính từ bản dữ liệu nào, và chưa có quy trình an toàn khi dữ liệu hoặc tiêu chí thay đổi.

## Bối cảnh hiện tại <!-- key: current_context -->

- `data/` đã chia bốn giai đoạn `raw → interim → processed → curated` và có biên bản nhập ở `data/catalog/snapshots/*.json` (URL, sha256, giấy phép). Chưa có `catalog/current.json`.
- Database: `map_pois` có 12.723 điểm OSM, chỉ dùng cho lớp bản đồ. `map_dataset_versions` có số phiên bản tăng dần do admin bấm phát hành, nhưng không ghi phiên bản đó gồm những dữ liệu nào.
- `map_place_analyses` lưu kết quả đo dạng `jsonb` kèm `dataset_version`. Người dùng có `map_criterion_weights` và `map_criterion_overrides`.
- Bộ 19 tiêu chí nằm cứng trong `backend/src/modules/map/place-evaluation.ts`.
- Postgres là `postgres:17-alpine`, chưa có PostGIS. Backend dùng TypeORM `synchronize`, chưa dùng migration.
- Trang `/admin/datasets` (`website/src/features/datasets/components/dataset-console.tsx`) đã có các tab Phiên bản, Nguồn dữ liệu và Chốt phát hành. Nút "Nhập tệp" và "Tải bản mới" mới chỉ hiện thông báo "sắp có"; danh mục nguồn là dữ liệu mẫu.
- Nguồn đã có: OSM `.pbf`, WorldPop, ESA WorldCover (thiếu ô phía nam), JRC (sai ô, không phủ Hà Nội), hai CSDL quy hoạch Thủ đô `.gdb` (hơn 300 lớp), danh sách chợ của Sở Công Thương (không có tọa độ).

## Mục tiêu <!-- key: goal -->

- Có một cơ sở dữ liệu nền dùng chung cho mọi tiêu chí, để hệ thống tự tính điểm mạnh, yếu tại một tọa độ bằng logic nội bộ hoặc Vietmap.
- Tiêu chí quá bất ổn thì đổi sang dạng có cấu trúc để AI xử lý bằng API bên ngoài.
- Mỗi kết quả truy được nguồn và phiên bản đã dùng.
- Cập nhật dữ liệu, thêm nguồn, thêm hoặc đổi tiêu chí mà không làm hỏng kết quả cũ và không phải dừng hệ thống.
- Chỉ có một đường đưa dữ liệu nền vào hệ thống: gói đã chuẩn hóa, tải lên qua `/admin/datasets`, được kiểm tra rồi mới lưu. Cấm ghi thẳng vào database hay backend.

## Phạm vi <!-- key: scope -->

**Trong phạm vi:**

- Mô hình database cho dữ liệu nền (điểm, đường, vùng, lưới, chuỗi thời gian), cho định nghĩa tiêu chí có phiên bản, và cho bản phát hành gom các phiên bản đó lại.
- Khuôn gói chuẩn, kho gói và quy trình tải lên, kiểm tra, lưu, chạy thử trên tập điểm mẫu, phát hành, thu hồi, khôi phục và dọn dữ liệu cũ.
- Các ràng buộc chặn ghi ngoài đường nhập.
- Các tình huống dữ liệu: làm mới nguồn, thêm nguồn, thay nguồn, nguồn đổi schema, thêm, đổi hoặc bỏ tiêu chí, nhập lỗi, đổi ranh hành chính, sửa tay một điểm, gỡ dữ liệu vì giấy phép.
- Lưu kết quả đo theo từng tiêu chí, và hàng đợi việc AI.

**Ngoài phạm vi (non-goals):**

- Viết mã chuẩn hóa cho từng nguồn cụ thể. Bước này thuộc giai đoạn phát triển và chạy ở máy vận hành.
- Server đọc định dạng thô (GDB, DGN, PDF, PBF, GeoTIFF), hoặc tự tải nguồn định kỳ.
- Giao diện admin chi tiết. Đặc tả chỉ nêu các thao tác cần có.
- Prompt AI và việc chọn nhà cung cấp AI.
- Mở rộng ra ngoài Hà Nội. Thiết kế không chặn việc này nhưng không làm ngay.
- Giá đất thị trường và quy hoạch theo thửa.

## Tiêu chí thành công <!-- key: success_criteria -->

- Mỗi số đo của một lượt đánh giá chỉ ra được bản phát hành, phiên bản tiêu chí và phiên bản lớp dữ liệu đã dùng.
- Nhập bản OSM mới không làm đổi kết quả đã lưu. Đánh giá lại thì dùng bản mới.
- Phát hành bị chặn khi kiểm tra chất lượng có lỗi chặn. Trước khi phát hành, admin xem được báo cáo tác động trên tập điểm mẫu.
- Thu hồi một bản lỗi mất dưới 1 phút và không cần nhập lại dữ liệu.
- Thêm một tiêu chí mới không cần sửa schema database. Thêm một lớp mới cùng dạng hình học không cần sửa code.
- Không role nào của ứng dụng sửa được dữ liệu nền đã lưu; ghi lén bằng superuser bị phát hiện.

## Đối tượng sử dụng chính & Kịch bản sử dụng <!-- key: primary_actors -->

- **Người vận hành dữ liệu, ở máy:** tải nguồn, chuẩn hóa (chấp nhận làm tay phần bất quy tắc), đóng gói và kiểm gói. Không có quyền ghi database.
- **Admin trên `/admin/datasets`:** tải gói, xem kiểm tra và khác biệt, Lưu hoặc Bỏ; tạo lớp; tạo bản nháp, xem báo cáo điểm mẫu, phát hành, thu hồi, khôi phục.
- **Người dùng cuối:** bấm "Đánh giá" một tọa độ, xem điểm mạnh, yếu và nguồn; được báo khi có dữ liệu mới.
- **Job nền:** dọn phiên bản cũ, kiểm toàn vẹn dữ liệu, xóa gói bị bỏ; sau này lấy số đo không khí và chạy việc AI.

## Nơi bị ảnh hưởng <!-- key: impacted_areas -->

- Postgres: bật PostGIS và thêm schema dữ liệu nền.
- `backend/src/modules/map`: đánh giá, phiên bản dữ liệu, lớp bản đồ.
- `tools/data` (chuẩn hóa, `pack`, `validate`), `contracts/`, `data/` (thêm `packages`, bỏ `curated`).
- Hạ tầng Docker (image Postgres, volume kho gói, role database), admin `/admin/datasets`.

## Phụ thuộc <!-- key: dependencies -->

- `013-map`: dùng bảng `map_places`, `map_place_analyses`, `map_dataset_versions` và ngân sách Vietmap.
- `004-rbac`: quyền admin phát hành dữ liệu.
- `014-notification`: báo người dùng khi có dữ liệu mới.

## Dữ liệu nhạy cảm & Tuân thủ <!-- key: data_sensitivity -->

- Không có dữ liệu cá nhân mới. Tọa độ người dùng đánh giá đã thuộc `013-map`.
- Có ràng buộc giấy phép: OSM là ODbL (phải ghi nguồn). CSDL quy hoạch Thủ đô và datsach.net chưa rõ quyền, chỉ dùng nội bộ. Vietmap cấm lưu lâu một số kết quả.

## Ràng buộc <!-- key: constraints -->

- Một người phát triển vận hành, nên ưu tiên thứ đơn giản và nằm trong Postgres hiện có. Không thêm kho dữ liệu riêng (data lake, Spark…).
- Không đưa bí mật vào repo. Biến môi trường chỉ sửa ở `.env*` gốc. Không dùng `any`.
- Byte dữ liệu không vào git. Chỉ biên bản trong `data/catalog` được commit.
- Lượt đánh giá cũ không tự đổi (quy tắc sẵn có của `013-map`).

## Rủi ro & Điểm chưa rõ <!-- key: risks_unknowns -->

- Nguồn không có id ổn định (CSDL quy hoạch, raster), nên khó so khác biệt giữa hai bản.
- Hai nguồn cùng một loại điểm (chợ OSM và chợ trong CSDL quy hoạch) có thể đếm trùng.
- Tải file lên mở ra rủi ro file độc hại (zip bomb, path traversal).
- Nguồn gốc ghi trong manifest là lời khai; server không kiểm được file raw.
- Superuser Postgres vẫn ghi được vào `geo`; chỉ phát hiện được, không chặn được.
- Mất kho gói mà không có bản sao lưu thì mất khả năng khôi phục phiên bản đã dọn.
- Ranh phường 2022 đã cũ sau đợt sắp xếp năm 2025.
- Dung lượng lưới và đa giác tăng nhanh nếu giữ nhiều phiên bản cùng lúc.

## Giả định (Assumptions) <!-- key: assumptions -->

- Chuẩn hóa chạy ở máy vận hành (`tools/data`), có thể làm tay. Backend không tự tải nguồn và không đọc định dạng thô; chỉ nhận gói theo 4 khuôn.
- Dùng Postgres + PostGIS hiện có, chuyển sang image `postgis/postgis` cùng bản 17.
- Bảng dữ liệu nền (schema `geo`, `geo_staging`) dùng migration SQL viết tay. Cột mới của các bảng `map_*` khai báo trong entity TypeORM. Không có khóa ngoại giữa hai vùng.
- Định nghĩa tiêu chí nằm trong code; bản phát hành giữ bản chụp. Admin không chỉnh ngưỡng trên giao diện ở giai đoạn đầu.
- Làm theo ba giai đoạn; giai đoạn 1 chỉ có tiện ích, đường, nội đô, dân số.
- Mỗi lần chỉ có một bản phát hành hiện hành cho toàn hệ thống, không chia theo vùng.
- Database giữ dữ liệu nền của bản hiện hành, bản trước đó và bản nháp. Kho gói giữ mọi gói từng được phát hành, nên phiên bản cũ khôi phục được. Kết quả đánh giá cũ tự chứa số đo.
- Một gói là một phiên bản của một lớp (một nguồn), không phải một tiêu chí. `data/` sắp theo nguồn và lớp; tiêu chí nào dùng lớp nào xem ở `data/catalog/criteria-map.md`, do script sinh từ code.

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

- Có tự đánh giá lại các địa điểm người dùng đã lưu khi có bản mới không (chỉ tốn tài nguyên nội bộ), hay chỉ báo để người dùng tự bấm?
- Tập điểm mẫu để chạy thử gồm những địa điểm nào? Đề xuất khoảng 50 điểm, chia đều nội thành, ven đô và ngoại thành; GĐ1 tối thiểu 10.
- Sao lưu kho gói ở đâu (ổ ngoài hay kho đám mây có mã hóa)?

## Tính năng liên quan <!-- key: related_features -->

- `000-ideas` (`tieu-chi.md`, `nguon-du-lieu.md`): danh sách tiêu chí và nguồn.
- `013-map`: nơi dùng kết quả.
- `017-search-elasticsearch`: có thể đánh chỉ mục tên điểm sau này.

## Nhật ký cập nhật <!-- key: update_log -->

- Bản đầu: gom từ trao đổi về dữ liệu raw, Vietmap và thiết kế database. Người dùng đã chốt hướng: logic nội bộ hoặc Vietmap trước, tiêu chí bất ổn mới chuyển cho AI.
- Rà lại thiết kế: chốt một admin duyệt phát hành (thu hồi được ngay), tiêu chí ở trong code, chia ba giai đoạn (xem research.md Bản ghi 8–11).
- Người dùng chốt: chấp nhận làm tay phần bất quy tắc ở máy; mọi dữ liệu nền đi qua gói chuẩn tải lên `/admin/datasets`, kiểm tra rồi mới lưu; cấm ghi thẳng; một bảng kê dùng cho mọi tiêu chí; giữ lại mọi gói theo phiên bản trong `data/` (research.md Bản ghi 12–14).
