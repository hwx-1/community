package api_test

import (
	"fmt"
	"net/http"
	"testing"
)

// adminLogin 以超级管理员登录后台。
func adminLogin(t *testing.T, c *client) {
	t.Helper()
	status, body := c.do(http.MethodPost, "/api/v1/admin/auth/login", map[string]string{"username": "admin", "password": "Admin12345"})
	if status != http.StatusOK {
		t.Fatalf("admin login failed: %d %v", status, body)
	}
}

// TestPerUserLikeAndBookmark 点赞 / 收藏按用户独立，收藏列表仅本人可见。
func TestPerUserLikeAndBookmark(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	u1 := newClient(t, srv.URL)
	u1.login(t, "13800000000", "Demo12345")
	u2 := newClient(t, srv.URL)
	u2.login(t, "13800000001", "Demo12345")

	// u1 点赞并收藏帖子 3
	status, body := u1.do(http.MethodPost, "/api/v1/posts/3/like", map[string]any{})
	if status != http.StatusOK || body["post"].(map[string]any)["liked"] != true {
		t.Fatalf("like failed: %d %v", status, body)
	}
	likesBefore := body["post"].(map[string]any)["likes"].(float64)
	u1.do(http.MethodPost, "/api/v1/posts/3/bookmark", map[string]any{})

	// u2 看到的同一帖子不应带上 u1 的点赞 / 收藏标记
	_, body = u2.do(http.MethodGet, "/api/v1/posts/3", nil)
	post := body["post"].(map[string]any)
	if post["liked"] != false || post["bookmarked"] != false {
		t.Fatalf("viewer flags leaked across users: %v", post)
	}
	if post["likes"].(float64) != likesBefore {
		t.Fatalf("likes should stay after another user views: %v", post["likes"])
	}

	// 收藏列表只含 u1 的收藏
	_, body = u1.do(http.MethodGet, "/api/v1/me/bookmarks", nil)
	if len(body["items"].([]any)) != 1 {
		t.Fatalf("expected 1 bookmark, got %v", body["items"])
	}
	_, body = u2.do(http.MethodGet, "/api/v1/me/bookmarks", nil)
	if len(body["items"].([]any)) != 0 {
		t.Fatalf("u2 should have no bookmarks, got %v", body["items"])
	}

	// 取消点赞计数回落
	_, body = u1.do(http.MethodPost, "/api/v1/posts/3/like", map[string]any{})
	if body["post"].(map[string]any)["likes"].(float64) != likesBefore-1 {
		t.Fatalf("unlike should decrement, got %v", body["post"].(map[string]any)["likes"])
	}
}

// TestLikeNotification 点赞只在切换为已点赞时通知帖子作者；取消与自赞均不通知。
func TestLikeNotification(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	author := newClient(t, srv.URL) // 帖子 3 作者是账号 2
	author.login(t, "13800000001", "Demo12345")
	liker := newClient(t, srv.URL)
	liker.login(t, "13800000002", "Demo12345")

	status, body := liker.do(http.MethodPost, "/api/v1/posts/3/like", map[string]any{})
	if status != http.StatusOK || body["post"].(map[string]any)["liked"] != true {
		t.Fatalf("like failed: %d %v", status, body)
	}

	_, notifications := author.do(http.MethodGet, "/api/v1/me/notifications", nil)
	items := notifications["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("post author should receive exactly 1 like notification, got %v", items)
	}
	item := items[0].(map[string]any)
	if item["type"] != "like" || item["ref_type"] != "post" || item["ref_id"].(float64) != 3 {
		t.Fatalf("unexpected like notification: %v", item)
	}
	if notifications["unread"].(float64) != 1 {
		t.Fatalf("like notification should be unread: %v", notifications["unread"])
	}

	// 取消点赞不应再产生一条通知。
	liker.do(http.MethodPost, "/api/v1/posts/3/like", map[string]any{})
	_, notifications = author.do(http.MethodGet, "/api/v1/me/notifications", nil)
	if len(notifications["items"].([]any)) != 1 {
		t.Fatalf("unlike should not create a notification: %v", notifications["items"])
	}

	// 作者给自己的帖子点赞不应收到自通知。
	author.do(http.MethodPost, "/api/v1/posts/3/like", map[string]any{})
	_, notifications = author.do(http.MethodGet, "/api/v1/me/notifications", nil)
	if len(notifications["items"].([]any)) != 1 {
		t.Fatalf("self-like should not create a notification: %v", notifications["items"])
	}
}

