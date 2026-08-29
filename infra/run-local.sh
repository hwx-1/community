#!/bin/bash
# xsnbb 本机/局域网生产模式启动脚本
# 用法:./infra/run-local.sh [start|stop|status]
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT/server/xsnbb-api.pid"
LOG_FILE="$ROOT/server/xsnbb-api.log"

# 注意:保持 APP_ENV=dev。prod 会强制 Secure Cookie,
# 在 http:// 局域网环境下浏览器会拒存 Cookie 导致无法登录。
export APP_ENV="${APP_ENV:-dev}"
export HTTP_ADDR="${HTTP_ADDR:-:8080}"
export UPLOAD_DIR="$ROOT/server/uploads"
export WEB_DIST="$ROOT/apps/web/dist"
export ADMIN_DIST="$ROOT/apps/admin/dist"

case "${1:-start}" in
  start)
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "已在运行 (PID $(cat "$PID_FILE"))"; exit 0
    fi
    cd "$ROOT/server"
    nohup ./xsnbb-api > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 1
    if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "xsnbb 已启动 (PID $(cat "$PID_FILE")),日志:$LOG_FILE"
    else
      echo "启动失败,查看日志:$LOG_FILE"; exit 1
    fi
    ;;
  stop)
    if [ -f "$PID_FILE" ]; then
      kill "$(cat "$PID_FILE")" 2>/dev/null && echo "已停止" || echo "进程不存在"
      rm -f "$PID_FILE"
    else
      echo "未在运行"
    fi
    ;;
  status)
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "运行中 (PID $(cat "$PID_FILE"))"
    else
      echo "未在运行"
    fi
    ;;
esac
