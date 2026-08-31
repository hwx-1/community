# xsnbb 移动端

面向 iOS 与 Android 的 React Native 原生应用。当前已接入仓库内的 Go API，并实现：

- 手机号登录与注册（含开发环境短信验证码）
- 首页信息流、公告/热门话题摘要、搜索、帖子详情、评论
- 点赞、收藏、深色模式与下拉刷新
- 校园百宝箱与外部工具链接
- 发布文字、最多 9 张图片和最多 3 个标签
- 通知、私信列表与自由消息会话
- 个人资料概览、内容统计、资料完整度、头像/资料编辑与未保存保护
- 学生认证、密码修改、其他设备会话撤销、账号注销和退出确认
- 全端统一使用 Ant Design Icons（阿里系）SVG 图标，支持深浅主题与无障碍标签
- 原生页面转场、可中断按压动效、列表分批渲染和请求超时反馈

## 环境要求

- Node.js 22.11+
- pnpm 10+
- iOS：macOS、完整 Xcode、CocoaPods
- Android：Android Studio、Android SDK、JDK 17+

## 本地运行

先在仓库根目录安装依赖并启动 API：

```bash
corepack pnpm install
corepack pnpm dev:server
```

另开终端启动 Metro：

```bash
corepack pnpm dev:mobile
```

再启动目标平台：

```bash
corepack pnpm ios
corepack pnpm android
```

Android 模拟器默认请求 `http://10.0.2.2:8080`，iOS 模拟器默认请求 `http://localhost:8080`。真机联调时，请将 `src/api/client.ts` 中的 `API_BASE_URL` 改成电脑局域网地址或线上 HTTPS 地址。

## 检查

```bash
corepack pnpm --filter @xsnbb/mobile build
corepack pnpm --filter @xsnbb/mobile lint
corepack pnpm --filter @xsnbb/mobile test
```

生产发布前必须配置线上 HTTPS API、正式应用图标与启动图、签名证书、隐私说明和应用商店元数据。
