#!/bin/bash
# xsnbb 本机/局域网生产模式启动脚本
# 单进程托管：社区 Web(/) + 管理后台(/admin/) + API(/api/)，端口 8080
set -euo pipefail
cd "$(dirname "$0")/.."

PID_FILE="$PWD/server/.prod.pid"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "xsnbb 已在运行 (PID $(cat "$PID_FILE"))"
  exit 0
fi

# 前端产物缺失或过期时重新构建
if [ ! -d apps/web/dist ] || [ ! -d apps/admin/dist ]; then
  echo "构建前端产物…"
  corepack pnpm install
  corepack pnpm -r build
fi

echo "构建后端…"
(cd server && go build -o xsnbb-api ./cmd/api)

# 说明：本机/局域网走 HTTP，不能用 APP_ENV=prod（会强制 Secure Cookie，
# 浏览器在 http 下会拒绝写入会话 Cookie）。生产 HTTPS 部署见 infra/deploy.md。
cd server
APP_ENV=dev \
HTTP_ADDR=:8080 \
UPLOAD_DIR=uploads \
WEB_DIST=../apps/web/dist \
ADMIN_DIST=../apps/admin/dist \
./xsnbb-api > xsnbb.log 2>&1 &
echo $! > "$PID_FILE"
sleep 1
echo "xsnbb 已启动 (PID $(cat "$PID_FILE"))"
echo "  社区 Web   http://localhost:8080/"
echo "  管理后台   http://localhost:8080/admin/  (admin / Admin12345)"
echo "  局域网访问 http://$(ipconfig getifaddr en0 2>/dev/null || echo '<本机IP>'):8080/"
echo "停止:scripts/stop-prod.sh  日志:server/xsnbb.log"
