package router

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/xsnbb/server/internal/config"
)

// Register 挂载全部路由。模块按业务域分组，鉴权中间件后续在各分组内接入。
func Register(r *gin.Engine, cfg *config.Config) {
	// 健康检查：部署与运行观察用
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api/v1")
	{
		// 账号、资料、认证、帖子、评论、私信、通知、工具、AI 问答等模块
		// 将在后续按开发排期逐个挂载到该分组下。
	}
}
