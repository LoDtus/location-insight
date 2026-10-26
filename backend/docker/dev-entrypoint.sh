#!/bin/sh
set -e
cd /app

if [ ! -x node_modules/.bin/nest ]; then
  npm ci
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

exec npm run start:dev
