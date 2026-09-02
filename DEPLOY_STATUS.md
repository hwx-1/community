# 沈阳大学校园社区（xsnbb）部署手册（云效版）

> 2026-09-02 已从 GitHub + GitHub Actions 迁移至阿里云云效（Codeup + Flow）。
> GitHub 仓库（hwx-1/community）仅保留为镜像，不再承担部署。

## 一、部署架构

```
本地 git push codeup main
        │
        ▼
云效 Codeup（代码库）
        │ 代码提交触发
        ▼
云效 Flow 流水线
  1. Go 构建：cd server && go test ./... && go build ./...
  2. 构建物上传：整个源码打包（路径 ./）
  3. 主机部署：制品下载到服务器 → rsync 同步到 /opt/xsnbb
     （排除 infra/.env）→ docker compose 构建 → 替换容器 → 健康检查
        │
        ▼
生产服务器（39.106.198.88）docker compose 运行
```

要点：

- 部署**不再走** 服务器 `git pull`，代码由流水线制品下发，`/opt/xsnbb/.git` 的 remote 配置已不参与部署
- 服务器上的 `infra/.env`（生产配置）不在仓库中，rsync 已排除，部署不会影响它
- 数据库与上传文件使用 Docker 命名卷（pgdata / xsnbb-data / xsnbb-uploads），不受部署影响
- 流水线部署任务超时已设为 3600 秒，暂停方式为「不暂停」

## 二、服务器信息

| 项目 | 值 |
|-----|-----|
| 公网 IP | 39.106.198.88 |
| 操作系统 | Ubuntu 22.04 LTS (x86_64) |
| 域名 | xsnbb.xyz / www.xsnbb.xyz |
| 代码路径 | /opt/xsnbb |
| 应用端口 | 8080（Nginx 443 → 8080） |

## 三、日常开发与部署

### 日常推送（自动部署）

```bash
cd /Users/zhihu/community
git add .
git commit -m "your message"
git push codeup main        # 推送即触发流水线，几分钟后自动上线
```

如需同步 GitHub 镜像：`git push origin main`

### 手动触发部署

云效 → 流水线 Flow → 选择流水线 → 「运行」。用于不改代码只重新部署（如改了服务器 .env）。

### 验证部署结果

```bash
curl -fsS https://xsnbb.xyz/api/v1/capabilities   # 返回 JSON 即正常
```

## 四、回滚

- **方式一（推荐）**：`git revert <有问题的提交>` 后 `git push codeup main`，流水线自动重新部署
- **方式二**：云效 Flow → 运行历史 → 找到上一个绿色运行 → 「重新运行」（使用当时的制品重新下发，无需改代码）

## 五、常用运维命令

```bash
# SSH 登录服务器（部署专用密钥）
ssh -i ~/.ssh/xsnbb_deploy_ed25519 -o IdentitiesOnly=yes root@39.106.198.88

# 查看容器状态与日志
docker ps
docker logs -f xsnbb
docker logs -f xsnbb-db

# 重启服务
cd /opt/xsnbb/infra && docker compose -f docker-compose.prod.yml restart

# 进入 PostgreSQL
docker exec -it xsnbb-db psql -U xsnbb -d xsnbb

# 备份数据库
mkdir -p /opt/backups
docker exec xsnbb-db pg_dump -U xsnbb -d xsnbb -Fc > /opt/backups/xsnbb-$(date +%F).dump

# 系统状态
systemctl status nginx
certbot certificates
ufw status
df -h && free -h
```

## 六、访问地址

| 服务 | 地址 | 说明 |
|-----|------|------|
| 社区首页 | https://xsnbb.xyz | 注册/手机号登录 |
| 管理后台 | https://xsnbb.xyz/admin/ | admin，密码已于 2026-09-02 通过独立安全流程重置（API/界面均不支持超管改密：生成 argon2id 哈希 → 停服 → 替换 db_store_snapshots 快照中 admin_password_hashes.admin → 重启）。`.env` 的 SUPER_ADMIN_PASSWORD 仅在无任何超管的全新初始化时生效 |
| Portainer | http://39.106.198.88:9000 | Docker 可视化管理 |

## 七、凭据与密钥位置

