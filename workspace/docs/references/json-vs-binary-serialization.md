# JSON hay định dạng nhị phân cho giao tiếp nội bộ

Lưu ngày 06/11/2026. Gồm bài viết gốc (dán nguyên văn) và nhận xét khi áp vào Location Insight.

## Kết luận cho dự án này

- **Không đổi sang Protobuf, MessagePack, Avro hay gRPC.** Backend là một khối NestJS duy nhất. Không có service gọi service, không có Kafka, nên không có "vùng bên trong" nào mà bài viết khuyên dùng nhị phân.
- **Đã làm: nén phản hồi API** (gzip/brotli, `backend/src/shared/config/compression.config.ts`). Đo thật ô Hoàn Kiếm: 174.769 B → 32.447 B (brotli) / 32.275 B (gzip); `/map/weights` 2.927 B → 732 B. Không nén phản hồi dưới 1 KB và các đường `/auth` (có token trong thân, tránh tấn công kiểu BREACH). Website Next.js tự nén khi chạy `next start`.
- **Giữ JSON** cho REST, socket.io và Redis.

### Dự án đang giao tiếp ở đâu

| Luồng | Định dạng | Người đọc | Theo ranh giới của bài viết |
| --- | --- | --- | --- |
| Website ↔ backend (REST) | JSON | Trình duyệt, lập trình viên khi debug | Vùng rìa, giữ JSON |
| Realtime nhắn tin, thông báo (socket.io) | JSON | Trình duyệt | Vùng rìa, tin nhắn nhỏ |
| Backend ↔ Redis (cache, rate limit) | JSON | Chính backend | Bên trong, nhưng giá trị nhỏ |
| Backend ↔ Postgres | Giao thức Postgres | — | Không liên quan |
| Backend ↔ Elasticsearch, Vietmap | JSON | Dịch vụ ngoài | Không đổi được |

### Số đo trên gói nặng nhất (06/11/2026)

Gói nặng nhất là ô lớp tiện ích zoom 13 ở trung tâm Hoàn Kiếm, 2.061 điểm (`/map/layers/places`). Số đo dựng lại từ `data/curated/places/2026-10-18`:

| | Kích thước |
| --- | --- |
| JSON như API trả | 195 KB |
| Cùng JSON đó, gzip | **34 KB** (nhỏ hơn khoảng 6 lần) |
| JSON dạng cột (mỗi trường một mảng) | 131 KB, gzip còn 28 KB |
| Parse JSON | khoảng 1,3 ms mỗi lần |

- Chỉ cần gzip đã vượt mức "nhẹ hơn 4 lần" mà bài viết có được nhờ đổi sang nhị phân.
- MessagePack thường nhỏ hơn JSON 30–40%, nhưng sau gzip thì hai bên gần như ngang nhau.
- Parse khoảng 1 ms là quá nhỏ so với thời gian mạng và truy vấn DB (hàng chục ms).
- Số đo của bài viết nên đọc dè dặt: serialize 1,8 MB JSON mất 142 ms là chậm bất thường với Node 20 (thường 10–20 ms).

### Khi nào xem lại

- Tách backend thành nhiều service gọi nhau với lưu lượng cao: cân nhắc gRPC/Protobuf.
- Đưa pipeline xử lý dữ liệu đánh giá thành luồng sự kiện (Kafka hoặc tương tự): cân nhắc Avro.
- Lớp tiện ích lên cả nước (hàng triệu điểm): chuyển sang **vector tile (MVT)**, định dạng Protobuf mà thư viện bản đồ đọc trực tiếp, sinh bằng PostGIS `ST_AsMVT`. Đây là chỗ nhị phân thực sự đáng dùng trong dự án. Cần cài PostGIS trước.
- Dữ liệu phân tích lớn (dân số, độ cao, ngập): lưu Parquet hoặc GeoParquet trong `data/` thay cho NDJSON. Đây là định dạng file trong bước xử lý dữ liệu, không phải định dạng API.
- Đo thực tế thấy serialize chiếm phần đáng kể trong thời gian phản hồi.

## Bài viết gốc