// TestCommentAndReplyNotifications 主评论通知帖子作者；回复只通知被回复者。
func TestCommentAndReplyNotifications(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	author := newClient(t, srv.URL) // 帖子 2 作者是账号 1
	author.login(t, "13800000000", "Demo12345")
	commenter := newClient(t, srv.URL)
	commenter.login(t, "13800000001", "Demo12345")
	replier := newClient(t, srv.URL)
	replier.login(t, "13800000002", "Demo12345")

	// commenter 在帖子 2 下发主评论 → 通知帖子作者（账号 1）
	status, body := commenter.do(http.MethodPost, "/api/v1/posts/2/comments", map[string]any{"text": "场地我熟，带我一个"})
	if status != http.StatusCreated {
		t.Fatalf("comment failed: %d %v", status, body)
	}
	commentID := int64(body["comment"].(map[string]any)["id"].(float64))
	_, notif := author.do(http.MethodGet, "/api/v1/me/notifications", nil)
	foundCommentNotif := false
	for _, n := range notif["items"].([]any) {
		if n.(map[string]any)["type"] == "comment" {
			foundCommentNotif = true
		}
	}
	if !foundCommentNotif {
		t.Fatal("post author should receive comment notification")
	}

	// replier 回复该主评论 → 只通知主评作者（账号 2），不再通知帖子作者
	status, _ = replier.do(http.MethodPost, "/api/v1/posts/2/comments", map[string]any{"text": "新人求带", "parent_id": commentID})
	if status != http.StatusCreated {
		t.Fatalf("reply failed: %d", status)
	}
	_, notif = commenter.do(http.MethodGet, "/api/v1/me/notifications", nil)
	foundReplyNotif := false
	for _, n := range notif["items"].([]any) {
		if n.(map[string]any)["type"] == "reply" {
			foundReplyNotif = true
		}
	}
	if !foundReplyNotif {
		t.Fatal("parent comment author should receive reply notification")
	}
	_, notif = author.do(http.MethodGet, "/api/v1/me/notifications", nil)
	for _, n := range notif["items"].([]any) {
		if n.(map[string]any)["type"] == "reply" {
			t.Fatal("post author must not be notified of replies")
		}
	}

	// 标记全部已读
	_, body = commenter.do(http.MethodPost, "/api/v1/me/notifications/read", map[string]any{"ids": []int64{}})
	if body["unread"].(float64) != 0 {
		t.Fatalf("expected 0 unread, got %v", body["unread"])
	}
}

