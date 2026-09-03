# xsnbb 生产部署指南（VPS + Nginx + Let's Encrypt）

架构：单个 Go 进程同时提供 API、社区 Web（`/`）和管理后台（`/admin/`），Nginx 只做 HTTPS 终结与反代。

## 方式 A：Docker Compose（推荐）

```bash
cd /opt/xsnbb/infra
cp .env.example.prod .env
# 编辑 .env；随机十六进制值可用 openssl rand -hex 32 生成
chmod 600 .env
docker compose -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
curl -fsS http://127.0.0.1:8080/api/v1/capabilities
```

## 方式 B：裸二进制

```bash
# 本机构建（前端 + 后端）
corepack pnpm install && corepack pnpm -r build
cd server && go build -o xsnbb-api ./cmd/api

# 上传到服务器后（目录保持 server/ 与 apps/*/dist 的相对结构，或用环境变量指定）
APP_ENV=prod SESSION_SECRET='随机串' UPLOAD_DIR=/var/lib/xsnbb/uploads \
  WEB_DIST=/srv/xsnbb/web ADMIN_DIST=/srv/xsnbb/admin ./xsnbb-api
```

systemd 单元示例 `/etc/systemd/system/xsnbb.service`：

```ini
[Unit]
Description=xsnbb campus community
After=network.target

[Service]
User=xsnbb
WorkingDirectory=/srv/xsnbb
Environment=APP_ENV=prod
Environment=HTTP_ADDR=127.0.0.1:8080
Environment=SESSION_SECRET=换成足够长的随机串
Environment=SUPER_ADMIN_USER=admin
Environment=SUPER_ADMIN_PASSWORD=换成强密码
Environment=UPLOAD_DIR=/var/lib/xsnbb/uploads
ExecStart=/srv/xsnbb/xsnbb-api
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## Nginx + HTTPS（域名 xsnbb.xyz）

```nginx
server {
    listen 80;
    server_name xsnbb.xyz www.xsnbb.xyz;
    location / { return 301 https://$host$request_uri; }
}
server {
    listen 443 ssl;
    server_name xsnbb.xyz www.xsnbb.xyz;
    # certbot --nginx 自动填充证书路径
    client_max_body_size 12m;   # 单图 ≤10MB
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

```bash
sudo certbot --nginx -d xsnbb.xyz -d www.xsnbb.xyz
```

`APP_ENV=prod` 时 Cookie 自动带 Secure；请将 `WEB_ORIGIN` / `ADMIN_ORIGIN` 设为 `https://xsnbb.xyz`（同源部署下跨域白名单实际用不到，但保持配置一致）。

## 上线前核对清单

- [ ] `SESSION_SECRET`、`POSTGRES_PASSWORD`、`SUPER_ADMIN_PASSWORD` 和 `INVITE_CODE` 均已换成独立强随机值（超管密码仅首次初始化生效）
- [ ] 短信（`SMS_*`）、OSS（`OSS_*`）、联网检索（`SEARCH_*`）真实凭证已注入；未注入的项会以 dev_mode 明确降级，不会伪装成功
- [ ] 内容审核仍是内置演示违禁词 —— **对真实用户开放发帖前必须接入独立审核服务**
- [x] 业务数据同步写入 PostgreSQL 快照；生产环境数据库不可用时拒绝启动，避免静默退回内存
- [ ] 已执行一次“创建内容 → 重启 xsnbb → 内容仍存在”的验收
