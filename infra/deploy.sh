#!/bin/bash
# xsnbb 生产部署一键脚本（Ubuntu 22.04/24.04）
# 用法：sudo bash deploy.sh

set -e

# ===== 配置区（编辑这几行） =====
DOMAIN="xsnbb.xyz"
EMAIL="your-email@example.com"   # 用于 Let's Encrypt 证书通知
REPO_URL="https://github.com/yourname/xsnbb.git"  # 你的仓库地址，或手动上传
# =================================

echo "===== 沈阳大学校园社区生产部署脚本 ====="
echo "域名: $DOMAIN"
echo ""

# ---- 1. 系统更新 ----
echo "[1/8] 更新系统..."
apt-get update && apt-get upgrade -y

# ---- 2. 安装必要工具 ----
echo "[2/8] 安装依赖..."
apt-get install -y curl wget git nginx certbot python3-certbot-nginx ufw

# ---- 3. 安装 Docker ----
echo "[3/8] 安装 Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker $SUDO_USER || true
    systemctl enable docker
    systemctl start docker
    echo "Docker 已安装，请重新登录以使用 docker 命令（无需 sudo）"
else
    echo "Docker 已存在，跳过安装"
fi

# 安装 Docker Compose 插件
if ! docker compose version &> /dev/null; then
    apt-get install -y docker-compose-plugin
fi

# ---- 4. 拉取代码 ----
echo "[4/8] 拉取代码..."
INSTALL_DIR="/opt/xsnbb"
if [ -d "$INSTALL_DIR/.git" ]; then
    cd "$INSTALL_DIR"
    git pull
else
    git clone "$REPO_URL" "$INSTALL_DIR" || {
        echo "⚠️  git clone 失败，请手动上传代码到 $INSTALL_DIR"
        mkdir -p "$INSTALL_DIR"
    }
fi

# ---- 5. 配置环境变量 ----
echo "[5/8] 配置环境变量..."
cd "$INSTALL_DIR/infra"

if [ ! -f ".env" ]; then
    cp .env.example.prod .env
    echo "⚠️  请编辑 $INSTALL_DIR/infra/.env 文件，填入 SESSION_SECRET、SUPER_ADMIN_PASSWORD 等必填项"
    echo "    然后重新运行此脚本，或手动执行后续步骤"
    exit 1
fi

# 从 .env 读取 DOMAIN
export $(grep -v '^#' .env | xargs)

# ---- 6. 构建并启动服务 ----
echo "[6/8] 构建 Docker 镜像并启动..."
docker compose -f docker-compose.prod.yml down 2>/dev/null || true
docker compose -f docker-compose.prod.yml up -d --build

# 等待服务启动
echo "等待服务就绪..."
sleep 5
if curl -sf http://127.0.0.1:8080/api/v1/capabilities > /dev/null; then
    echo "✅ 后端服务运行正常"
else
    echo "⚠️  后端服务可能尚未就绪，请检查日志: docker logs xsnbb"
fi

# ---- 7. 配置 Nginx ----
echo "[7/8] 配置 Nginx..."
cp "$INSTALL_DIR/infra/nginx/xsnbb.conf" /etc/nginx/sites-available/xsnbb
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/xsnbb /etc/nginx/sites-enabled/xsnbb

# 创建 certbot webroot
mkdir -p /var/www/certbot

nginx -t && systemctl reload nginx

# ---- 8. 申请 SSL 证书 ----
echo "[8/8] 申请 SSL 证书..."
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email "$EMAIL"
    echo "✅ SSL 证书已申请"
else
    echo "SSL 证书已存在，跳过申请"
fi

# 配置防火墙
echo "配置防火墙..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw --force enable

# 设置自动续期
echo "配置证书自动续期..."
systemctl enable certbot.timer
systemctl start certbot.timer

echo ""
echo "===== 部署完成 ====="
echo "访问地址: https://$DOMAIN"
echo "管理后台: https://$DOMAIN/admin/"
echo ""
echo "查看日志: docker logs -f xsnbb"
echo "重启服务: cd $INSTALL_DIR/infra && docker compose -f docker-compose.prod.yml restart"
echo ""
echo "⚠️  请务必确认 .env 中的 SESSION_SECRET 和 SUPER_ADMIN_PASSWORD 已改为强密码！"