// TestMuteAppealFlow 禁言拦截写操作但保留浏览 / 点赞 / AI；申诉一次且仅一次；解除后恢复。
func TestMuteAppealFlow(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	user := newClient(t, srv.URL)
	user.login(t, "13800000000", "Demo12345")
	admin := newClient(t, srv.URL)
	adminLogin(t, admin)

	// 禁言 1 天
	status, _ := admin.do(http.MethodPatch, "/api/v1/admin/users/1", map[string]any{"status": "muted", "mute_days": 1, "reason": "测试禁言"})
	if status != http.StatusOK {
		t.Fatalf("mute failed: %d", status)
	}

	// 禁言中不能发帖，但仍可浏览与点赞
	status, _ = user.do(http.MethodPost, "/api/v1/posts", map[string]any{"text": "禁言期间发帖"})
	if status != http.StatusForbidden {
		t.Fatalf("muted user should not post, got %d", status)
	}
	if status, _ := user.do(http.MethodGet, "/api/v1/posts", nil); status != http.StatusOK {
		t.Fatalf("muted user should still browse, got %d", status)
	}
	if status, _ := user.do(http.MethodPost, "/api/v1/posts/2/like", map[string]any{}); status != http.StatusOK {
		t.Fatalf("muted user should still like, got %d", status)
	}

	// 收到处罚通知，从中拿到 punishment_id 提交申诉
	_, notif := user.do(http.MethodGet, "/api/v1/me/notifications", nil)
	var punishmentID int64
	for _, n := range notif["items"].([]any) {
		m := n.(map[string]any)
		if m["type"] == "punishment" {
			punishmentID = int64(m["ref_id"].(float64))
		}
	}
	if punishmentID == 0 {
		t.Fatal("expected punishment notification")
	}
	status, _ = user.do(http.MethodPost, "/api/v1/me/appeals", map[string]any{"punishment_id": punishmentID, "reason": "测试申诉"})
	if status != http.StatusCreated {
		t.Fatalf("appeal failed: %d", status)
	}
	// 同一处罚不能重复申诉
	status, _ = user.do(http.MethodPost, "/api/v1/me/appeals", map[string]any{"punishment_id": punishmentID, "reason": "重复申诉"})
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("duplicate appeal should fail, got %d", status)
	}

	// 管理员解除处罚 → 账号恢复，可再发帖
	_, body := admin.do(http.MethodGet, "/api/v1/admin/appeals?status=pending", nil)
	appealID := int64(body["items"].([]any)[0].(map[string]any)["appeal"].(map[string]any)["id"].(float64))
	status, _ = admin.do(http.MethodPatch, fmt.Sprintf("/api/v1/admin/appeals/%d", appealID), map[string]string{"action": "lift", "reason": "测试解除"})
	if status != http.StatusOK {
		t.Fatalf("resolve appeal failed: %d", status)
	}
	status, _ = user.do(http.MethodPost, "/api/v1/posts", map[string]any{"text": "解除禁言后的帖子"})
	if status != http.StatusCreated {
		t.Fatalf("user should post after lift, got %d", status)
	}
}

// TestBannedAccountRestricted 封号后仅保留通知与申诉入口。
func TestBannedAccountRestricted(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	user := newClient(t, srv.URL)
	user.login(t, "13800000001", "Demo12345")
	admin := newClient(t, srv.URL)
	adminLogin(t, admin)

	status, _ := admin.do(http.MethodPatch, "/api/v1/admin/users/2", map[string]any{"status": "banned", "reason": "测试封禁"})
	if status != http.StatusOK {
		t.Fatalf("ban failed: %d", status)
	}

	if status, _ := user.do(http.MethodGet, "/api/v1/posts", nil); status != http.StatusForbidden {
		t.Fatalf("banned user should not browse posts, got %d", status)
	}
	if status, _ := user.do(http.MethodGet, "/api/v1/me/notifications", nil); status != http.StatusOK {
		t.Fatalf("banned user should read notifications, got %d", status)
	}
	if status, _ := user.do(http.MethodGet, "/api/v1/me/appeals", nil); status != http.StatusOK {
		t.Fatalf("banned user should read appeals, got %d", status)
	}
	// 封号不自动隐藏已公开历史帖
	admin2 := newClient(t, srv.URL)
	admin2.login(t, "13800000000", "Demo12345")
	_, body := admin2.do(http.MethodGet, "/api/v1/posts", nil)
	found := false
	for _, item := range body["items"].([]any) {
		if item.(map[string]any)["id"].(float64) == 3 { // 账号 2 的公开帖
			found = true
		}
	}
	if !found {
		t.Fatal("banned user's public posts should remain visible")
	}
}

