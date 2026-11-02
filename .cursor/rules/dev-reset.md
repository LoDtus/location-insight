---
description: Công cụ /reset (xóa và dựng lại toàn bộ database) chỉ dành cho máy dev; tuyệt đối không xuất hiện ở production.
globs: "{backend/src/dev-tools/**,website/src/app/reset/**,website/src/features/dev-reset/**,**/Dockerfile*,**/docker-compose*.yml,.env*,Makefile,infra/check-no-dev-reset.sh}"
alwaysApply: true
---

# Công cụ reset dữ liệu dev (`/reset`)

Truy cập `<host>:<WEBSITE_PORT>/reset` ở máy dev, bấm nút xác nhận: xóa toàn bộ database (bảng, kiểu), dựng lại từ entity, flush Redis, chạy lại seed. Dùng khi đổi cấu trúc bảng.

## Quy tắc BẮT BUỘC (cho mọi agent: Claude, Codex, Cursor)

- **Không bao giờ** bật hoặc thêm `DEV_RESET_ENABLED=true`/`DEV_RESET_TOKEN` vào `.env.production`, `.env.staging`, `docker-compose.prod.yml`, Jenkinsfile, CI, Kubernetes hay bất kỳ cấu hình nào ngoài `.env.development`. `.env.example` chỉ chứa `DEV_RESET_ENABLED=false` và token rỗng.
- **Không** nới các điều kiện trong `backend/src/dev-tools/dev-reset.policy.ts` (`NODE_ENV === 'development'`, host database cục bộ, token ≥ 32 ký tự…) và `website/src/features/dev-reset/dev-reset.guard.ts`. Thay đổi chúng phải kèm test và được người dùng đồng ý rõ ràng.
- **Không** import `dev-tools` hay `features/dev-reset` từ mã chạy ở production. Backend chỉ nạp động trong `app.module.ts` (`loadDevTools`). Dockerfile production xóa `backend/src/dev-tools`, `website/src/app/reset`, `website/src/features/dev-reset` TRƯỚC khi build và kiểm tra dist; không gỡ các dòng đó.
- **Không** biến route thành `GET` thực hiện xóa: bắt buộc `POST`, nonce HMAC, cùng origin, token chỉ server biết.
- **Không** chạy `/reset` hoặc `POST /dev/reset` thay người dùng trên database dev của họ nếu họ chưa yêu cầu; dữ liệu dev có thể là dữ liệu họ đang dùng. Thử nghiệm dùng database và Redis tạm.
- Thêm service seed mới (`seed-*.service.ts`) thì thêm vào `backend/src/dev-tools/dev-reset.seed-order.ts` (test sẽ báo thiếu).
- Kiểm tra trước khi phát hành: `make check-no-dev-reset`.

## Nhiều lớp bảo vệ (đừng gỡ lớp nào)

1. Cấu hình: chỉ `.env.development` bật; production để `false`/xóa.
2. Backend không đăng ký route nếu policy sai (module không được nạp); `main.ts` thoát ngay nếu production mà cờ/token được đặt.
3. Guard từng yêu cầu: policy, token (so sánh hằng thời gian), IP riêng/loopback (cả `X-Forwarded-For`), không có `Origin`.
4. Website: 404 nếu không phải dev, host không phải localhost/IP nội bộ/`*.local` (chống DNS rebinding), cùng origin, nonce.
5. Build: Dockerfile xóa mã nguồn công cụ; `next.config.ts` dừng build production nếu cờ bật.
6. CI: `infra/check-no-dev-reset.sh`.
