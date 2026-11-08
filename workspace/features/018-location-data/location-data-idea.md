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
- Nguồn đã có: OSM `.pbf`, WorldPop, ESA WorldCover (thiếu ô phía nam), JRC (sai ô, không phủ Hà Nội), hai CSDL quy hoạch Thủ đô `.gdb` (hơn 300 lớp), danh sách chợ của Sở Công Thương (không có tọa độ).

## Mục tiêu <!-- key: goal -->

- Có một cơ sở dữ liệu nền dùng chung cho mọi tiêu chí, để hệ thống tự tính điểm mạnh, yếu tại một tọa độ bằng logic nội bộ hoặc Vietmap.
- Tiêu chí quá bất ổn thì đổi sang dạng có cấu trúc để AI xử lý bằng API bên ngoài.
- Mỗi kết quả truy được nguồn và phiên bản đã dùng.
- Cập nhật dữ liệu, thêm nguồn, thêm hoặc đổi tiêu chí mà không làm hỏng kết quả cũ và không phải dừng hệ thống.

## Phạm vi <!-- key: scope -->

**Trong phạm vi:**

- Mô hình database cho dữ liệu nền (điểm, đường, vùng, lưới, chuỗi thời gian), cho định nghĩa tiêu chí có phiên bản, và cho bản phát hành gom các phiên bản đó lại.
- Quy trình nhập, kiểm tra chất lượng, chạy thử trên tập điểm mẫu, phát hành, thu hồi và dọn dữ liệu cũ.
- Các tình huống dữ liệu: làm mới nguồn, thêm nguồn, thay nguồn, nguồn đổi schema, thêm, đổi hoặc bỏ tiêu chí, nhập lỗi, đổi ranh hành chính, sửa tay một điểm, gỡ dữ liệu vì giấy phép.
- Lưu kết quả đo theo từng tiêu chí, và hàng đợi việc AI.

**Ngoài phạm vi (non-goals):**

- Viết mã ETL cho từng nguồn cụ thể. Bước này thuộc giai đoạn phát triển.
- Giao diện admin chi tiết. Đặc tả chỉ nêu các thao tác cần có.
- Prompt AI và việc chọn nhà cung cấp AI.
- Mở rộng ra ngoài Hà Nội. Thiết kế không chặn việc này nhưng không làm ngay.
- Giá đất thị trường và quy hoạch theo thửa.

## Tiêu chí thành công <!-- key: success_criteria -->

- Mỗi số đo của một lượt đánh giá chỉ ra được bản phát hành, phiên bản tiêu chí và phiên bản lớp dữ liệu đã dùng.
- Nhập bản OSM mới không làm đổi kết quả đã lưu. Đánh giá lại thì dùng bản mới.
- Phát hành bị chặn khi kiểm tra chất lượng có lỗi chặn. Trước khi phát hành, admin xem được báo cáo tác động trên tập điểm mẫu.
- Thu hồi một bản lỗi mất dưới 1 phút và không cần nhập lại dữ liệu.
- Thêm một tiêu chí mới không cần sửa schema database.

## Đối tượng sử dụng chính & Kịch bản sử dụng <!-- key: primary_actors -->

- **Người vận hành dữ liệu (dev/admin), chạy pipeline từ máy:** tải nguồn, nhập vào staging, xem kiểm tra chất lượng.
- **Admin trên giao diện:** xem bản nháp phát hành, báo cáo tác động; bấm phát hành hoặc thu hồi; chỉnh ngưỡng tiêu chí ở bản nháp.
- **Người dùng cuối:** bấm "Đánh giá" một tọa độ, xem điểm mạnh, yếu và nguồn; được báo khi có dữ liệu mới.
- **Job nền:** chạy việc AI, lấy số đo không khí theo giờ, dọn phiên bản cũ.

## Nơi bị ảnh hưởng <!-- key: impacted_areas -->

- Postgres: bật PostGIS và thêm schema dữ liệu nền.
- `backend/src/modules/map`: đánh giá, phiên bản dữ liệu, lớp bản đồ.
- `tools/data` (pipeline Python), `data/catalog`.
- Hạ tầng Docker (image Postgres), admin `/admin/map`.

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
- Ranh phường 2022 đã cũ sau đợt sắp xếp năm 2025.
- Dung lượng lưới và đa giác tăng nhanh nếu giữ nhiều phiên bản cùng lúc.

## Giả định (Assumptions) <!-- key: assumptions -->

- Pipeline chạy thủ công từ máy dev hoặc CI (`tools/data`), backend không tự tải dữ liệu.
- Dùng Postgres + PostGIS hiện có, chuyển sang image `postgis/postgis` cùng bản 17.
- Bảng dữ liệu nền (schema `geo`) dùng migration SQL viết tay. Cột mới của các bảng `map_*` khai báo trong entity TypeORM. Không có khóa ngoại giữa hai vùng.
- Định nghĩa tiêu chí nằm trong code; bản phát hành giữ bản chụp. Admin không chỉnh ngưỡng trên giao diện ở giai đoạn đầu.
- Làm theo ba giai đoạn; giai đoạn 1 chỉ có tiện ích, đường, nội đô, dân số.
- Mỗi lần chỉ có một bản phát hành hiện hành cho toàn hệ thống, không chia theo vùng.
- Giữ dữ liệu nền của bản hiện hành, bản trước đó và bản nháp. Kết quả đánh giá cũ tự chứa số đo nên không cần giữ dữ liệu nền cũ.

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

- Có tự đánh giá lại các địa điểm người dùng đã lưu khi có bản mới không (chỉ tốn tài nguyên nội bộ), hay chỉ báo để người dùng tự bấm?
- Tập điểm mẫu để chạy thử gồm những địa điểm nào? Đề xuất khoảng 50 điểm, chia đều nội thành, ven đô và ngoại thành.

## Tính năng liên quan <!-- key: related_features -->

- `000-ideas` (`tieu-chi.md`, `nguon-du-lieu.md`): danh sách tiêu chí và nguồn.
- `013-map`: nơi dùng kết quả.
- `017-search-elasticsearch`: có thể đánh chỉ mục tên điểm sau này.

## Nhật ký cập nhật <!-- key: update_log -->

- Bản đầu: gom từ trao đổi về dữ liệu raw, Vietmap và thiết kế database. Người dùng đã chốt hướng: logic nội bộ hoặc Vietmap trước, tiêu chí bất ổn mới chuyển cho AI.
- Rà lại thiết kế: chốt một admin duyệt phát hành (thu hồi được ngay), tiêu chí ở trong code, chia ba giai đoạn (xem research.md Bản ghi 8–11).
