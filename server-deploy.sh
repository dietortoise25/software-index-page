#!/bin/bash
set -e
ROOT=/var/www/software-index
echo "[deploy] starting..."

cd /tmp/dep 2>/dev/null || { mkdir -p /tmp/dep; cd /tmp/dep; }
tar xzf /tmp/deploy.tar.gz
echo "[deploy] extracted, files:"
ls -d */ 2>/dev/null

echo "[deploy] frontend..."
rm -rf $ROOT/assets $ROOT/index.html $ROOT/favicon.svg $ROOT/ppt
cp -r dist/* $ROOT/
echo "[deploy] frontend done"

echo "[deploy] server..."
cp -r server/dist/* $ROOT/server/dist/
cp server/package.json server/pnpm-lock.yaml $ROOT/server/
(cd $ROOT/server && CI=true pnpm install --prod)
echo "[deploy] server done"

echo "[deploy] platform..."
cd /tmp/dep
rm -rf $ROOT/platform/dist
cp -r platform/dist $ROOT/platform/
cp platform/package.json platform/pnpm-lock.yaml $ROOT/platform/
(cd $ROOT/platform && CI=true pnpm install --prod)
echo "[deploy] platform done"

fuser -k 8765/tcp 2>/dev/null || true
rm -rf /tmp/dep /tmp/deploy.tar.gz
echo "[deploy] all done"
