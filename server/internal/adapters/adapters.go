// Package adapters 汇总所有外部服务适配器。
// 每个适配器都有真实实现与开发模式实现：缺少真实凭证时返回开发模式结果，
// 并在响应中显式标记 dev_mode，绝不伪装成真实供应商调用。
package adapters

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/xsnbb/server/internal/config"
)

// ---- 短信 ----

type SMS interface {
	// Send 发送验证码。开发模式下不真正下发，由调用方把验证码直接返回给前端并标记 dev_mode。
	Send(ctx context.Context, phone, code string) error
	DevMode() bool
}

type devSMS struct{}

func (devSMS) Send(_ context.Context, phone, code string) error {
	log.Printf("[dev-sms] 向 %s 下发验证码 %s（开发模式，未真实发送）", phone, code)
	return nil
}
func (devSMS) DevMode() bool { return true }

// aliyunSMS 预留阿里云短信实现；首版未接入 SDK，配置了凭证也明确返回未实现错误。
type aliyunSMS struct{ sign, template string }

func (a aliyunSMS) Send(_ context.Context, phone, _ string) error {
	return fmt.Errorf("短信供应商调用尚未接入（签名 %s / 模板 %s 已配置），当前环境不能发送真实短信", a.sign, a.template)
}
func (a aliyunSMS) DevMode() bool { return false }

// ---- 对象存储 ----

type OSS interface {
	// Put 保存文件并返回可访问 URL。
	Put(ctx context.Context, key string, data []byte, contentType string) (string, error)
	DevMode() bool
}

// localOSS 开发模式实现：写入本地目录，由 API 以 /uploads 静态路径对外提供。
type localOSS struct{ dir string }

func (l localOSS) Put(_ context.Context, key string, data []byte, _ string) (string, error) {
	clean := filepath.Clean("/" + key) // 防目录穿越
	full := filepath.Join(l.dir, clean)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return "", err
	}
	if err := os.WriteFile(full, data, 0o644); err != nil {
		return "", err
	}
	return "/uploads" + clean, nil
}
func (localOSS) DevMode() bool { return true }

type aliyunOSS struct{ bucket, endpoint string }

func (a aliyunOSS) Put(_ context.Context, _ string, _ []byte, _ string) (string, error) {
	return "", fmt.Errorf("OSS 供应商调用尚未接入（bucket %s 已配置），当前环境不能上传真实对象", a.bucket)
}
func (aliyunOSS) DevMode() bool { return false }

// ---- 内容审核 ----

type ModerationResult struct {
	Pass     bool   `json:"pass"`
	Category string `json:"category,omitempty"` // 风险类别
	Reason   string `json:"reason,omitempty"`
	DevMode  bool   `json:"dev_mode"`
}

type Moderation interface {
	CheckText(ctx context.Context, text string) ModerationResult
}

// keywordModeration 开发模式实现：内置少量演示违禁词，命中即拦截。
// 仅用于本地联调，不构成任何真实内容安全能力。
type keywordModeration struct{ words []string }

func (k keywordModeration) CheckText(_ context.Context, text string) ModerationResult {
	lower := strings.ToLower(text)
	for _, w := range k.words {
		if w != "" && strings.Contains(lower, strings.ToLower(w)) {
			return ModerationResult{Pass: false, Category: "违禁词", Reason: "命中内置演示违禁词，请修改后重试", DevMode: true}
		}
	}
	return ModerationResult{Pass: true, DevMode: true}
}

// ---- 联网搜索（供 AI 问答未命中校内资料时使用）----

type Search interface {
	Search(ctx context.Context, query string) (string, error)
	DevMode() bool
}

type devSearch struct{}

func (devSearch) Search(_ context.Context, query string) (string, error) {
	return "", fmt.Errorf("开发模式：未配置联网检索服务，无法为「%s」执行真实搜索", query)
}
func (devSearch) DevMode() bool { return true }

type llmSearch struct{ baseURL, apiKey string }

func (s llmSearch) Search(_ context.Context, _ string) (string, error) {
	return "", errors.New("联网检索供应商调用尚未接入，配置已保存但当前环境不能执行真实搜索")
}
func (llmSearch) DevMode() bool { return false }

// ---- AI 问答（OpenAI 兼容协议）----

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type AI interface {
	// Chat 调用模型完成一次问答。开发模式返回明确的占位回答。
	Chat(ctx context.Context, baseURL, apiKey, model string, messages []ChatMessage) (string, error)
}

type openaiCompatAI struct{ client *http.Client }

func newOpenAICompatAI() *openaiCompatAI {
	return &openaiCompatAI{client: &http.Client{Timeout: 30 * time.Second}}
}

type chatRequest struct {
	Model    string        `json:"model"`
	Messages []ChatMessage `json:"messages"`
}
type chatResponse struct {
	Choices []struct {
		Message ChatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func (o *openaiCompatAI) Chat(ctx context.Context, baseURL, apiKey, model string, messages []ChatMessage) (string, error) {
	if baseURL == "" || apiKey == "" {
		return "", errors.New("AI_PROVIDER_NOT_CONFIGURED")
	}
	body, _ := json.Marshal(chatRequest{Model: model, Messages: messages})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(baseURL, "/")+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	resp, err := o.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", err
	}
	var out chatResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", fmt.Errorf("供应商响应解析失败: %w", err)
	}
	if out.Error != nil {
		return "", errors.New(out.Error.Message)
	}
	if len(out.Choices) == 0 {
		return "", errors.New("供应商未返回候选回答")
	}
	return out.Choices[0].Message.Content, nil
}

// ---- 聚合 ----

type Set struct {
	SMS        SMS
	OSS        OSS
	Moderation Moderation
	Search     Search
	AI         AI
}

// New 根据配置装配适配器。任何缺少真实凭证的服务都落入开发模式实现。
func New(cfg *config.Config) *Set {
	set := &Set{
		Moderation: keywordModeration{words: cfg.BannedWords},
		AI:         newOpenAICompatAI(),
	}
	if cfg.SMSSignName != "" && cfg.SMSTemplate != "" && cfg.SMSAccessKey != "" {
		set.SMS = aliyunSMS{sign: cfg.SMSSignName, template: cfg.SMSTemplate}
	} else {
		set.SMS = devSMS{}
	}
	if cfg.OSSBucket != "" && cfg.OSSEndpoint != "" && cfg.OSSAccessKey != "" {
		set.OSS = aliyunOSS{bucket: cfg.OSSBucket, endpoint: cfg.OSSEndpoint}
	} else {
		set.OSS = localOSS{dir: cfg.UploadDir}
	}
	if cfg.SearchAPIKey != "" && cfg.SearchBaseURL != "" {
		set.Search = llmSearch{baseURL: cfg.SearchBaseURL, apiKey: cfg.SearchAPIKey}
	} else {
		set.Search = devSearch{}
	}
	return set
}
