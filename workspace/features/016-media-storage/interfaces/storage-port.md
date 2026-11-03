# Hợp đồng nội bộ: cổng lưu trữ (`StorageService`)

Mô tả hợp đồng mà mọi module dùng. Không phải API HTTP; không thêm endpoint REST mới cho nền tảng này (mỗi module giữ endpoint upload/complete riêng của nó). Bản đặc tả; mã hiện có đã cài đặt phần lớn.

## Phương thức

| Phương thức | Mục đích | S3 operation | Có sẵn trong mã? |
| --- | --- | --- | --- |
| `ping()` | Kiểm sức khỏe | `HeadBucket` | Có |
| `putObject(key, body, contentType)` | Ghi từ server (seed, xử lý ảnh) | `PutObject` | Có |
| `getObject(key)` | Đọc toàn bộ (giới hạn kích thước nhỏ) | `GetObject` | Có |
| `getObjectRange(key, bytes)` | Đọc đầu tệp để đối chiếu chữ ký | `GetObject` + `Range` | Có |
| `objectSize(key)` | Kích thước thực, `null` nếu không có | `HeadObject` | Có |
| `deleteObject(key)` | Xóa một đối tượng | `DeleteObject` | Có |
| `deleteObjects(keys)` | Xóa theo lô (≤ 1000), trả các khóa lỗi | `DeleteObjects` | Có (mới thêm; chưa module nào dùng) |
| `listByPrefix(prefix, cursor, limit)` | Đối soát mồ côi | `ListObjectsV2` | Có (mới thêm; chưa module nào dùng) |
| `getPresignedPutUrl(key, contentType, ttl, opts)` | URL tải lên | URL ký `PUT` | Có |
| `getPresignedUrl(key, ttl, opts)` | URL xem/tải | URL ký `GET` | Có |

`opts` (mới, tùy chọn): `contentLength` cho PUT (xem `research.md` bản ghi 3); `responseContentType`, `responseContentDisposition` cho GET (BR-07); `signingWindowSeconds` để làm tròn mốc ký (bản ghi 4).

## Điều kiện bắt buộc

- `key` luôn do server tạo theo BR-03. Phương thức **từ chối** khóa chứa `..`, bắt đầu bằng `/`, rỗng, hoặc dài hơn 512 byte.
- Không phương thức nào trả về hay ghi nhật ký URL đã ký; chỉ trả cho người gọi để gửi tới đúng người dùng.
- Lỗi `NotFound` của `objectSize` trả `null`; các lỗi khác ném lên (không nuốt). Lưu ý: với khóa dịch vụ không có quyền `ListBucket`, S3 trả 403 thay vì 404 cho khóa thiếu, nên chính sách mẫu trong `configuration.md` có `s3:ListBucket`.
- Thời gian hết hạn tối đa khi ký: PUT 600 giây, GET 3600 giây (hằng số trong `storage.config.ts`, không từ client). URL PUT luôn ký `Content-Type` (đã kiểm chứng trên MinIO).
- Không có phương thức nhận bucket làm tham số: bucket là cấu hình.

## Cột chuẩn cho bảng metadata của module

Mỗi module giữ bảng riêng nhưng dùng cùng các cột (đã gần giống ở `discussion_media`, `feedback_media`, tệp đính kèm messaging):

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | uuid v7 | Khóa chính, cũng là phần cuối của `object_key` |
| `owner_id` | uuid | Người tải lên; dùng cho quyền và hạn mức |
| `object_key` | varchar(512), **unique** | Chỉ khóa, **không** URL/bucket (BR-02) |
| `content_type` | varchar(100) | Đã kiểm theo danh sách cho phép |
| `size_bytes` | bigint | Kích thước **thực** sau `complete` |
| `status` | enum `pending` \| `ready` \| (xóa mềm nếu module cần) | Xem `diagrams/state-media-object.mmd` |
| `created_at` | timestamptz | Dùng cho job dọn `pending` |
| `original_name` | varchar(255), tùy chọn | Đã làm sạch; chỉ để hiển thị |
| `checksum_sha256` | char(64), tùy chọn | Nếu sau này cần chống trùng/kiểm toàn vẹn |

Chỉ mục tối thiểu: `unique(object_key)`, `(status, created_at)` cho job dọn, `(owner_id, status)` cho hạn mức.

## Mã lỗi nghiệp vụ gợi ý

| Tình huống | HTTP | Ghi chú |
| --- | --- | --- |
| Loại/kích thước khai báo không hợp lệ | 422 | Trước khi cấp URL |
| Vượt hạn mức `pending` | 429 | Dùng cơ chế throttle/quota hiện có |
| Tệp chưa được tải lên khi `complete` | 409 | Cho phép thử lại trong hạn |
| Tệp sai chữ ký hoặc vượt kích thước thực | 422 | Đã xóa đối tượng và dòng |
| Không có quyền với dòng metadata | 404 | Không phân biệt "không tồn tại" và "của người khác" |
| Kho tạm thời không phản hồi | 503 | Nhật ký chi tiết, thông báo chung cho người dùng |