| 凭据 | 位置 | 用途 |
|------|------|------|
| 云效访问令牌 | macOS 钥匙串（git 自动读取） | 本地 push 到 Codeup |
| `~/.ssh/xsnbb_deploy_ed25519` | 本机 + 服务器 authorized_keys | SSH 登录服务器运维 |
| Codeup 仓库部署密钥 | 服务器 `/root/.ssh/codeup_readonly_ed25519` | 备用：服务器从 Codeup 拉代码（当前部署不使用） |
| 生产环境变量 | 服务器 `/opt/xsnbb/infra/.env`（权限 600） | 数据库密码、超管初始化、SMS_* 等 |
| 短信 AccessKey | 服务器 `/opt/xsnbb/infra/.env` 的 `SMS_ACCESS_KEY` / `SMS_SECRET` | 号码认证服务（RAM 子用户，AliyunDypnsFullAccess） |
| OSS AccessKey | 服务器 `/opt/xsnbb/infra/.env` 的 `OSS_ACCESS_KEY` / `OSS_SECRET` | OSS 图片上传（RAM 子用户，仅 xsnbb-img Bucket 最小权限） |

## 八、已完成的外部服务接入

### 短信验证码（号码认证服务 dypnsapi）✅ 2026-09-02

- 产品：**号码认证服务**（不是短信服务 dysmsapi），按发送量计费
- 模式：验证码由本服务生成/存储/校验（有效期 5 分钟、3 次试错、一次性），阿里云仅负责下发（SendSmsVerifyCode）
- 签名：赠送签名 `恒创联众`（该产品不支持自定义签名）；模板：赠送模板 `100001`（变量 `${code}` / `${min}`）
- 凭据：RAM 子用户 AccessKey（策略 AliyunDypnsFullAccess），存于服务器 `infra/.env` 的 `SMS_*` 四项
- 验收：`/api/v1/capabilities` 返回 `"sms":{"dev_mode":false}`，真实手机号注册全流程通过

### Nginx 上传限制修复 ✅ 2026-09-02

- 问题：nginx 默认 `client_max_body_size 1m` 导致头像上传 413
- 修复：服务器 `/etc/nginx/sites-available/xsnbb` 已同步为仓库版本（6m 限制、安全响应头、静态缓存、WebSocket 预留）
- 注意：**nginx 配置不在流水线覆盖范围**（位于 /etc/nginx），修改 `infra/nginx/xsnbb.conf` 后需手动 scp 到服务器并 `nginx -t && systemctl reload nginx`

### 阿里云 OSS 图片存储 ✅ 2026-09-02

- Bucket：`xsnbb-img`（华北 2 北京，标准存储，公共读），Endpoint `oss-cn-beijing.aliyuncs.com`
- 凭据：RAM 子用户（自定义最小权限策略，仅该 Bucket 的 Put/Get/Delete），存于 `infra/.env` 的 `OSS_*` 四项
- 验收：`/api/v1/capabilities` 返回 `"oss":{"dev_mode":false}`，新上传图片 URL 为 `https://xsnbb-img.oss-cn-beijing.aliyuncs.com/...`
- 兼容：切换前上传的本地图片继续由 `/uploads/` 路径访问，无需迁移
- CDN：已接入 ✅ 加速域名 `img.xsnbb.xyz`（回源 OSS Bucket，按流量计费，免费 DV 证书 3 个月自动轮换入口在云盾 SSL 证书服务）；新上传图片 URL 为 `https://img.xsnbb.xyz/...`，由 `OSS_PUBLIC_BASE` 环境变量控制

## 九、未完成事项

### 中优先级（影响真实用户使用）
- [ ] **阿里云内容安全接入**（现为内置演示违禁词 BANNED_WORDS，涉及 server/internal/adapters/adapters.go）
- [ ] **AccessKey 轮换**（2026-09-02 短信与 OSS 两对 Key 的 Secret 曾在聊天中明文出现，建议 RAM 控制台禁用旧 Key 后生成新 Key 更新 .env）

### 低优先级（内测阶段可延后）
- [ ] **AI 问答真实 API 接入**（需 OpenAI 兼容 API 的 BaseURL + Key，如 DashScope）
- [ ] **Redis 接入**（后续用于限流、会话存储、任务队列）

真实用户开放注册/发帖前，确认 `/api/v1/capabilities` 不再显示相关能力处于开发模式。

---

*迁移完成时间：2026-09-02*
