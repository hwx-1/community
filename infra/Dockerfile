# xsnbb 一体化部署镜像：前端构建 → 后端构建 → 单进程运行
# 构建:docker build -f infra/Dockerfile -t xsnbb .
# 运行:docker run -p 8080:8080 -v xsnbb-data:/data xsnbb

# ---- 阶段 1：构建两个前端 ----
FROM docker.m.daocloud.io/library/node:22-alpine AS frontend
WORKDIR /repo
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry https://registry.npmmirror.com
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
RUN pnpm install --frozen-lockfile
COPY apps ./apps
RUN pnpm -r build

# ---- 阶段 2：构建 Go 后端 ----
FROM docker.m.daocloud.io/library/golang:1.25-alpine AS backend
WORKDIR /repo
ARG GOPROXY=https://goproxy.cn,direct
ENV GOPROXY=${GOPROXY}
ENV GOSUMDB=sum.golang.google.cn
COPY server/go.mod server/go.sum ./server/
RUN cd server && go mod download
COPY server ./server
RUN cd server && CGO_ENABLED=0 go build -trimpath -o /xsnbb-api ./cmd/api

# ---- 阶段 3：运行镜像 ----
FROM docker.m.daocloud.io/library/alpine:3.20
# tzdata 必需：Go 的 time.LoadLocation("Asia/Shanghai") 依赖系统时区数据，
# alpine 默认不带，缺失会导致 AI 问答额度统计 panic（接口 500）
RUN apk add --no-cache tzdata
RUN adduser -D xsnbb && mkdir -p /data/uploads && chown xsnbb /data/uploads
WORKDIR /app
COPY --from=backend /xsnbb-api /app/xsnbb-api
COPY --from=frontend /repo/apps/web/dist /app/web/dist
COPY --from=frontend /repo/apps/admin/dist /app/admin/dist
USER xsnbb
ENV APP_ENV=prod \
    HTTP_ADDR=:8080 \
    WEB_DIST=/app/web/dist \
    ADMIN_DIST=/app/admin/dist \
    UPLOAD_DIR=/data/uploads
EXPOSE 8080
# 生产运行时通过环境变量注入:SESSION_SECRET / SUPER_ADMIN_* / SMS_* / OSS_* / SEARCH_*
CMD ["/app/xsnbb-api"]
