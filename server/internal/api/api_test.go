package api_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/xsnbb/server/internal/adapters"
	"github.com/xsnbb/server/internal/api"
	"github.com/xsnbb/server/internal/app"
	"github.com/xsnbb/server/internal/config"
)

// newTestServer 以全部开发模式适配器装配一个内存测试服务。
func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	gin.SetMode(gin.TestMode)
	cfg := config.Load()
	cfg.UploadDir = t.TempDir()
	store := app.NewStore(cfg)
	r := gin.New()
	api.New(cfg, store, adapters.New(cfg)).Register(r)
	return httptest.NewServer(r)
}

// client 带 Cookie 会话与 CSRF 的测试客户端。
type client struct {
	t       *testing.T
	base    string
	http    *http.Client
	cookies map[string]string
}

func newClient(t *testing.T, base string) *client {
	return &client{t: t, base: base, http: &http.Client{}, cookies: map[string]string{}}
}

func (c *client) do(method, path string, body any) (int, map[string]any) {
	c.t.Helper()
	var reader *bytes.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		reader = bytes.NewReader(raw)
	} else {
		reader = bytes.NewReader(nil)
	}
	req, err := http.NewRequest(method, c.base+path, reader)
	if err != nil {
		c.t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	for name, value := range c.cookies {
		req.AddCookie(&http.Cookie{Name: name, Value: value})
	}
	csrf := c.cookies["xsnbb_csrf"]
	if adminCSRF := c.cookies["xsnbb_admin_csrf"]; adminCSRF != "" {
		csrf = adminCSRF
	}
	if csrf != "" {
		req.Header.Set("X-CSRF-Token", csrf)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer resp.Body.Close()
	for _, cookie := range resp.Cookies() {
		c.cookies[cookie.Name] = cookie.Value
	}
	out := map[string]any{}
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return resp.StatusCode, out
}

func (c *client) login(t *testing.T, phone, password string) {
	t.Helper()
	status, body := c.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"phone": phone, "password": password})
	if status != http.StatusOK {
		t.Fatalf("login failed: %d %v", status, body)
	}
}

func TestHealthz(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()
	c := newClient(t, srv.URL)
	status, body := c.do(http.MethodGet, "/healthz", nil)
	if status != http.StatusOK || body["status"] != "ok" {
		t.Fatalf("unexpected healthz: %d %v", status, body)
	}
}

func TestRegisterRequiresSMSCode(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()
	c := newClient(t, srv.URL)

	// 未先取验证码直接注册应失败
	status, _ := c.do(http.MethodPost, "/api/v1/auth/register", map[string]string{
		"phone": "13911112222", "code": "000000", "password": "Pass12345", "invite_code": "xsnbb-test",
	})
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 without sms code, got %d", status)
	}

	// 开发模式验证码随响应返回并显式标记 dev_mode
	status, sms := c.do(http.MethodPost, "/api/v1/auth/sms-code", map[string]string{"phone": "13911112222", "purpose": "register"})
	if status != http.StatusOK || sms["dev_mode"] != true {
		t.Fatalf("expected dev-mode sms, got %d %v", status, sms)
	}
	code, _ := sms["dev_code"].(string)
	if code == "" {
		t.Fatal("expected dev_code in dev mode")
	}

	// 120 秒间隔限制
	status, _ = c.do(http.MethodPost, "/api/v1/auth/sms-code", map[string]string{"phone": "13911112222", "purpose": "register"})
	if status != http.StatusTooManyRequests {
		t.Fatalf("expected 429 within resend interval, got %d", status)
	}

	// 错误验证码计入尝试次数
	status, _ = c.do(http.MethodPost, "/api/v1/auth/register", map[string]string{
		"phone": "13911112222", "code": "999999", "password": "Pass12345", "invite_code": "xsnbb-test",
	})
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 for wrong code, got %d", status)
	}

	// 正确验证码 + 邀请码注册成功
	status, body := c.do(http.MethodPost, "/api/v1/auth/register", map[string]string{
		"phone": "13911112222", "code": code, "password": "Pass12345", "nickname": "测试同学", "invite_code": "xsnbb-test",
	})
	if status != http.StatusCreated {
		t.Fatalf("register failed: %d %v", status, body)
	}

	// 已登录可读取本人信息
	status, body = c.do(http.MethodGet, "/api/v1/me", nil)
	if status != http.StatusOK {
		t.Fatalf("me failed: %d %v", status, body)
	}
}

func TestPostModerationFlow(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()
	c := newClient(t, srv.URL)
	c.login(t, "13800000000", "Demo12345") // 种子账号：已认证

	// 正常帖子开发模式自动通过
	status, body := c.do(http.MethodPost, "/api/v1/posts", map[string]any{"text": "周五晚上图书馆三层自习，有约的吗", "tags": []string{"自习"}})
	if status != http.StatusCreated {
		t.Fatalf("create post failed: %d %v", status, body)
	}
	post := body["post"].(map[string]any)
	if post["status"] != "public" {
		t.Fatalf("expected public post, got %v", post["status"])
	}

	// 命中演示违禁词被拒绝
	status, body = c.do(http.MethodPost, "/api/v1/posts", map[string]any{"text": "代考英语四级，包过"})
	if status != http.StatusCreated {
		t.Fatalf("create post failed: %d %v", status, body)
	}
	rejected := body["post"].(map[string]any)
	if rejected["status"] != "rejected" {
		t.Fatalf("expected rejected post, got %v", rejected["status"])
	}

	// 信息流只出现公开帖
	status, body = c.do(http.MethodGet, "/api/v1/posts", nil)
	if status != http.StatusOK {
		t.Fatalf("list posts failed: %d", status)
	}
	for _, item := range body["items"].([]any) {
		p := item.(map[string]any)
		if p["text"] == "代考英语四级，包过" {
			t.Fatal("rejected post leaked into feed")
		}
	}
}