// TestChangePasswordAndDeleteAccount 改密后新密码可登录；注销后会话失效、资料匿名化。
func TestChangePasswordAndDeleteAccount(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	c := newClient(t, srv.URL)
	c.login(t, "13800000002", "Demo12345")
	otherDevice := newClient(t, srv.URL)
	otherDevice.login(t, "13800000002", "Demo12345")

	status, _ := c.do(http.MethodPost, "/api/v1/me/password", map[string]string{"current_password": "wrong-pass", "new_password": "NewPass123"})
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("wrong current password should fail, got %d", status)
	}
	status, _ = c.do(http.MethodPost, "/api/v1/me/password", map[string]string{"current_password": "Demo12345", "new_password": "NewPass123"})
	if status != http.StatusOK {
		t.Fatalf("change password failed: %d", status)
	}
	if status, _ = c.do(http.MethodGet, "/api/v1/me", nil); status != http.StatusOK {
		t.Fatalf("current session should remain active after password change, got %d", status)
	}
	if status, _ = otherDevice.do(http.MethodGet, "/api/v1/me", nil); status != http.StatusUnauthorized {
		t.Fatalf("other device session should be revoked after password change, got %d", status)
	}

	// 旧密码失效，新密码可登录
	relogin := newClient(t, srv.URL)
	status, _ = relogin.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"phone": "13800000002", "password": "Demo12345"})
	if status != http.StatusUnauthorized {
		t.Fatalf("old password should fail, got %d", status)
	}
	relogin.login(t, "13800000002", "NewPass123")

	// 注销：会话立即失效，公开主页 404，帖子作者匿名化
	status, _ = relogin.do(http.MethodDelete, "/api/v1/me", nil)
	if status != http.StatusNoContent {
		t.Fatalf("delete account failed: %d", status)
	}
	if status, _ := relogin.do(http.MethodGet, "/api/v1/me", nil); status != http.StatusUnauthorized {
		t.Fatalf("session should be invalidated after deletion, got %d", status)
	}
	other := newClient(t, srv.URL)
	other.login(t, "13800000000", "Demo12345")
	if status, _ := other.do(http.MethodGet, "/api/v1/users/3", nil); status != http.StatusNotFound {
		t.Fatalf("deactivated profile should be 404, got %d", status)
	}
}

// TestDirectConversationStartAndReport 私信发起幂等复用；用户举报被受理。
func TestDirectConversationStartAndReport(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	c := newClient(t, srv.URL)
	c.login(t, "13800000000", "Demo12345")

	status, body := c.do(http.MethodPost, "/api/v1/direct-conversations", map[string]any{"user_id": 2})
	if status != http.StatusCreated {
		t.Fatalf("start conversation failed: %d %v", status, body)
	}
	firstID := body["item"].(map[string]any)["id"].(float64)

	// 再次发起复用同一会话
	status, body = c.do(http.MethodPost, "/api/v1/direct-conversations", map[string]any{"user_id": 2})
	if status != http.StatusOK || body["item"].(map[string]any)["id"].(float64) != firstID {
		t.Fatalf("expected conversation reuse, got %d %v", status, body)
	}

	// 不能给自己发私信
	status, _ = c.do(http.MethodPost, "/api/v1/direct-conversations", map[string]any{"user_id": 1})
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("self dm should fail, got %d", status)
	}

	// 举报用户
	status, _ = c.do(http.MethodPost, "/api/v1/users/2/reports", map[string]string{"reason": "测试举报用户"})
	if status != http.StatusAccepted {
		t.Fatalf("user report failed: %d", status)
	}
	admin := newClient(t, srv.URL)
	adminLogin(t, admin)
	_, body = admin.do(http.MethodGet, "/api/v1/admin/reports?status=pending", nil)
	found := false
	for _, item := range body["items"].([]any) {
		if item.(map[string]any)["report"].(map[string]any)["target_type"] == "user" {
			found = true
		}
	}
	if !found {
		t.Fatal("user report should appear in admin queue")
	}
}

