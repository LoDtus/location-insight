# Mô hình mối đe dọa — Tìm kiếm với Elasticsearch (017-search-elasticsearch)

Cơ sở: `.cursor/rules/security.md`, khuyến nghị bảo mật ES của Mastodon (bật xác thực, role riêng theo tiền tố, chỉ lắng nghe nội bộ), tài liệu Elastic (xem `research.md`). Tài sản: dữ liệu người dùng được lập chỉ mục, tính sẵn sàng của ứng dụng, cụm ES.

Biên tin cậy: trình duyệt (không tin) → backend (tin) → ES (tin nhưng cô lập, không nhận lưu lượng từ ngoài). ES chỉ là bản sao dùng để tìm; quyết định quyền cuối cùng ở PostgreSQL.

| # | Mối đe dọa | Vector | Biện pháp (tham chiếu) | Rủi ro còn lại |
| --- | --- | --- | --- | --- |
| T1 | Chèn truy vấn / toán tử | `q` chứa `"`, `*`, `\`, `AND`, `field:value`… | Chỉ dùng `match`/`match_phrase`/`multi_match`, `q` chỉ là giá trị chuỗi (FR-13); không `query_string`; không để client chọn trường, analyzer, sort ngoài danh sách cho phép | Thấp |
| T2 | Truy vấn đắt làm treo ES (DoS) | `q` dài, nhiều từ, fuzzy bùng nổ, `from` sâu | `q` ≤ 120 ký tự và ≤ 8 từ, `prefix_length`, `max_expansions: 20`, fuzzy chỉ trên trường ngắn (BR-05), `size` ≤ 50, `from + size` ≤ 1000, timeout 2 giây, throttle riêng, ngắt mạch | Trung bình: ES một node, chịu tải hữu hạn; theo dõi `search_latency_ms` |
| T3 | Lộ dữ liệu ngoài quyền (IDOR qua tìm kiếm) | Kết quả gồm bản ghi riêng tư, đã ẩn | Bộ lọc quyền trong truy vấn ES (BR-08) **và** kiểm lại ở PostgreSQL khi hydrate (FR-07); không trả `_source` ES cho client | Thấp |
| T4 | Chỉ mục cũ hiển thị nội dung đã xóa/ẩn | Worker chậm, outbox `dead`, `/reset` | Hydrate loại id không còn; outbox gộp, thử lại; `search_outbox_lag_seconds` có cảnh báo; reindex định kỳ khi cần | Thấp (cửa sổ vài giây) |
| T5 | Dữ liệu nhạy cảm nằm trong ES | Lập chỉ mục thừa trường (email, token, ghi chú riêng) | `toDocument` chỉ lấy trường cần tìm/lọc, `dynamic: strict` (FR-15); duyệt profile admin riêng (Câu hỏi mở 2) | Trung bình, cần rà soát khi thêm profile |
| T6 | ES mở ra ngoài, không xác thực | Cổng `9200` publish mọi giao diện, bảo mật tắt (đúng như compose dev hiện tại) | Production: bật xác thực, role riêng, không publish ra mọi giao diện, firewall (BR-09) | **Cao ở production nếu mang cấu hình dev sang**; chấp nhận ở máy dev cục bộ |
| T7 | Lộ thông tin đăng nhập ES | Lọt vào nhật ký, repo, client | Chỉ ở `.env*` gốc; không ghi nhật ký; không trả về client | Thấp |
| T8 | Dò dữ liệu qua gợi ý khi gõ (enumeration) | Gõ từng ký tự để liệt kê tên | Yêu cầu đăng nhập khi dữ liệu không công khai; throttle; chỉ gợi ý trên tập được phép xem (bộ lọc quyền); giới hạn `size` | Trung bình với dữ liệu công khai (chấp nhận) |
| T9 | Đầu độc từ đồng nghĩa | Sửa bộ `vi-common` để chuyển hướng kết quả | Nguồn chuẩn là tệp trong repo qua review; `manage_search_synonyms` chỉ cấp cho tài khoản ứng dụng; không cho người dùng cuối sửa | Thấp |
| T10 | Ghi trái phép vào chỉ mục | Client gọi trực tiếp ES, hoặc tài khoản ứng dụng bị lộ | ES không truy cập được từ ngoài; role chỉ trên các index của ứng dụng; không có API nhận tài liệu từ client | Thấp |
| T11 | Mất chỉ mục / hỏng đĩa | Hỏng đĩa, xóa nhầm volume | PostgreSQL là nguồn sự thật, `search:reindex` dựng lại (BR-01); snapshot tùy chọn (`configuration.md`) | Thấp (chỉ mất thời gian) |
| T12 | Hạ tầng sụp khi ES tắt | Ứng dụng phụ thuộc cứng vào ES | ES tùy chọn: không chặn khởi động, `degraded` ở health, dự phòng PostgreSQL (FR-10, FR-11) | Thấp sau khi sửa điểm lệch 1–2; **hiện tại Cao** vì `onModuleInit` ném lỗi |
| T13 | Rò dữ liệu cá nhân qua nhật ký | Ghi `q` đầy đủ, tên người trong lỗi | Nhật ký chỉ ghi độ dài `q`, profile, số kết quả, tên lỗi | Thấp |
| T14 | Công cụ dev lọt production | Cờ dev, ES không bảo mật | Không liên quan trực tiếp tới `/reset`; `.env.production` phải bật xác thực; không đụng quy tắc `dev-reset` | Thấp |

## Dữ liệu nhạy cảm

- Nội dung bài thảo luận/phản hồi, tên hiển thị, email (admin): chỉ lập chỉ mục khi profile được duyệt, và chỉ trường cần thiết.
- Thông tin đăng nhập ES: bí mật hạ tầng.

## Việc kiểm tra nên có khi triển khai

- Gửi `q` gồm `"`, `\`, `*`, `(`, `field:value`, 5.000 ký tự: không lỗi cú pháp, không đổi ngữ nghĩa, bị cắt/loại đúng giới hạn.
- Người dùng A tìm bản ghi riêng tư của B: không xuất hiện ở ES lẫn sau hydrate.
- Dừng ES giữa lúc tìm: kết quả dự phòng, không lỗi 5xx.
- Bản ghi bị ẩn: biến khỏi kết quả trong ≤ 5 giây; xóa tay document ES và gọi lại: không làm lỗi hydrate.
- Production: gọi `curl` tới cổng ES từ máy ngoài không thành công; không xác thực bị `401`.
