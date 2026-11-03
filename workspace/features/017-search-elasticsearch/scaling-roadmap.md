# Lộ trình mở rộng — Tìm kiếm (017-search-elasticsearch)

Các con số là **mục tiêu thiết kế**, không phải số đo. Mỗi bậc chỉ làm khi số đo của bậc trước chạm ngưỡng. Hợp đồng ứng dụng (`SearchProfile`, `SearchService`, alias, tên trường, REST của module) **không đổi** giữa các bậc.

| Bậc | Quy mô tham chiếu | Việc làm | Ngưỡng chuyển bậc (đo bằng) |
| --- | --- | --- | --- |
| 0 (bản đầu) | Một máy; mỗi profile vài chục nghìn đến vài triệu tài liệu ngắn | Một node, 1 shard, 0 replica; worker outbox trong tiến trình backend; dự phòng PostgreSQL; bộ phân tích `vi_*` không plugin; từ đồng nghĩa từ tệp repo | `search_latency_ms` p95 > 200 ms kéo dài; `search_outbox_lag_seconds` > 30 s; RAM host thiếu; đĩa > 70% |
| 1 | Production đầu tiên | Bật xác thực + role riêng; không publish cổng; ghim phiên bản; thống nhất phiên bản client/server; bộ ca vàng chạy trong CI; cảnh báo độ trễ outbox; snapshot `fs` + SLM nếu cần rút ngắn RTO | Trước khi mở cho người dùng thật |
| 2 | Nhiều profile, nhiều ghi | Tách worker thành tiến trình riêng (cùng image, khác lệnh; vẫn `SKIP LOCKED`); chỉnh `refresh_interval` theo profile; thêm tín hiệu xếp hạng (độ mới/phổ biến) bằng `function_score` hoặc `rescore`; `pg_trgm` + `unaccent` làm dự phòng tốt hơn nếu cần | Worker chiếm CPU backend; người dùng phàn nàn thứ tự khi ngang điểm; dự phòng PostgreSQL quá kém |
| 3 | Cần chịu lỗi | 3 node (hoặc 2 node dữ liệu + 1 node bầu chọn), `number_of_replicas: 1`, số shard theo dung lượng index; snapshot ra kho ngoài máy (kiểm tra tương thích kho S3/R2 với ES trước khi dựa vào) | Yêu cầu uptime cao hơn một máy; RTO reindex không chấp nhận được |
| 4 | Không muốn tự vận hành | Dịch vụ managed (Elastic Cloud hoặc tương đương **cùng API ES 9.x**); đổi `ELASTICSEARCH_NODE` + thông tin xác thực. Không cam kết tương thích OpenSearch (API đã tách khỏi ES) | Chi phí vận hành > chi phí dịch vụ |
| 5 | Ngữ nghĩa thật | Thêm trường vector/`semantic_text` và kết hợp xếp hạng (hybrid, RRF) **bên cạnh** các tầng hiện có; cần quyết định riêng về mô hình, chi phí, quyền riêng tư | Bộ ca thật cho thấy từ đồng nghĩa không đủ; có yêu cầu "hiểu ý" rõ ràng |

## Nguyên tắc xuyên suốt

- Chỉ tối ưu sau khi có số đo; ghi kết quả đo (và `_search` có `profile: true` nếu cần) cạnh tài liệu này.
- Đổi mapping/analyzer luôn qua index phiên bản mới + alias (BR-06); không sửa tại chỗ.
- ES là bản sao: mọi quyết định cần đủ an toàn nếu phải xóa và dựng lại toàn bộ.
- Không thêm thành phần (Logstash, Kafka, Debezium) trước khi outbox + worker thật sự không theo kịp.
- Mọi job nền chạy được trên nhiều instance (`SKIP LOCKED`), không giả định một instance.

## Chỉ số cần có từ bậc 0

`search_requests_total{profile,source}`, `search_latency_ms{profile}`, `search_fallback_total{reason}`, `search_zero_result_total{profile}`, `search_outbox_depth{profile}`, `search_outbox_lag_seconds`, `search_index_docs{profile}` (so với số dòng nguồn), tuổi lần reindex gần nhất, dung lượng đĩa và heap ES.
