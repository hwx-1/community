package api_test

import (
	"net/http"
	"strconv"
	"testing"
)

func TestSuperAdminCanConfigureScopedAdministrators(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	super := newClient(t, srv.URL)
	adminLogin(t, super)

	status, body := super.do(http.MethodPost, "/api/v1/admin/roles", map[string]any{
		"name":        "用户运营",
		"permissions": []string{"user.manage"},
	})
	if status != http.StatusCreated {
		t.Fatalf("create role failed: %d %v", status, body)
	}
	roleID := int64(body["role"].(map[string]any)["id"].(float64))

	status, body = super.do(http.MethodPost, "/api/v1/admin/admins", map[string]any{
		"username": "operator_1",
		"password": "Operator12345",
		"role_ids": []int64{roleID},
	})
	if status != http.StatusCreated {
		t.Fatalf("create admin failed: %d %v", status, body)
	}
	created := body["admin"].(map[string]any)
	if created["is_super"] != false || created["enabled"] != true {
		t.Fatalf("unexpected admin response: %v", created)
	}

	operator := newClient(t, srv.URL)
	status, body = operator.do(http.MethodPost, "/api/v1/admin/auth/login", map[string]string{
		"username": "operator_1", "password": "Operator12345",
	})
	if status != http.StatusOK {
		t.Fatalf("operator login failed: %d %v", status, body)
	}
	admin := body["admin"].(map[string]any)
	if admin["is_super"] != false {
		t.Fatalf("operator must not be super: %v", admin)
	}

	if status, _ = operator.do(http.MethodGet, "/api/v1/admin/users", nil); status != http.StatusOK {
		t.Fatalf("granted user.manage should allow user list, got %d", status)
	}
	if status, body = operator.do(http.MethodGet, "/api/v1/admin/posts", nil); status != http.StatusForbidden {
		t.Fatalf("missing post.moderate should be forbidden, got %d %v", status, body)
	}
	if status, body = operator.do(http.MethodGet, "/api/v1/admin/roles", nil); status != http.StatusForbidden {
		t.Fatalf("non-super must not configure roles, got %d %v", status, body)
	}

	status, body = super.do(http.MethodPatch, "/api/v1/admin/roles/"+strconv.FormatInt(roleID, 10), map[string]any{
		"name":        "用户与内容运营",
		"permissions": []string{"user.manage", "post.moderate"},
	})
	if status != http.StatusOK {
		t.Fatalf("update role failed: %d %v", status, body)
	}
	if status, body = operator.do(http.MethodGet, "/api/v1/admin/posts", nil); status != http.StatusOK {
		t.Fatalf("updated role should apply without relogin, got %d %v", status, body)
	}

	enabled := false
	status, body = super.do(http.MethodPatch, "/api/v1/admin/admins/operator_1", map[string]any{
		"role_ids": []int64{roleID}, "enabled": enabled,
	})
	if status != http.StatusOK {
		t.Fatalf("disable admin failed: %d %v", status, body)
	}
	if status, _ = operator.do(http.MethodGet, "/api/v1/admin/dashboard", nil); status != http.StatusUnauthorized {
		t.Fatalf("disabled admin session must be invalidated, got %d", status)
	}
	if status, _ = operator.do(http.MethodPost, "/api/v1/admin/auth/login", map[string]string{"username": "operator_1", "password": "Operator12345"}); status != http.StatusUnauthorized {
		t.Fatalf("disabled admin must not log in, got %d", status)
	}
}

