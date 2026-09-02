package app

import (
	"encoding/json"
	"testing"
)

func TestSnapshotPreservesInternalFields(t *testing.T) {
	s := &Store{
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
}
