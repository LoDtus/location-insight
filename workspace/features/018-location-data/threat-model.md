# Mô hình đe dọa — Dữ liệu nền và phiên bản dữ liệu (018-location-data)

Không có dữ liệu cá nhân mới. Rủi ro chính là sai lệch dữ liệu (kết quả sai mà trông hợp lệ), lộ dữ liệu chưa rõ quyền, và truy vấn không gian nặng.

| # | STRIDE | Mối đe dọa | Biện pháp | Dư rủi ro |
| --- | --- | --- | --- | --- |
| T1 | Tampering | **File nguồn bị thay** giữa lúc tải và lúc nhập | Nhập đối chiếu sha256 với biên bản `data/catalog`; sai thì snapshot `rejected` | Nguồn gốc bị đầu độc từ upstream (OSM bị phá hoại): chỉ bắt được qua kiểm tra số lượng và điểm mẫu |
| T2 | Tampering | **Bản phát hành sai** đẩy kết quả sai tới mọi người dùng | Kiểm tra chặn; điểm mẫu có `expectations`; báo cáo tác động bắt buộc xem; thu hồi một bước | Sai tinh vi trong ngưỡng kiểm tra |
| T3 | Repudiation | Không biết ai phát hành hay thu hồi bản lỗi | `created_by`, `released_by`, `withdraw_reason`; nhật ký kiểm toán admin; bản phát hành bất biến | — |
| T4 | Information Disclosure | **Lộ dữ liệu `internal`** (CSDL quy hoạch) qua API lớp bản đồ hoặc `evidence` | Lớp `internal` không có trong API lớp bản đồ; `evidence` chỉ ghi loại và khoảng cách; kiểm tra `license_usage` | Người dùng suy ngược được ranh vùng bằng cách thử nhiều tọa độ: chấp nhận, vì chỉ có kết luận |
| T5 | Information Disclosure | **Phá điều khoản Vietmap** do lưu lâu phản hồi | Chỉ lưu giá trị suy ra (phút, tên đường), không lưu nguyên văn; cache Redis theo TTL của 013-map | Cần đọc lại điều khoản hợp đồng |
| T6 | Tampering | **Prompt injection** qua dữ liệu nguồn (tên POI chứa chỉ dẫn) hoặc qua trang web AI đọc | `input` của AI là JSON dữ kiện có kiểu; tên đối tượng cắt độ dài và bỏ ký tự điều khiển; đầu ra AI kiểm bằng schema (verdict/score/citations), không chạy lệnh | AI có thể kết luận sai: `confidence` tối đa `medium`, bắt buộc có nguồn |
| T7 | Denial of Service | **Truy vấn không gian nặng** (đa giác lớn, bán kính lớn) làm chậm database | Đa giác `ST_Subdivide` khi nhập; bán kính lấy từ `params` đã giới hạn (tối đa 5 km); `statement_timeout` cho truy vấn đánh giá; giới hạn lượt đánh giá sẵn có | — |
| T8 | Denial of Service | Job dọn hoặc COPY lớn khóa bảng lúc cao điểm | Dữ liệu mới vào phân vùng mới, không khóa phân vùng đang đọc; `DROP` phân vùng chạy ngoài giờ | — |
| T9 | Elevation of Privilege | Người không phải admin sửa tiêu chí hoặc phát hành | Mọi route `admin:access` + CIDR admin; mặc định từ chối | Admin bị chiếm tài khoản: xem câu hỏi mở về duyệt hai người |
| T10 | Tampering | **`params` hoặc `scoring` tùy ý** (JSON) gây SQL động hoặc lỗi | Mỗi method có schema class-validator, trường lạ bị từ chối; SQL tham số hóa, tên lớp ánh xạ qua bảng chứ không ghép chuỗi | — |
| T11 | Spoofing | Script `tools/data` chạy với quyền database quá rộng | Role riêng `geo_loader`: chỉ ghi schema `geo`, không đọc bảng người dùng; backend dùng role chỉ đọc `geo` | — |