> Tự hào tối ưu database với clean architecture, cho đến ngày nhận ra JSON đang âm thầm kéo tụt 5 lần tốc độ API...
>
> Nó từng rất tự hào về dàn API của mình. Cho đến ngày nó ngồi đo đạc (benchmark) lại toàn bộ hệ thống.
>
> Sau 3 năm chăm chút cho dự án với clean architecture bài bản, chia route chuẩn chỉ và xử lý lỗi kỹ càng, nó phát hiện thời gian phản hồi (response time) của hệ thống vẫn chậm chạp một cách khó chịu. Nguyên nhân không nằm ở logic nghiệp vụ. Cũng chẳng phải do database chậm. Mà thủ phạm chính lại nằm ở đúng cái thói quen nhét JSON vào mọi ngóc ngách của hệ thống.
>
> **Vấn đề của JSON ở quy mô lớn**
>
> JSON sinh ra để con người đọc. Trình duyệt hay Notepad mở ra là hiểu ngay. Nhưng sự tiện lợi đó phải trả giá bằng hiệu năng khi máy tính giao tiếp với máy tính ở tần suất cao:
>
> Trong một service thực tế của nó, gói dữ liệu 10.000 bản ghi người dùng:
>
> - Định dạng JSON: nặng 2.3 MB, tốn khoảng 180ms chỉ để chuyển đổi dữ liệu (serialize).
> - Định dạng Binary (nhị phân): chỉ nặng 620 KB, tốn khoảng 34ms để serialize.
>
> Cùng một tập dữ liệu, binary nhanh hơn 5 lần và nhẹ hơn gần 4 lần.
>
> Lý do: Trong JSON, mỗi bản ghi có trường "name", chỉ riêng chữ "name" dạng chuỗi đã ngốn 4 byte. Nhân lên hàng triệu request mỗi ngày, hệ thống đang tốn rất nhiều tài nguyên mạng và băng thông chỉ để gửi đi gửi lại những cái tên trường giống hệt nhau.
>
> **Bốn định dạng nhị phân thay thế thực tế**
>
> Sau đợt đó, nó đào sâu tìm hiểu 4 định dạng binary phổ biến nhất tùy theo từng bài toán:
>
> - **Protocol Buffers (Protobuf của Google):** Định nghĩa schema một lần trong file .proto. Khi truyền dữ liệu, Protobuf không gửi tên trường "name" nữa mà thay bằng số tag (1, 2, 3), mỗi tag chỉ tốn 1 byte. Phù hợp nhất: Giao tiếp giữa các microservice nội bộ, gRPC API, data pipeline throughput cao.
> - **MessagePack (JSON "đi tập gym"):** Vẫn giữ cấu trúc key-value quen thuộc và không bắt buộc viết schema trước, có thể chuyển đổi từ object JSON hiện tại ngay lập tức. MessagePack dùng 1 byte để đại diện cho các giá trị phổ biến như số nguyên nhỏ, boolean, null. Nó thử đổi payload WebSocket sang MessagePack trong một buổi chiều, dung lượng giảm ngay 38% mà không cần sửa một dòng logic nghiệp vụ nào. Phù hợp nhất: WebSocket payload, Redis cache, những nơi kiểm soát được cả hai đầu gửi và nhận.
> - **Apache Avro:** Định dạng được thiết kế tối ưu cho Kafka và event streaming. Avro lưu schema kèm dữ liệu và hỗ trợ tiến hóa cấu trúc (schema evolution) rất tốt: consumer đọc event từ 6 tháng trước vẫn chạy bình thường sau khi bảng được thêm 3 trường mới. Khi chuyển event bus nội bộ sang Avro, consumer lag của Kafka giảm từ 40 giây trong giờ cao điểm xuống dưới 4 giây trên cùng một cụm hạ tầng. Phù hợp nhất: Kafka streaming, data lake, các hệ thống cần schema evolution theo thời gian.
> - **FlatBuffers (Google):** Khác với các định dạng khác phải giải nén (deserialize) từ byte ra object trong bộ nhớ, FlatBuffers tổ chức dữ liệu nhị phân sao cho chương trình có thể đọc trực tiếp từ bộ đệm (zero-copy), không mất thời gian deserialize. Phù hợp nhất: Hệ thống thời gian thực đòi hỏi độ trễ cực thấp, dữ liệu tài chính, game server.
>
> **Số liệu Benchmark thực tế (Node.js 20, payload 5.000 bản ghi, 8 trường)**
>
> - JSON: 1.8 MB | Serialize: 142ms | Deserialize: 98ms
> - MessagePack: 1.1 MB | Serialize: 61ms | Deserialize: 44ms
> - Protobuf: 680 KB | Serialize: 38ms | Deserialize: 29ms
> - Avro: 590 KB | Serialize: 35ms | Deserialize: 31ms
> - FlatBuffers: 720 KB | Serialize: 28ms | Deserialize: ~2ms (nhờ cơ chế zero-copy đọc trực tiếp từ RAM)
>
> **Ranh giới kiến trúc: Khi nào dùng cái gì?**
>
> Bài học lớn nhất mà nó rút ra được: Đừng bao giờ cực đoan vứt bỏ hoàn toàn JSON. JSON vẫn là lựa chọn số một cho Public API, file config và những nơi lập trình viên cần debug bằng mắt. Lần đầu tiên hệ thống gặp sự cố lúc nửa đêm mà mở file log ra chỉ thấy toàn chuỗi nhị phân vô nghĩa, bạn sẽ hiểu vì sao JSON vẫn tồn tại bền bỉ.
>
> Ranh giới đúng nằm ở việc phân định ai là người đọc dữ liệu:
>
> - Vùng rìa bên ngoài (Client app, Public REST API): Dùng JSON để con người dễ kiểm tra, debug.
> - Sâu bên trong hệ thống (Service-to-service, Cache, Kafka streaming): Dùng Binary (Protobuf, MessagePack, Avro) để tối ưu băng thông và tốc độ giữa các máy tính với nhau.
>
> Hệ thống của anh em hiện tại đang dùng định dạng gì cho các luồng gọi nội bộ giữa các service? Vẫn trung thành với JSON hay đã tách dần sang Protobuf / gRPC rồi?
