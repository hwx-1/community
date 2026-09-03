package api_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// doStream 发送请求并原样返回 SSE 响应体（供流式接口测试读取）。
func (c *client) doStream(method, path string, body any) (int, string) {
	c.t.Helper()
	raw, _ := json.Marshal(body)
	req, err := http.NewRequest(method, c.base+path, bytes.NewReader(raw))
	if err != nil {
		c.t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
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
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		c.t.Fatal(err)
	}
	return resp.StatusCode, string(data)
}

func TestAIStreamAnswer(t *testing.T) {
	// 模拟 OpenAI 兼容供应商的流式回答：reasoning_content 先于 content 输出
	llm := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Errorf("expected bearer key, got %q", got)
		}
		if got := r.Header.Get("Accept"); got != "text/event-stream" {
			t.Errorf("expected SSE accept, got %q", got)
		}
		var req struct {
			Model    string `json:"model"`
			Stream   bool   `json:"stream"`
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.Model != "campus-llm" {
			t.Errorf("unexpected model: %s", req.Model)
		}
		if !req.Stream {
			t.Errorf("expected stream=true")
		}
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"先查校医院开放时间。\"}}]}\n\n")
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"周末\"}}]}\n\n")
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\" 9:00-17:00 开门\"}}]}\n\n")
		fmt.Fprint(w, "data: [DONE]\n\n")
	}))
	defer llm.Close()

	srv := newTestServer(t)
	defer srv.Close()

	admin := newClient(t, srv.URL)
	admin.do(http.MethodPost, "/api/v1/admin/auth/login", map[string]string{"username": "admin", "password": "Admin12345"})
	status, body := admin.do(http.MethodPost, "/api/v1/admin/ai-providers", map[string]any{
		"name": "校园大模型", "base_url": llm.URL + "/v1", "model": "campus-llm",
		"api_key": "test-key", "enabled": true, "public": true, "fallback_order": 1,
	})
	if status != http.StatusCreated {
		t.Fatalf("create provider failed: %d %v", status, body)
	}

	c := newClient(t, srv.URL)
	c.login(t, "13800000000", "Demo12345")
	status, body = c.do(http.MethodPost, "/api/v1/ai/conversations", map[string]string{"title": ""})
	if status != http.StatusCreated {
		t.Fatalf("create conversation failed: %d %v", status, body)
	}
	convID := int64(body["conversation"].(map[string]any)["id"].(float64))

	status, raw := c.doStream(http.MethodPost, fmt.Sprintf("/api/v1/ai/conversations/%d/messages/stream", convID), map[string]string{"text": "校医院周末开门吗"})
	if status != http.StatusOK {
		t.Fatalf("stream failed: %d %s", status, raw)
	}

	var thinking, text string
	type donePayload struct {
		Answer struct {
			Text      string `json:"text"`
			Reasoning string `json:"reasoning"`
		} `json:"answer"`
		UserMessage struct {
			Text string `json:"text"`
		} `json:"user_message"`
		Remaining int `json:"remaining"`
	}
	var done *donePayload
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			continue
		}
		var evt struct {
			Type  string `json:"type"`
			Delta string `json:"delta"`
		}
		if err := json.Unmarshal([]byte(data), &evt); err != nil {
			t.Fatalf("bad event %q: %v", data, err)
		}
		switch evt.Type {
		case "thinking":
			thinking += evt.Delta
		case "text":
			text += evt.Delta
		case "done":
			var p donePayload
			if err := json.Unmarshal([]byte(data), &p); err != nil {
				t.Fatalf("bad done %q: %v", data, err)
			}
			done = &p
		}
	}

	if thinking != "先查校医院开放时间。" {
		t.Fatalf("unexpected thinking: %q", thinking)
	}
	if text != "周末 9:00-17:00 开门" {
		t.Fatalf("unexpected text: %q", text)
	}
	if done == nil {
		t.Fatal("expected done event")
	}
	if done.Answer.Text != "周末 9:00-17:00 开门" || done.Answer.Reasoning != "先查校医院开放时间。" {
		t.Fatalf("unexpected done answer: %+v", done.Answer)
	}
	if done.UserMessage.Text != "校医院周末开门吗" {
		t.Fatalf("unexpected user message: %+v", done.UserMessage)
	}

	// 落库校验：流式回答应持久化 reasoning 与正文
	status, body = c.do(http.MethodGet, "/api/v1/ai/conversations", nil)
	if status != http.StatusOK {
		t.Fatalf("list conversations failed: %d", status)
	}
	found := false
	for _, item := range body["items"].([]any) {
		conv := item.(map[string]any)
		if int64(conv["id"].(float64)) != convID {
			continue
		}
		messages := conv["messages"].([]any)
		if len(messages) != 2 {
			t.Fatalf("expected 2 messages, got %d", len(messages))
		}
		answer := messages[1].(map[string]any)
		if answer["text"] != "周末 9:00-17:00 开门" || answer["reasoning"] != "先查校医院开放时间。" {
			t.Fatalf("unexpected persisted answer: %v", answer)
		}
		found = true
	}
	if !found {
		t.Fatal("expected streamed conversation to persist")
	}
}
