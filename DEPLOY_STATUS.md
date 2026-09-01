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
- [x] 超管账号配置（admin / @Hwx15721733287）

### CI/CD
- [x] GitHub Actions workflow 配置文件已创建（.github/workflows/deploy.yml）

---

## 三、未完成事项 ⏳

### 高优先级（影响数据持久化）
- [ ] **后端代码切换到 PostgreSQL**
  - 当前状态：后端仍使用内存存储（map），重启容器数据丢失
  - 数据库已就绪，需要改 Go 代码让 Store 读写走 PostgreSQL
  - 涉及文件：server/internal/app/store.go, server/internal/app/models.go
  - 方案：混合模式（内存缓存 + DB 持久化）

- [ ] **GORM 依赖安装**
  - 服务器宿主机没有 Go 环境
  - 需要用 Docker golang 容器执行 `go get gorm.io/gorm gorm.io/driver/postgres`

### 中优先级（影响真实用户使用）
- [ ] **GitHub Actions 自动部署配置**
  - workflow 文件已创建，但服务器 SSH 密钥之前泄露
  - 需要重新生成密钥对，更新 GitHub Secret
  - 完成后可实现 push 即部署

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

### 方式一：手动部署（当前可用）

```bash
# 1. SSH 登录服务器（Workbench 或本地终端）
ssh root@39.106.198.88

# 2. 拉取最新代码
cd /opt/xsnbb
git pull origin main

# 3. 重新构建并启动
cd infra
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build

# 4. 清理旧镜像（释放空间）
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
| 管理后台 | https://xsnbb.xyz/admin/ | admin / @Hwx15721733287 |
| 学生测试号 | - | 13800000000 / Demo12345 |
| Portainer | http://39.106.198.88:9000 | 首次访问设置密码 |

---

## 七、下一步建议

1. **先完成 GORM 依赖安装**（用 Docker golang 容器）
2. **然后修改 Store 代码**，添加数据库持久化
3. **重新生成 GitHub Actions SSH 密钥**（旧密钥已泄露）
4. **测试自动部署**
5. **接入阿里云内容安全**（真实用户前必须完成）

---

*总结时间：2026-09-02*
