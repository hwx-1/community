#!/bin/bash
# 停止本机/局域网生产模式的 xsnbb 服务
set -euo pipefail
cd "$(dirname "$0")/.."
PID_FILE="$PWD/server/.prod.pid"
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  kill "$(cat "$PID_FILE")"
  echo "已停止 (PID $(cat "$PID_FILE"))"
else
  echo "服务未在运行"
fi
rm -f "$PID_FILE"
