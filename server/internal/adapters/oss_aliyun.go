package adapters

import (
	"bytes"
	"context"
	"fmt"
	"path"
	"strings"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

// aliyunOSS 阿里云 OSS 真实实现。
// Bucket 需为公共读（public-read）：上传后直接以标准域名 URL 供前端 <img> 引用。
// 若后续接入 CDN，将 publicBase 改为 CDN 域名即可，代码无需其他改动。
type aliyunOSS struct {
	bucket     *oss.Bucket
	publicBase string // 例如 https://bucket-name.oss-cn-beijing.aliyuncs.com
}

func newAliyunOSS(accessKeyID, accessKeySecret, endpoint, bucketName, publicBase string) (*aliyunOSS, error) {
	host := strings.TrimPrefix(strings.TrimPrefix(endpoint, "https://"), "http://")
	client, err := oss.New("https://"+host, accessKeyID, accessKeySecret)
	if err != nil {
		return nil, fmt.Errorf("初始化 OSS 客户端失败: %w", err)
	}
	bucket, err := client.Bucket(bucketName)
	if err != nil {
		return nil, fmt.Errorf("获取 OSS Bucket 失败: %w", err)
	}
	base := strings.TrimRight(publicBase, "/")
	if base == "" {
		base = "https://" + bucketName + "." + host
	}
	return &aliyunOSS{
		bucket:     bucket,
		publicBase: base,
	}, nil
}

func (a *aliyunOSS) Put(_ context.Context, key string, data []byte, contentType string) (string, error) {
	clean := path.Clean("/" + key)[1:] // 防目录穿越，去掉前导斜杠
	opts := []oss.Option{}
	if contentType != "" {
		opts = append(opts, oss.ContentType(contentType))
	}
	if err := a.bucket.PutObject(clean, bytes.NewReader(data), opts...); err != nil {
		return "", fmt.Errorf("OSS 上传失败: %w", err)
	}
	return a.publicBase + "/" + clean, nil
}

func (a *aliyunOSS) DevMode() bool { return false }