// TestDirectMessageUnreadAndVisibility 覆盖跨端共用的私信协议：服务端统一计数、
// 已读持久化，以及审核未通过消息不得向接收方泄漏。
func TestDirectMessageUnreadAndVisibility(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	receiver := newClient(t, srv.URL)
	receiver.login(t, "13800000000", "Demo12345")
	sender := newClient(t, srv.URL)
	sender.login(t, "13800000002", "Demo12345")

	// 种子会话 1 先有一条对方招呼；进入会话后服务端持久化为已读。
	status, body := receiver.do(http.MethodPost, "/api/v1/direct-conversations/1/read", map[string]any{})
	if status != http.StatusOK || body["unread"].(float64) != 0 {
		t.Fatalf("mark initial message read failed: %d %v", status, body)
	}

	// 接收方回复内置招呼解锁会话，随后发送方连续发两条消息。
	status, _ = receiver.do(http.MethodPost, "/api/v1/direct-conversations/1/messages", map[string]any{
		"text": "你好，我想和你聊聊", "system": true,
	})
	if status != http.StatusCreated {
		t.Fatalf("reply greeting failed: %d", status)
	}
	for _, text := range []string{"第一条未读", "第二条未读"} {
		status, body = sender.do(http.MethodPost, "/api/v1/direct-conversations/1/messages", map[string]any{
			"text": text, "system": false,
		})
		if status != http.StatusCreated || body["message"].(map[string]any)["status"] != "delivered" {
			t.Fatalf("send direct message failed: %d %v", status, body)
		}
	}

	status, body = receiver.do(http.MethodGet, "/api/v1/direct-conversations", nil)
	if status != http.StatusOK || body["unread"].(float64) != 2 {
		t.Fatalf("expected two unread messages: %d %v", status, body)
	}
	items := body["items"].([]any)
	if len(items) == 0 || items[0].(map[string]any)["unread_count"].(float64) != 2 {
		t.Fatalf("expected per-conversation unread count: %v", body)
	}

	status, body = receiver.do(http.MethodPost, "/api/v1/direct-conversations/1/read", map[string]any{})
	if status != http.StatusOK || body["unread"].(float64) != 0 {
		t.Fatalf("expected unread count cleared: %d %v", status, body)
	}
	_, body = receiver.do(http.MethodGet, "/api/v1/direct-conversations/1", nil)
	detail := body["conversation"].(map[string]any)
	if detail["unread_count"].(float64) != 0 {
		t.Fatalf("conversation should stay read: %v", detail)
	}

	// 审核未通过的消息只保留在发送方视图，接收方列表和详情都不能看到正文。
	blockedText := "代考包过，测试拦截"
	status, body = sender.do(http.MethodPost, "/api/v1/direct-conversations/1/messages", map[string]any{
		"text": blockedText, "system": false,
	})
	if status != http.StatusCreated || body["message"].(map[string]any)["status"] != "blocked" {
		t.Fatalf("expected blocked message: %d %v", status, body)
	}
	_, body = receiver.do(http.MethodGet, "/api/v1/direct-conversations/1", nil)
	for _, raw := range body["conversation"].(map[string]any)["messages"].([]any) {
		if raw.(map[string]any)["text"] == blockedText {
			t.Fatal("blocked message leaked to receiver")
		}
	}
	_, body = sender.do(http.MethodGet, "/api/v1/direct-conversations/1", nil)
	foundBlocked := false
	for _, raw := range body["conversation"].(map[string]any)["messages"].([]any) {
		if raw.(map[string]any)["text"] == blockedText {
			foundBlocked = true
		}
	}
	if !foundBlocked {
		t.Fatal("sender should retain blocked message and delivery status")
	}
}

// TestAdminSeesAllPostStatuses 管理端帖子列表包含非公开状态，社区端不泄露。
func TestAdminSeesAllPostStatuses(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	c := newClient(t, srv.URL)
	c.login(t, "13800000000", "Demo12345")
	c.do(http.MethodPost, "/api/v1/posts", map[string]any{"text": "代考包过，联系我吧"}) // 命中演示违禁词 → rejected

	admin := newClient(t, srv.URL)
	adminLogin(t, admin)
	_, body := admin.do(http.MethodGet, "/api/v1/admin/posts", nil)
	foundRejected := false
	for _, item := range body["items"].([]any) {
		if item.(map[string]any)["status"] == "rejected" {
			foundRejected = true
		}
	}
	if !foundRejected {
		t.Fatal("admin post list should include rejected posts")
	}

	// 其他用户无法通过 id 读取未公开帖
	_, body = c.do(http.MethodGet, "/api/v1/posts", nil)
	var rejectedID int64 = -1
	admin2 := newClient(t, srv.URL)
	admin2.login(t, "13800000001", "Demo12345")
	_, body = admin.do(http.MethodGet, "/api/v1/admin/posts", nil)
	for _, item := range body["items"].([]any) {
		m := item.(map[string]any)
		if m["status"] == "rejected" {
			rejectedID = int64(m["id"].(float64))
		}
	}
	status, _ := admin2.do(http.MethodGet, fmt.Sprintf("/api/v1/posts/%d", rejectedID), nil)
	if status != http.StatusNotFound {
		t.Fatalf("non-author should not read rejected post, got %d", status)
	}
}
