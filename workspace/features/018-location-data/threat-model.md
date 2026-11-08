# Mô hình đe dọa — Dữ liệu nền và phiên bản dữ liệu (018-location-data, GĐ1–2)

Không có dữ liệu cá nhân mới. Rủi ro chính là ba loại:
- dữ liệu sai nhưng trông hợp lệ;
- lộ dữ liệu chưa rõ quyền;
- truy vấn không gian nặng làm chậm hệ thống.

| # | STRIDE | Mối đe dọa | Biện pháp | Dư rủi ro |
| --- | --- | --- | --- | --- |
| T1 | Tampering | **File nguồn bị thay** giữa lúc tải và lúc nhập | `tools/data` đối chiếu sha256 với biên bản `data/catalog`, sai thì không tạo phiên bản (`source_checksum`) | Nguồn bị đầu độc từ upstream (OSM bị phá hoại): chỉ bắt được qua `row_count_delta` và điểm mẫu |
| T2 | Tampering | **Bản phát hành sai** đẩy kết quả sai tới mọi người dùng | Kiểm tra chặn mức lớp và mức bản; script điểm mẫu chạy trước khi phát hành; thu hồi trong một bước | Sai tinh vi nằm trong ngưỡng kiểm tra; bước điểm mẫu là thủ công nên có thể bị bỏ qua (GĐ3 đưa vào hệ thống) |
| T3 | Tampering | **Đổi `CRITERIA` trong code mà không qua phát hành** | Đánh giá chỉ dùng `criteria_snapshot` của bản đã ghim; đổi code chỉ có hiệu lực khi phát hành bản `kind = criteria`; thay đổi `CRITERIA` đi qua review git | — |
| T4 | Repudiation | Không biết ai phát hành hay thu hồi | `created_by`, `released_by`, `withdraw_reason`; nhật ký kiểm toán admin; bản phát hành không sửa được | — |
| T5 | Information Disclosure | **Lộ dữ liệu `internal`** (CSDL quy hoạch) qua API lớp bản đồ hoặc `evidence` | Lớp `internal` không nạp vào `map_pois` hay API lớp; `evidence` chỉ ghi loại và khoảng cách; nguồn khác giấy phép thì tách lớp | Thử nhiều tọa độ có thể suy ngược ranh vùng: chấp nhận, vì chỉ lộ kết luận |
| T6 | Information Disclosure | **Phá điều khoản Vietmap** do lưu lâu (GĐ2) | Chỉ lưu giá trị suy ra (phút, tên đường, phường), không lưu nguyên văn; cache theo TTL của 013-map | Cần đọc lại điều khoản hợp đồng |
| T7 | Denial of Service | **Truy vấn không gian nặng** | Đa giác `ST_Subdivide` khi nhập; bán kính lấy từ `CRITERIA` (tối đa 5 km), không do người dùng gửi; `statement_timeout` 2 s; gộp truy vấn bằng `LATERAL`; giới hạn lượt đánh giá sẵn có | — |
| T8 | Denial of Service | COPY lớn hoặc `DELETE` khi dọn làm chậm lúc cao điểm | Phiên bản mới ghi dòng mới, không khóa dòng đang đọc; job dọn chạy ngoài giờ, xóa theo lô | Cần `VACUUM` sau lần dọn lớn |
| T9 | Elevation of Privilege | Người không phải admin phát hành hoặc thu hồi | Mọi route `admin:access` + CIDR admin; mặc định từ chối | Tài khoản admin bị chiếm: thu hồi được, nhật ký kiểm toán ghi lại |
| T10 | Tampering | **SQL ghép tên lớp hoặc tham số** | `layer_code` kiểm bằng regex và phải có trong `geo.layers`; mọi giá trị đều tham số hóa; tên bảng chọn theo `geometry_kind` từ danh sách cố định | — |
| T11 | Spoofing | Script `tools/data` chạy với quyền database quá rộng | Role `geo_loader` chỉ ghi `geo`, không đọc bảng người dùng; backend dùng role chỉ đọc `geo` | Trên máy dev có thể dùng chung một role: chấp nhận |
| T12 | Tampering | **`/reset` làm lệch `geo` và `public`** | Không có khóa ngoại chéo schema; seed dựng lại bản phát hành từ `geo`; reset chỉ chạy được trên máy dev theo `.cursor/rules/dev-reset.md` | — |
