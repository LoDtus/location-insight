#!/bin/sh
# Kiểm tra công cụ reset dữ liệu dev KHÔNG lọt vào cấu hình/ảnh production. Thoát mã 1 nếu vi phạm.
# Dùng trong CI trước khi build/deploy: `make check-no-dev-reset`.
set -eu
cd "$(dirname "$0")/.."
fail=0
bad() { echo "VI PHẠM: $1" >&2; fail=1; }

for file in .env.production .env.staging .env.prod; do
  [ -f "$file" ] || continue
  if grep -Eq '^[[:space:]]*DEV_RESET_ENABLED[[:space:]]*=[[:space:]]*"?true' "$file"; then bad "$file bật DEV_RESET_ENABLED"; fi
  if grep -Eq '^[[:space:]]*DEV_RESET_TOKEN[[:space:]]*=[[:space:]]*[^[:space:]]' "$file"; then bad "$file có DEV_RESET_TOKEN"; fi
done

if grep -q 'DEV_RESET' infra/docker-compose.prod.yml 2>/dev/null; then bad "docker-compose.prod.yml nhắc tới DEV_RESET"; fi
grep -q 'rm -rf src/dev-tools' backend/Dockerfile || bad "backend/Dockerfile không xóa src/dev-tools trước khi build"
grep -q 'rm -rf src/app/reset src/features/dev-reset' website/Dockerfile || bad "website/Dockerfile không xóa route /reset trước khi build"
if git ls-files --error-unmatch .env.development .env.production >/dev/null 2>&1; then bad "file .env đã bị track bởi git"; fi

if [ "$fail" -ne 0 ]; then exit 1; fi
echo "OK: không có công cụ reset dev trong cấu hình production."
