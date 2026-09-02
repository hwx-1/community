package app

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestSnapshotPreservesInternalFields(t *testing.T) {
	s := &Store{
		Sessions:            map[string]int64{"user-token": 7},
		AdminSessions:       map[string]string{"admin-token": "root"},
		Accounts:            map[int64]*Account{7: {ID: 7, PasswordHash: "user-hash"}},
		Admins:              map[string]*AdminAccount{"root": {Username: "root", PasswordHash: "admin-hash"}},
		Providers:           map[int64]*AIProvider{8: {ID: 8, APIKey: "provider-key"}},
		DirectConversations: map[int64]*DirectConversation{9: {ID: 9, GreetingBy: map[int64]bool{7: true}}},
		Reports:             map[int64]*Report{10: {ID: 10, ReporterID: 7}},
		Notifications:       map[int64]*Notification{11: {ID: 11, AccountID: 7}},
	}

	raw, err := json.Marshal(s.snapshot())
	if err != nil {
		t.Fatal(err)
	}
	var got storeSnapshot
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatal(err)
	}
	if got.AccountPasswordHashes[7] != "user-hash" || got.AdminPasswordHashes["root"] != "admin-hash" {
		t.Fatal("password hashes were omitted from durable snapshot")
	}
	if got.ProviderAPIKeys[8] != "provider-key" || !got.DirectGreetingBy[9][7] {
		t.Fatal("provider or direct-message internal state was omitted")
	}
	if got.ReportReporterIDs[10] != 7 || got.NotificationAccountIDs[11] != 7 {
		t.Fatal("reporter or notification owner was omitted")
	}
	// 用户会话必须随快照持久化：部署重启不应把在线用户踢下线
	if got.Sessions["user-token"] != 7 {
		t.Fatal("user sessions must survive snapshot round-trip")
	}
	// 管理员会话保持易失：重启后需重新登录，缩小令牌暴露面
	if raw2, _ := json.Marshal(got); strings.Contains(string(raw2), "admin-token") {
		t.Fatal("admin sessions must not be persisted")
	}
}
