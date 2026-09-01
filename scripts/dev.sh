#!/bin/bash
# xsnbb 本地开发一键启动：Go API (:8080) + 社区 Web (:5173)
# 用法: pnpm dev        (Ctrl+C 同时停止两个进程)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PIDS=()

# 递归终止进程树（pnpm -> go run -> 编译产物，逐层杀干净）
kill_tree() {
  local pid=$1
  local children
  children=$(pgrep -P "$pid" 2>/dev/null || true)
  for child in $children; do
    kill_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}

cleanup() {
  echo ""
  echo "正在停止开发服务..."
  for pid in "${PIDS[@]}"; do
    kill_tree "$pid"
  done
}
trap cleanup EXIT INT TERM

pnpm dev:server &
PIDS+=($!)

pnpm dev:web &
PIDS+=($!)

# 任一进程退出即整体退出（兼容 macOS 自带 bash 3.2，无 wait -n）
while true; do
  for pid in "${PIDS[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      exit 0
    fi
  done
  sleep 1
done
