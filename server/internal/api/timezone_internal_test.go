package api

import (
	"testing"
	"time"
)

// 回归测试：运行镜像（alpine）缺 tzdata 时 time.LoadLocation 返回错误，
// shanghaiLoc 必须兜底为固定 +8 时区而不是 nil（nil 会让 Time.In panic，
// 曾导致 GET /ai/conversations 与 POST /ai/conversations/:id/messages 500）。
func TestShanghaiLocNeverNil(t *testing.T) {
	if shanghaiLoc == nil {
		t.Fatal("shanghaiLoc 不得为 nil，否则 Time.In 会 panic")
	}
	if _, offset := time.Now().In(shanghaiLoc).Zone(); offset != 8*3600 {
		t.Fatalf("业务时区应为 UTC+8，实际偏移 %d 秒", offset)
	}
}

func TestSameDayUsesBeijingBoundary(t *testing.T) {
	before := time.Date(2026, 9, 2, 15, 59, 59, 0, time.UTC)  // 北京 23:59:59
	after := time.Date(2026, 9, 2, 16, 0, 0, 0, time.UTC)    // 北京次日 00:00:00
	sameDayMorning := time.Date(2026, 9, 2, 1, 0, 0, 0, time.UTC) // 北京 09:00
	if !sameDay(before, sameDayMorning) {
		t.Error("北京时区同一天应判定为同日")
	}
	if sameDay(before, after) {
		t.Error("跨过北京 0 点应判定为不同日")
	}
}
