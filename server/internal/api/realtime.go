package api

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// realtimeHub 只广播“数据已变化”信号，不在事件流里携带私信或通知正文。
// 客户端收到信号后通过现有鉴权 REST 接口补拉，断线时继续使用轮询兜底。
type realtimeHub struct {
	mu          sync.RWMutex
	subscribers map[chan struct{}]struct{}
}

func newRealtimeHub() *realtimeHub {
	return &realtimeHub{subscribers: make(map[chan struct{}]struct{})}
}

func (h *realtimeHub) subscribe() (<-chan struct{}, func()) {
	channel := make(chan struct{}, 1)
	h.mu.Lock()
	h.subscribers[channel] = struct{}{}
	h.mu.Unlock()
	return channel, func() {
		h.mu.Lock()
		delete(h.subscribers, channel)
		h.mu.Unlock()
	}
}

func (h *realtimeHub) broadcast() {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for channel := range h.subscribers {
		select {
		case channel <- struct{}{}:
		default:
		}
	}
}

// notifyRealtimeAfterMutation 在成功写请求结束后广播刷新信号。当前内测规模下广播
// 只触发轻量摘要补拉；后续接入 Redis 时可替换为按账号定向发布而不改变客户端协议。
func (a *API) notifyRealtimeAfterMutation() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
		if c.Request.Method == http.MethodGet || c.Writer.Status() < 200 || c.Writer.Status() >= 300 {
			return
		}
		a.realtime.broadcast()
	}
}

// realtimeEvents 使用标准 SSE 提供服务端到客户端的实时失效通知。
func (a *API) realtimeEvents(c *gin.Context) {
	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		fail(c, http.StatusInternalServerError, "STREAM_UNSUPPORTED", "当前服务不支持实时消息流")
		return
	}
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
	c.Status(http.StatusOK)
	_, _ = fmt.Fprint(c.Writer, "event: ready\ndata: {}\n\n")
	flusher.Flush()

	events, unsubscribe := a.realtime.subscribe()
	defer unsubscribe()
	heartbeat := time.NewTicker(20 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-c.Request.Context().Done():
			return
		case <-events:
			_, _ = fmt.Fprint(c.Writer, "event: refresh\ndata: {}\n\n")
			flusher.Flush()
		case <-heartbeat.C:
			_, _ = fmt.Fprint(c.Writer, ": heartbeat\n\n")
			flusher.Flush()
		}
	}
}
