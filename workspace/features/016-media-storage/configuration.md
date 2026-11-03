# Cấu hình lưu trữ (016-media-storage)

Tuân thủ `.cursor/rules/env-docker.md`: giá trị chỉ sửa ở `.env.development`, `.env.production`, `.env.example` ở root. Compose chỉ nối dây. Tài liệu này là đặc tả; chưa sửa các tệp đó.

## Biến môi trường

| Biến | Có sẵn? | Ý nghĩa | Dev (MinIO) | Prod tự host (MinIO) | Prod cloud (R2) |
| --- | --- | --- | --- | --- | --- |
| `S3_ENDPOINT` | Có | Endpoint backend gọi (trong mạng Docker) | `http://minio:9000` (compose ghi đè) | `http://minio:9000` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_PUBLIC_ENDPOINT` | Có (đọc tùy chọn) | Endpoint trình duyệt gọi; dùng để ký URL | `http://127.0.0.1:${MINIO_API_PORT}` | `https://media.<miền>` (reverse proxy tới MinIO) | Giống `S3_ENDPOINT` (URL ký R2 không dùng tên miền riêng) |
| `S3_REGION` | Có | Vùng ký SigV4 | `us-east-1` | `us-east-1` | `auto` |
| `S3_BUCKET` | Có | Tên bucket | `location-insight` | `location-insight` | tên bucket R2 |
| `S3_ACCESS_KEY` | Có | Khóa truy cập | khóa dev | **khóa dịch vụ giới hạn bucket** | token R2 giới hạn bucket (Object Read & Write) |
| `S3_SECRET_KEY` | Có | Bí mật | giá trị dev | giá trị thật, không commit | giá trị thật, không commit |
| `S3_FORCE_PATH_STYLE` | Có | Địa chỉ dạng path | `true` | `true` | `true` (an toàn; R2 chấp nhận) |
| `S3_AUTO_CREATE_BUCKET` | **Mới** | Cho phép tự tạo bucket + đặt CORS khi khởi động | `true` | `false` | `false` |
| `S3_CORS_ORIGINS` | **Mới** (hoặc tái dùng `CORS_ORIGINS`) | Origin web được gọi trực tiếp tới kho | `http://localhost:${WEBSITE_PORT}` | `https://<miền web>` | `https://<miền web>` |
| `S3_REQUEST_TIMEOUT_MS` | **Mới**, tùy chọn | Timeout kết nối/đọc | `5000` | `5000` | `5000` |
| `MINIO_API_PORT`, `MINIO_CONSOLE_PORT` | Có | Cổng publish ra host | như hiện tại | **không publish console** | không dùng |

Ghi chú:

- `S3_ENDPOINT` ở dev bị `environment:` của compose ghi đè thành `http://minio:9000` vì backend chạy trong Docker; đây là ngoại lệ "map tên mà image bắt buộc / nối dây" được `env-docker.md` cho phép. Giá trị này không nên lặp lại trong `.env*` cho prod.
- Giá trị bí mật (`S3_SECRET_KEY`) trong `.env.production` hiện là `change-me-now`; phải thay bằng giá trị thật ngoài repo khi triển khai.
- Bỏ phụ thuộc vào chuỗi cứng trong `storage.service.ts` (xem README §Bối cảnh kỹ thuật, điểm lệch 1–3).

## Dev: dữ liệu ở đâu

- Hiện tại: volume Docker có tên `minio_data`. Chấp nhận được cho dev.
- Người dùng muốn nhìn thấy tệp trên đĩa: dùng bind mount tới `disk/minio` (thư mục `/disk` đã nằm trong `.gitignore`). Lưu ý: MinIO lưu đối tượng ở định dạng nội bộ (không phải cây tệp gốc), nên **không** sao chép tay từng tệp; dùng `mc`/`rclone` để lấy ra.

## Prod tự host (nếu chọn): các điểm bắt buộc

1. Ghim image theo digest, không dùng `latest`. Ghi lại phiên bản đang chạy trong tệp triển khai.
2. Dữ liệu ở **bind mount trên đĩa riêng** (hoặc phân vùng riêng) với giám sát dung lượng. Không đặt chung đĩa hệ điều hành.
3. API S3 chỉ qua reverse proxy TLS; **không** publish cổng console `9001`; không mở `/minio/admin`.
4. Proxy chỉ cho `GET`, `PUT`, `HEAD`, `OPTIONS` tới đường dẫn bucket; chặn `LIST` ẩn danh (bucket không công khai là đủ), giới hạn kích thước thân yêu cầu `PUT` (chẳng hạn 60 MB) và tốc độ.
5. Tạo **người dùng dịch vụ riêng** với chính sách chỉ trên bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:ListBucket", "s3:GetBucketLocation"], "Resource": ["arn:aws:s3:::location-insight"] },
    { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": ["arn:aws:s3:::location-insight/*"] }
  ]
}
```

   (`PutBucketCors` và `CreateBucket` làm một lần bằng khóa root khi dựng hệ thống, vì `S3_AUTO_CREATE_BUCKET=false`.)
6. CORS bucket (cho phép đúng origin web):

```json
[
  {
    "AllowedOrigins": ["https://<miền web>"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

7. Sao lưu hằng đêm (FR-13), ví dụ `rclone sync` từ MinIO tới bucket sao lưu trên R2 hoặc đĩa khác; lưu nhật ký kết quả; thử khôi phục mỗi quý.

## R2: các điểm bắt buộc

1. Tạo bucket thủ công, **không** bật `r2.dev` (không dùng cho production), không gắn tên miền công khai cho bucket này.
2. Tạo **API token chỉ cho bucket này**, quyền Object Read & Write (không cần quyền quản trị bucket). Tạo bucket và CORS làm một lần bằng token quản trị/bảng điều khiển.
3. CORS bucket cấu hình như trên, origin là miền web thật.
4. URL ký dùng endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`; không thể dùng tên miền riêng với URL ký.
5. Tệp công khai sau này: bucket **khác**, tên miền riêng, bật cache (xem `scaling-roadmap.md` bậc 3).
6. Không dùng ACL, tagging, versioning (BR-01).

## Lifecycle bucket (tùy chọn, không bắt buộc)

Có thể cấu hình quy tắc "abort incomplete multipart upload" (MinIO và R2 đều hỗ trợ lifecycle API mới) làm lớp an toàn thứ hai. Dọn tệp mồ côi ở mức nghiệp vụ vẫn do job ứng dụng làm (FR-07) vì chỉ ứng dụng biết dòng `pending` nào đã chết. Không dựa vào lifecycle để xóa tệp thuộc nội dung đã xóa.

## Danh mục kiểm khi đổi nhà cung cấp

- [ ] `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_REGION`, khóa, bucket đã đổi trong `.env*` gốc.
- [ ] CORS bucket mới có đúng origin web.
- [ ] Đã sao chép toàn bộ đối tượng (số lượng và tổng dung lượng khớp).
- [ ] Thử một lượt upload → complete → xem → xóa.
- [ ] Bucket cũ giữ chế độ chỉ đọc đủ lâu để quay lui, rồi xóa khi chắc chắn.
