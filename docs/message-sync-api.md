# 消息同步协议（Web / iOS / Android / HarmonyOS）

消息正文始终通过 Cookie 会话鉴权的 REST 接口读取；实时连接只发送“数据已变化”信号，
不携带私信正文。所有客户端都必须以服务端未读数为准，禁止使用设备时间或本地
`lastReadAt` 推算未读。

## REST 数据流

1. `GET /api/v1/direct-conversations`
   - 返回 `items`，按当前用户可见的最新消息时间倒序。
   - 每项包含 `unread_count`。
   - 顶层 `unread` 是所有会话的未读消息总数，用于导航栏和 App 图标冒泡。
2. `GET /api/v1/direct-conversations/:id`
   - 返回会话消息和 `conversation.unread_count`。
   - 审核未通过的消息只对发送者返回。
3. `POST /api/v1/direct-conversations/:id/messages`
   - 成功响应已经包含服务端消息 ID、时间和投递状态；客户端应立即追加到当前详情，
     不必等待下一次列表刷新。
4. `POST /api/v1/direct-conversations/:id/read`
   - 打开会话或在前台收到该会话的新消息后调用。
   - 返回最新全局私信 `unread`，客户端立即更新所有红点。

## 实时失效通知

登录后连接 `GET /api/v1/events`，协议为标准 Server-Sent Events：

- `ready`：连接已建立。
- `refresh`：服务端数据发生变化；重新拉取通知、会话列表，以及当前打开的会话。
- 事件中没有敏感正文。

Web 使用浏览器 `EventSource`。iOS 可使用 `URLSession` 流式读取 SSE，Android 可使用
OkHttp EventSource，React Native 可使用兼容 EventSource 的库。移动端进入后台时关闭
连接，回到前台后立即补拉一次。

SSE 断线自动重连期间，前台每 5 秒补拉私信摘要作为兜底；通知可以使用更长周期。
服务端返回的是完整当前状态，因此重复刷新和重复 `read` 请求必须保持幂等。
