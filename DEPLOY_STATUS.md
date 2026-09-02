# 沈阳大学校园社区（xsnbb）部署状态总结

## 一、服务器信息

| 项目 | 值 |
|-----|-----|
| 公网 IP | 39.106.198.88 |
| 操作系统 | Ubuntu 22.04 LTS |
| 域名 | xsnbb.xyz / www.xsnbb.xyz |
| 代码路径 | /opt/xsnbb |

---

## 二、已完成事项 ✅

### 基础设施
- [x] Ubuntu 系统更新
- [x] Docker & Docker Compose 安装
- [x] Nginx 安装与配置
- [x] UFW 防火墙配置（开放 22/80/443）
- [x] SSL 证书申请（Let's Encrypt，自动续期）
- [x] 域名解析生效（A 记录指向 39.106.198.88）

### 应用部署
- [x] 从 GitHub 拉取代码（https://github.com/hwx-1/community.git）
- [x] Docker 多阶段构建（前端 React + 后端 Go）
- [x] 容器运行（xsnbb 服务在 8080 端口）
- [x] Nginx 反向代理（80 → 443 → 8080）
- [x] 环境变量配置（.env 文件）

### 数据库
- [x] PostgreSQL 17 容器启动（xsnbb-db）
- [x] 数据库迁移执行（10 张表已创建）

### 可视化与管理
- [x] Portainer 安装（Docker 可视化管理）
- [x] 超管账号配置（用户名 admin；密码不再记录在仓库文档中）

### CI/CD
- [x] GitHub Actions workflow 配置文件已创建（.github/workflows/deploy.yml）

---

## 三、未完成事项 ⏳

### 高优先级（代码已完成，等待部署验收）
- [x] **后端切换为内存热状态 + PostgreSQL 同步持久化快照**
  - 所有业务写操作会同步保存；账号/管理员密码哈希等内部字段也纳入快照
  - 生产环境数据库不可用时应用拒绝启动，不再静默使用易丢数据的内存模式
  - 登录会话和短信验证码按安全设计不跨重启保留
- [x] **GORM 与 PostgreSQL 驱动加入 go.mod/go.sum**
- [ ] **服务器验收**：创建测试内容，重启应用容器，确认内容仍存在

### 中优先级（影响真实用户使用）
- [ ] **GitHub Actions 自动部署密钥轮换**
  - workflow 已加入测试门禁、SSH 主机指纹校验、部署健康检查，且不再先停服再构建
  - 仍需在服务器删除泄露的旧公钥，生成部署专用密钥，并更新 GitHub Secrets

- [ ] **阿里云内容安全接入**
  - 当前使用内置演示违禁词（BANNED_WORDS）
  - 需要：阿里云账号、开通内容安全增强版、AccessKey ID/Secret
  - 涉及文件：server/internal/adapters/adapters.go

- [ ] **阿里云短信接入**
  - 当前为开发模式（验证码在 API 响应中返回 dev_code）
  - 需要：阿里云短信签名审批（签名 `xsnbb`）、模板审批、AccessKey

- [ ] **阿里云 OSS 接入**
  - 当前图片存储在本地 uploads/ 目录
  - 需要：阿里云 OSS Bucket、AccessKey、配置 CDN/域名

### 低优先级（内测阶段可延后）
- [ ] **AI 问答真实 API 接入**
  - 当前为开发模式
  - 需要：OpenAI 兼容 API 的 BaseURL + API Key（如 DashScope）

- [ ] **Redis 接入**
  - 当前未使用 Redis
  - 后续用于：限流、会话存储、任务队列

---

## 四、如何更新代码并部署到服务器

### 方式一：首次部署本次持久化更新（当前可用）

```bash
# 1. SSH 登录服务器（Workbench 或本地终端）
ssh root@39.106.198.88

# 2. 先备份数据库
mkdir -p /opt/backups
docker exec xsnbb-db pg_dump -U xsnbb -d xsnbb -Fc > /opt/backups/xsnbb-before-persistence.dump

# 3. 拉取最新代码
cd /opt/xsnbb
git pull --ff-only origin main

# 4. 创建生产配置并填写所有必填值（已有 .env 则逐项补 POSTGRES_PASSWORD）
cd infra
cp -n .env.example.prod .env
chmod 600 .env
editor .env

# 现有 pgdata 使用过旧的硬编码密码；首次升级必须同步轮换数据库角色密码。
# 下面生成的是十六进制密码，可安全放入 PostgreSQL URL。
NEW_DB_PASSWORD="$(openssl rand -hex 32)"
docker exec xsnbb-db psql -U xsnbb -d xsnbb -c "ALTER ROLE xsnbb WITH PASSWORD '$NEW_DB_PASSWORD';"
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$NEW_DB_PASSWORD/" .env
unset NEW_DB_PASSWORD

# 5. 先构建，成功后再替换容器
docker compose -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d --remove-orphans

# 6. 健康检查与日志
curl -fsS http://127.0.0.1:8080/api/v1/capabilities
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=200 xsnbb

# 7. 清理旧镜像（释放空间）
docker image prune -f
```

### 方式二：GitHub Actions 自动部署（配置完成后）

```bash
# 本地修改代码后，直接 push
# 服务器会自动拉取、构建、重启
git add .
git commit -m "your message"
git push origin main
```

---

## 五、常用运维命令速查

```bash
# 查看所有运行中的容器
docker ps

# 查看 xsnbb 服务日志
docker logs -f xsnbb

# 查看数据库日志
docker logs -f xsnbb-db

# 重启 xsnbb 服务
cd /opt/xsnbb/infra && docker compose -f docker-compose.prod.yml restart

# 进入 PostgreSQL 数据库
docker exec -it xsnbb-db psql -U xsnbb -d xsnbb

# 查看 Nginx 状态
systemctl status nginx

# 查看 SSL 证书状态
certbot certificates

# 查看防火墙状态
ufw status

# 查看服务器资源占用
df -h
free -h
```

---

## 六、访问地址

| 服务 | 地址 | 账号 |
|-----|------|------|
| 社区首页 | https://xsnbb.xyz | 注册/手机号登录 |
| 管理后台 | https://xsnbb.xyz/admin/ | admin / 以服务器 `infra/.env` 中首次初始化的密码为准 |
| 学生测试号 | 仅本地开发环境 | 生产环境不再创建已知密码的演示账号 |
| Portainer | http://39.106.198.88:9000 | 首次访问设置密码 |

---

## 七、下一步建议

1. 部署当前代码并完成重启持久化验收
2. 立即轮换文档中曾出现过的超管密码和泄露的 SSH 密钥
3. 配置 `SSH_HOST`、`SSH_USER`、`SSH_PRIVATE_KEY`、`SSH_FINGERPRINT` 四个 GitHub Secrets 并测试自动部署
4. 取得阿里云短信签名/模板、OSS Bucket、内容安全服务和 RAM 最小权限凭证后完成真实接口接入
5. 真实用户开放注册/发帖前，确认 `/api/v1/capabilities` 不再显示相关能力处于开发模式

---

*总结时间：2026-09-02*