func TestReportAndAdminResolve(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	user := newClient(t, srv.URL)
	user.login(t, "13800000001", "Demo12345")
	status, _ := user.do(http.MethodPost, "/api/v1/posts/3/reports", map[string]string{"reason": "测试举报"})
	if status != http.StatusAccepted {
		t.Fatalf("report failed: %d", status)
	}

	// 被举报帖子临时隐藏，不出现在公开信息流
	_, body := user.do(http.MethodGet, "/api/v1/posts", nil)
	for _, item := range body["items"].([]any) {
		if item.(map[string]any)["id"].(float64) == 3 {
			t.Fatal("reported post should be hidden from feed")
		}
	}

	admin := newClient(t, srv.URL)
	status, _ = admin.do(http.MethodPost, "/api/v1/admin/auth/login", map[string]string{"username": "admin", "password": "Admin12345"})
	if status != http.StatusOK {
		t.Fatalf("admin login failed: %d", status)
	}
	status, body = admin.do(http.MethodGet, "/api/v1/admin/reports?status=pending", nil)
	if status != http.StatusOK || len(body["items"].([]any)) == 0 {
		t.Fatalf("expected pending reports, got %d %v", status, body)
	}
	reportID := int64(body["items"].([]any)[0].(map[string]any)["report"].(map[string]any)["id"].(float64))

	// 复核无违规 → 恢复展示
	status, _ = admin.do(http.MethodPatch, fmt.Sprintf("/api/v1/admin/reports/%d", reportID), map[string]string{"action": "restore", "reason": "测试复核通过"})
	if status != http.StatusOK {
		t.Fatalf("resolve report failed: %d", status)
	}
	_, body = user.do(http.MethodGet, "/api/v1/posts", nil)
	found := false
	for _, item := range body["items"].([]any) {
		if item.(map[string]any)["id"].(float64) == 3 {
			found = true
		}
	}
	if !found {
		t.Fatal("restored post should be visible again")
	}
}

func TestAIKnowledgeBaseFirst(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()
	c := newClient(t, srv.URL)
	c.login(t, "13800000000", "Demo12345")

	status, body := c.do(http.MethodPost, "/api/v1/ai/conversations", map[string]string{"title": "测试会话"})
	if status != http.StatusCreated {
		t.Fatalf("create conversation failed: %d %v", status, body)
	}
	convID := int64(body["conversation"].(map[string]any)["id"].(float64))

	// 命中知识库：回答带来源标注
	status, body = c.do(http.MethodPost, fmt.Sprintf("/api/v1/ai/conversations/%d/messages", convID), map[string]string{"text": "教务处电话是多少"})
	if status != http.StatusOK {
		t.Fatalf("ask failed: %d %v", status, body)
	}
	answer := body["answer"].(map[string]any)
	if answer["text"] == "" || answer["source"] == "" {
		t.Fatalf("expected sourced KB answer, got %v", answer)
	}

	// 未命中：记录待补充问题（管理员可见）
	c.do(http.MethodPost, fmt.Sprintf("/api/v1/ai/conversations/%d/messages", convID), map[string]string{"text": "校医院周末开门吗"})
	admin := newClient(t, srv.URL)
	admin.do(http.MethodPost, "/api/v1/admin/auth/login", map[string]string{"username": "admin", "password": "Admin12345"})
	status, body = admin.do(http.MethodGet, "/api/v1/admin/pending-questions", nil) //nolint:govet
	if status != http.StatusOK {
		t.Fatalf("pending questions failed: %d", status)
	}
	found := false
	for _, item := range body["items"].([]any) {
		if item.(map[string]any)["question"] == "校医院周末开门吗" {
			found = true
		}
	}
	if !found {
		t.Fatal("expected unanswered question to be recorded")
	}
}

func TestUnauthenticatedRejected(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()
	c := newClient(t, srv.URL)
	if status, _ := c.do(http.MethodGet, "/api/v1/posts", nil); status != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", status)
	}
	if status, _ := c.do(http.MethodGet, "/api/v1/admin/dashboard", nil); status != http.StatusUnauthorized {
		t.Fatalf("expected 401 for admin, got %d", status)
	}
}

func TestCapabilitiesExposeDevMode(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()
	c := newClient(t, srv.URL)
	status, body := c.do(http.MethodGet, "/api/v1/capabilities", nil)
	if status != http.StatusOK {
		t.Fatalf("capabilities failed: %d", status)
	}
	if body["sms"].(map[string]any)["dev_mode"] != true {
		t.Fatal("expected sms dev_mode=true without credentials")
	}
}
