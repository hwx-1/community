package api

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const maxUploadSize = 10 << 20 // 单张 ≤ 10MB

var allowedImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/heic": ".heic", // 生产环境由服务端转 jpeg，开发模式原样保存
}

// upload 图片上传：格式与大小校验后交给 OSS 适配器。
// 返回 {url, dev_mode}；未配置真实 OSS 时保存到本地目录并显式标记开发模式。
func (a *API) upload(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		fail(c, 422, "FILE_REQUIRED", "请选择要上传的图片")
		return
	}
	defer file.Close()
	if header.Size > maxUploadSize {
		fail(c, 422, "FILE_TOO_LARGE", "单张图片不能超过 10MB")
		return
	}
	ext, ok := allowedImageTypes[header.Header.Get("Content-Type")]
	if !ok {
		// 部分浏览器 HEIC 上报为空或 octet-stream，按扩展名兜底
		lower := strings.ToLower(path.Ext(header.Filename))
		switch lower {
		case ".jpg", ".jpeg":
			ext = ".jpg"
		case ".png":
			ext = ".png"
		case ".webp":
			ext = ".webp"
		case ".heic":
			ext = ".heic"
		default:
			fail(c, 422, "FILE_TYPE_INVALID", "仅支持 jpg / png / webp / heic 图片")
			return
		}
	}
	data, err := io.ReadAll(io.LimitReader(file, maxUploadSize+1))
	if err != nil || len(data) > maxUploadSize {
		fail(c, 422, "FILE_TOO_LARGE", "单张图片不能超过 10MB")
		return
	}
	buf := make([]byte, 8)
	_, _ = rand.Read(buf)
	key := time.Now().Format("2006/01/02") + "/" + hex.EncodeToString(buf) + ext
	url, err := a.adapters.OSS.Put(c.Request.Context(), key, data, header.Header.Get("Content-Type"))
	if err != nil {
		fail(c, 502, "STORAGE_ERROR", err.Error())
		return
	}
	c.JSON(http.StatusCreated, gin.H{"url": url, "dev_mode": a.adapters.OSS.DevMode()})
}
