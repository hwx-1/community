package router

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/xsnbb/server/internal/adapters"
	"github.com/xsnbb/server/internal/api"
	"github.com/xsnbb/server/internal/app"
	"github.com/xsnbb/server/internal/config"
)

func Register(r *gin.Engine, cfg *config.Config) {
	store := app.NewStore(cfg)
	ads := adapters.New(cfg)
	// 开发模式下由本地 OSS 适配器写入的 uploads 目录，静态对外提供
	r.Static("/uploads", cfg.UploadDir)
	api.New(cfg, store, ads).Register(r)

	// 生产单二进制部署：托管两个前端的构建产物（目录不存在时跳过，保持纯 API 模式）
	webOK := dirExists(cfg.WebDist)
	adminOK := dirExists(cfg.AdminDist)
	if !webOK && !adminOK {
		return
	}
	r.NoRoute(func(c *gin.Context) {
		p := c.Request.URL.Path
		if strings.HasPrefix(p, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"code": "NOT_FOUND", "message": "接口不存在"}})
			return
		}
		if adminOK && (p == "/admin" || strings.HasPrefix(p, "/admin/")) {
			serveSPA(c, cfg.AdminDist, "/admin")
			return
		}
		if webOK {
			serveSPA(c, cfg.WebDist, "")
			return
		}
		c.Status(http.StatusNotFound)
	})
	log.Printf("static hosting enabled: web=%v admin=%v", webOK, adminOK)
}

func dirExists(dir string) bool {
	info, err := os.Stat(dir)
	return err == nil && info.IsDir()
}

// serveSPA 先尝试精确静态文件，未命中回退到 index.html（前端路由接管）。
func serveSPA(c *gin.Context, root, prefix string) {
	rel := strings.TrimPrefix(c.Request.URL.Path, prefix)
	clean := filepath.Clean("/" + rel) // 防目录穿越
	full := filepath.Join(root, clean)
	if info, err := os.Stat(full); err == nil && !info.IsDir() {
		c.File(full)
		return
	}
	c.File(filepath.Join(root, "index.html"))
}
