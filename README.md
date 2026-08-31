# 沈阳大学校园社区（xsnbb）· 本地运行指南

仓库包含四个可运行部分：

| 部分 | 目录 | 技术 | 端口 |
| --- | --- | --- | --- |
| Go API | `server/` | Go + Gin（内存本地数据实现 + 外部服务适配层） | 8080 |
| 社区 Web | `apps/web/` | React 18 + Vite + CSS Modules | 5173 |
| 管理后台 | `apps/admin/` | React 18 + Vite + Ant Design 5 | 5174 |
| iOS / Android App | `apps/mobile/` | React Native 0.87 + TypeScript | Metro 8081 |
| HarmonyOS App | `apps/harmony/` | ArkTS + ArkUI（Stage 模型，API 12+） | — |

## 快速开始

前置：Go 1.24+、Node 22.11+、pnpm（`corepack enable` 后即可用）。移动端还需要完整 Xcode（iOS）或 Android Studio + Android SDK（Android）。

```bash
# 1. 安装前端依赖（web + admin）
corepack pnpm install

# 2. 准备后端配置（可选，全部留空也能跑：自动落入开发模式）
cp server/.env.example server/.env

# 3. 启动后端（监听 :8080）
corepack pnpm dev:server        # 等价于 go -C server run ./cmd/api

# 4. 另开终端，启动社区 Web（:5173，/api 代理到 8080）
corepack pnpm dev:web

# 5. 另开终端，启动管理后台（:5174，/api 代理到 8080）
corepack pnpm dev:admin

# 6. 移动端：先启动 Metro，再从另一终端启动目标平台
corepack pnpm dev:mobile
corepack pnpm ios       # 需要完整 Xcode + CocoaPods
corepack pnpm android   # 需要 Android SDK 与模拟器/真机

# 7. 鸿蒙端：构建未签名 debug HAP（需已安装 DevEco Studio）
corepack pnpm build:harmony
# 然后用 DevEco Studio 打开 apps/harmony/ 运行到模拟器/真机，
# 并把 AppConfig.ets 中的 API_BASE_URL 改为局域网 IP，详见 apps/harmony/README.md
```

## 内置账号（内存种子数据，重启即重置）

| 角色 | 登录方式 | 说明 |
| --- | --- | --- |
| 学生（已认证） | 手机 `13800000000` / 密码 `Demo12345` | 昵称「李大壮」，可直接发帖 |
| 学生（已认证） | 手机 `13800000001` / 密码 `Demo12345` | 昵称「王小雨」 |
| 学生（已认证） | 手机 `13800000002` / 密码 `Demo12345` | 昵称「张同学」 |
| 超级管理员 | 后台登录名 `admin` / 密码 `Admin12345` | 由 `SUPER_ADMIN_USER/PASSWORD` 首次创建 |

注册新账号：邀请码默认 `xsnbb-test`；开发模式短信验证码直接随 `sms-code` 接口响应的 `dev_code` 字段返回（真实短信未接入，属明确的开发行为）。

## 开发模式说明（重要）

外部服务全部通过适配层接入；缺少真实凭证时返回**明确标记的开发模式结果**，绝不伪装成真实供应商调用：

- **短信**：验证码经 `dev_code` 下发；`GET /api/v1/capabilities` 可查看各服务 `dev_mode` 状态
- **OSS**：图片写入 `server/uploads/`，经 `/uploads` 静态路径提供
- **内容审核**：内置演示违禁词（`BANNED_WORDS`），命中即拦截；不构成真实内容安全能力
- **联网检索**：明确返回未配置错误，AI 未命中知识库时记录「待补充问题」
- **AI 问答**：优先检索知识库；OpenAI 兼容协议适配器已实现，在后台「AI 服务」配置真实 Base URL + API Key 即可调用

## 测试与构建

```bash
corepack pnpm test:server   # go test ./...（含短信边界、审核流、举报复核、禁言/封禁/申诉、注销等）
corepack pnpm build         # web/admin 构建 + mobile TypeScript 检查
corepack pnpm --filter @xsnbb/mobile test
```

## 数据说明

首版 API 使用**内存本地数据实现**（`server/internal/app/store.go`），进程重启即重置；
`server/migrations/001_init.up.sql` 与 `infra/docker-compose.dev.yml`（PostgreSQL + Redis）
为后续切换到 GORM + goose 持久化保留，当前运行不依赖数据库。
