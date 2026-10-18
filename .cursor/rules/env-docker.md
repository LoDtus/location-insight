---
description: Biến môi trường chỉ sửa ở .env root; compose đọc và nối dây; Dockerfile chỉ nhận build-arg bắt buộc.
globs: "{**/Dockerfile*,**/docker-compose*.yml,Makefile,.env.example,.env.development,.env.production}"
alwaysApply: false
---

# Biến môi trường Docker

Giá trị cấu hình chỉ sửa trong `.env.development`, `.env.production` và `.env.example` ở root repo. Không tạo `.env` trong `website/`, `backend/` hay service khác.

`Makefile` truyền `--env-file`. Service ứng dụng dùng `env_file`. Không khai báo lại trong `environment:` một biến đã có cùng tên trong `.env`.

`environment:` chỉ được dùng để:

- Map tên mà image bắt buộc (`WEBSITE_PORT` thành `PORT`, `POSTGRESQL_*` thành `POSTGRES_*`).
- Bind trong container: `HOSTNAME=0.0.0.0`.
- Xóa secret khỏi container không được giữ (`AUTHENTIK_CLIENT_SECRET`, `UBOARD_AUTH_SECRET` trên website).
- Cờ chỉ có nghĩa trong container (`WATCHPACK_POLLING`).

Dockerfile không hardcode cổng, URL hay credential. Chỉ `ARG`/`ENV` cho biến Next.js inline lúc build (`NEXT_PUBLIC_*`), và compose truyền qua `build.args` từ `.env`. Process listen theo biến runtime (`BACKEND_INTERNAL_PORT`), không ghi số cổng trong `CMD`.

Được hardcode cổng mặc định bên trong image: PostgreSQL `5432`, Redis `6379`, MinIO `9000` và `9001`. Cổng publish ra host của những service đó luôn là `${..._PORT}`.

`backend` không có `ports`. Container khác gọi qua tên service: `http://backend` và `BACKEND_INTERNAL_PORT` (biến `API_INTERNAL_URL` / `GATEWAY_INTERNAL_URL` trong `.env`).

```yaml
# Sai: publish gateway ra host, hoặc gọi hostname không khớp tên service
ports:
  - "127.0.0.1:${BACKEND_PORT}:${BACKEND_INTERNAL_PORT}"

# Đúng: chỉ env_file; không có ports
env_file:
  - ../.env.development
```