func TestAdminPasswordResetInvalidatesSessions(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()
	super := newClient(t, srv.URL)
	adminLogin(t, super)

	status, body := super.do(http.MethodPost, "/api/v1/admin/admins", map[string]any{
		"username": "auditor_1", "password": "OldPassword1", "role_ids": []int64{},
	})
	if status != http.StatusCreated {
		t.Fatalf("create admin failed: %d %v", status, body)
	}
	auditor := newClient(t, srv.URL)
	if status, _ = auditor.do(http.MethodPost, "/api/v1/admin/auth/login", map[string]string{"username": "auditor_1", "password": "OldPassword1"}); status != http.StatusOK {
		t.Fatalf("initial login failed: %d", status)
	}

	status, body = super.do(http.MethodPost, "/api/v1/admin/admins/auditor_1/reset-password", map[string]string{"password": "NewPassword1"})
	if status != http.StatusOK || body["reset"] != true {
		t.Fatalf("password reset failed: %d %v", status, body)
	}
	if status, _ = auditor.do(http.MethodGet, "/api/v1/admin/dashboard", nil); status != http.StatusUnauthorized {
		t.Fatalf("password reset must invalidate prior sessions, got %d", status)
	}
	newLogin := newClient(t, srv.URL)
	if status, _ = newLogin.do(http.MethodPost, "/api/v1/admin/auth/login", map[string]string{"username": "auditor_1", "password": "OldPassword1"}); status != http.StatusUnauthorized {
		t.Fatalf("old password should fail, got %d", status)
	}
	if status, body = newLogin.do(http.MethodPost, "/api/v1/admin/auth/login", map[string]string{"username": "auditor_1", "password": "NewPassword1"}); status != http.StatusOK {
		t.Fatalf("new password login failed: %d %v", status, body)
	}
}

func TestOnlySuperAdminCanPublishRichAnnouncements(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	super := newClient(t, srv.URL)
	adminLogin(t, super)
	status, body := super.do(http.MethodPost, "/api/v1/admin/announcements", map[string]any{
		"title":     "迎新服务安排",
		"summary":   "报到期间开放线上迎新服务。",
		"body":      "请新同学按页面指引完成报到，如遇问题可联系辅导员。",
		"image_url": "/uploads/2026/08/30/welcome.jpg",
		"link_url":  "https://www.syu.edu.cn/welcome",
		"link_text": "查看迎新指南",
		"published": true,
	})
	if status != http.StatusCreated {
		t.Fatalf("create rich announcement failed: %d %v", status, body)
	}
	created := body["announcement"].(map[string]any)
	if created["image_url"] == "" || created["link_url"] == "" || created["published_at"] == nil {
		t.Fatalf("rich fields were not persisted: %v", created)
	}

	user := newClient(t, srv.URL)
	user.login(t, "13800000000", "Demo12345")
	status, body = user.do(http.MethodGet, "/api/v1/announcements", nil)
	if status != http.StatusOK {
		t.Fatalf("list announcements failed: %d %v", status, body)
	}
	found := false
	for _, raw := range body["items"].([]any) {
		if raw.(map[string]any)["title"] == "迎新服务安排" {
			found = true
		}
	}
	if !found {
		t.Fatal("published announcement should be visible to app clients")
	}

	status, _ = super.do(http.MethodPost, "/api/v1/admin/announcements", map[string]any{
		"title": "草稿公告", "summary": "仅后台可见", "body": "尚未发布", "published": false,
	})
	if status != http.StatusCreated {
		t.Fatalf("create draft failed: %d", status)
	}
	_, body = user.do(http.MethodGet, "/api/v1/announcements", nil)
	for _, raw := range body["items"].([]any) {
		if raw.(map[string]any)["title"] == "草稿公告" {
			t.Fatal("draft announcement leaked to app clients")
		}
	}

	status, _ = super.do(http.MethodPost, "/api/v1/admin/announcements", map[string]any{
		"title": "危险链接", "summary": "链接校验", "body": "链接校验", "link_url": "javascript:alert(1)", "published": true,
	})
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("unsafe link should be rejected, got %d", status)
	}

	status, body = super.do(http.MethodPost, "/api/v1/admin/admins", map[string]any{
		"username": "notice_editor", "password": "NoticeEditor123", "role_ids": []int64{},
	})
	if status != http.StatusCreated {
		t.Fatalf("create non-super admin failed: %d %v", status, body)
	}
	operator := newClient(t, srv.URL)
	status, _ = operator.do(http.MethodPost, "/api/v1/admin/auth/login", map[string]string{"username": "notice_editor", "password": "NoticeEditor123"})
	if status != http.StatusOK {
		t.Fatalf("operator login failed: %d", status)
	}
	if status, _ = operator.do(http.MethodGet, "/api/v1/admin/announcements", nil); status != http.StatusForbidden {
		t.Fatalf("non-super admin must not manage announcements, got %d", status)
	}
}
