package api

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xsnbb/server/internal/app"
)

// ---- 公开配置 ----

// publicSettings 向社区端公开运营配置：热门话题、内置招呼文案。
func (a *API) publicSettings(c *gin.Context) {
	a.store.MuRLock(func() {
		c.JSON(http.StatusOK, gin.H{
			"hot_topics": a.store.Settings.HotTopics,
			"greeting":   a.store.Settings.Greeting,
		})
	})
}

// listTags 公开标签列表：来自已公开帖子的标签，按使用频次排序。
func (a *API) listTags(c *gin.Context) {
	counts := map[string]int{}
	a.store.MuRLock(func() {
		for _, p := range a.store.Posts {
			if p.Status != "public" {
				continue
			}
			for _, t := range p.Tags {
				counts[t]++
			}
		}
	})
	items := make([]string, 0, len(counts))
	for t := range counts {
		items = append(items, t)
	}
	sort.Slice(items, func(i, j int) bool {
		if counts[items[i]] != counts[items[j]] {
			return counts[items[i]] > counts[items[j]]
		}
		return items[i] < items[j]
	})
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// adaptersStatus 暴露各外部服务当前是否处于开发模式，供前端明确提示。
func (a *API) adaptersStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"sms":        gin.H{"dev_mode": a.adapters.SMS.DevMode()},
		"oss":        gin.H{"dev_mode": a.adapters.OSS.DevMode()},
		"moderation": gin.H{"dev_mode": true}, // 首版审核适配层为内置演示实现
		"search":     gin.H{"dev_mode": a.adapters.Search.DevMode()},
	})
}

// ---- 举报（社区端） ----

func (a *API) reportTarget(c *gin.Context, targetType string, targetID int64) {
	account := current(c)
	var in struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&in)
	if strings.TrimSpace(in.Reason) == "" {
		fail(c, 422, "REPORT_INVALID", "请填写举报原因")
		return
	}
	var report *app.Report
	a.store.MuLock(func() {
		// 举报对象必须存在且举报人有权访问：用户举报要求对方存在；私信举报仅限会话成员
		if targetType == "user" {
			target, ok := a.store.Accounts[targetID]
			if !ok || target.Status == "deactivated" || targetID == account.ID {
				fail(c, 404, "USER_NOT_FOUND", "用户不存在")
				return
			}
		}
		if targetType == "dm" {
			conv, ok := a.store.DirectConversations[targetID]
			if !ok || !contains(conv.MemberIDs, account.ID) {
				fail(c, 404, "CONVERSATION_NOT_FOUND", "会话不存在")
				return
			}
		}
		// 同一用户同一对象去重
		for _, r := range a.store.Reports {
			if r.ReporterID == account.ID && r.TargetType == targetType && r.TargetID == targetID && r.Status == "pending" {
				report = r
				return
			}
		}
		id := a.store.NextID()
		report = &app.Report{ID: id, ReporterID: account.ID, TargetType: targetType, TargetID: targetID, Reason: strings.TrimSpace(in.Reason), Status: "pending", CreatedAt: time.Now()}
		a.store.Reports[id] = report
		// 首次举报立即临时隐藏目标内容，等待复核
		if targetType == "post" {
			if p, ok := a.store.Posts[targetID]; ok && p.Status == "public" {
				p.Status = "reported_hidden"
			}
		}
		if targetType == "comment" {
			if cm, ok := a.store.Comments[targetID]; ok && cm.Status == "public" {
				cm.Status = "reported_hidden"
			}
		}
		a.store.AddAuditUnlocked(account.Nickname, targetType+".report", fmt.Sprintf("%s:%d", targetType, targetID), "accepted", in.Reason, "security")
	})
	if c.IsAborted() {
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"report": report, "message": "举报已提交，内容进入复核"})
}

// ---- 管理端：评论审核 ----

func (a *API) adminComments(c *gin.Context) {
	status := c.Query("status")
	items := []app.Comment{}
	a.store.MuRLock(func() {
		for _, cm := range a.store.Comments {
			if status == "" || cm.Status == status {
				items = append(items, *cm)
			}
		}
	})
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (a *API) moderateComment(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	var in struct{ Status, Reason string }
	_ = c.ShouldBindJSON(&in)
	admin := c.MustGet("admin").(string)
	a.store.MuLock(func() {
		cm, exists := a.store.Comments[id]
		if !exists {
			fail(c, 404, "COMMENT_NOT_FOUND", "评论不存在")
			return
		}
		cm.Status = in.Status
		a.store.AddAuditUnlocked(admin, "comment.moderate", fmt.Sprintf("comment:%d", id), in.Status, in.Reason, "security")
		c.JSON(http.StatusOK, gin.H{"comment": cm})
	})
}

// ---- 管理端：举报处理 ----

func (a *API) adminReports(c *gin.Context) {
	status := c.Query("status")
	items := []gin.H{}
	adminAccount := c.MustGet("admin_account").(*app.AdminAccount)
	a.store.MuRLock(func() {
		for _, r := range a.store.Reports {
			if status != "" && r.Status != status {
				continue
			}
			reporter := "已隐藏"
			if adminAccount.IsSuper {
				if acc, ok := a.store.Accounts[r.ReporterID]; ok {
					reporter = acc.Nickname
				}
			}
			items = append(items, gin.H{"report": r, "reporter": reporter})
		}
	})
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (a *API) resolveReport(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	var in struct {
		Action string `json:"action"` // restore（恢复展示）/ takedown（下架）/ dismiss（驳回举报）
		Reason string `json:"reason"`
	}
	if c.ShouldBindJSON(&in) != nil || (in.Action != "restore" && in.Action != "takedown" && in.Action != "dismiss") {
		fail(c, 422, "ACTION_INVALID", "处理动作无效")
		return
	}
	admin := c.MustGet("admin").(string)
	a.store.MuLock(func() {
		r, exists := a.store.Reports[id]
		if !exists {
			fail(c, 404, "REPORT_NOT_FOUND", "举报不存在")
			return
		}
		now := time.Now()
		r.ResolvedAt = &now
		r.Result = in.Reason
		conclusion := map[string]string{"restore": "复核无违规，内容已恢复展示", "dismiss": "举报不成立，内容保持展示", "takedown": "确认违规，内容已下架"}[in.Action]
		switch in.Action {
		case "restore", "dismiss":
			r.Status = "dismissed"
			// 仅解除本次举报产生的临时隐藏，不解除下架/删除
			if r.TargetType == "post" {
				if p, ok := a.store.Posts[r.TargetID]; ok && p.Status == "reported_hidden" {
					p.Status = "public"
				}
			}
			if r.TargetType == "comment" {
				if cm, ok := a.store.Comments[r.TargetID]; ok && cm.Status == "reported_hidden" {
					cm.Status = "public"
				}
			}
		case "takedown":
			r.Status = "actioned"
			if r.TargetType == "post" {
				if p, ok := a.store.Posts[r.TargetID]; ok {
					p.Status = "removed"
				}
			}
			if r.TargetType == "comment" {
				if cm, ok := a.store.Comments[r.TargetID]; ok {
					cm.Status = "removed"
				}
			}
		}
		// 结果通知：分别通知举报人与被举报内容作者，不泄露举报人身份
		a.store.NotifyLocked(r.ReporterID, "report_result", "你的举报已有处理结果", conclusion, r.TargetType, r.TargetID)
		var authorID int64
		if r.TargetType == "post" {
			if p, ok := a.store.Posts[r.TargetID]; ok {
				authorID = p.Author.ID
			}
		}
		if r.TargetType == "comment" {
			if cm, ok := a.store.Comments[r.TargetID]; ok {
				authorID = cm.Author.ID
			}
		}
		if authorID != 0 && authorID != r.ReporterID {
			a.store.NotifyLocked(authorID, "report_result", "你的内容被举报的处理结果", conclusion, r.TargetType, r.TargetID)
		}
		a.store.AddAuditUnlocked(admin, "report.resolve", fmt.Sprintf("report:%d", id), in.Action, in.Reason, "security")
		c.JSON(http.StatusOK, gin.H{"report": r})
	})
}

// ---- 管理端：知识库 ----

func (a *API) adminKBList(c *gin.Context) {
	items := []app.KBEntry{}
	a.store.MuRLock(func() {
		for _, e := range a.store.KBEntries {
			items = append(items, *e)
		}
	})
	sort.Slice(items, func(i, j int) bool { return items[i].UpdatedAt.After(items[j].UpdatedAt) })
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (a *API) adminKBCreate(c *gin.Context) {
	var in app.KBEntry
	if c.ShouldBindJSON(&in) != nil || strings.TrimSpace(in.Title) == "" || strings.TrimSpace(in.Content) == "" {
		fail(c, 422, "KB_INVALID", "标题和内容不能为空")
		return
	}
	admin := c.MustGet("admin").(string)
	a.store.MuLock(func() {
		in.ID = a.store.NextID()
		in.UpdatedAt = time.Now()
		a.store.KBEntries[in.ID] = &in
		a.store.AddAuditUnlocked(admin, "kb.create", fmt.Sprintf("kb:%d", in.ID), "success", "", "operational")
	})
	c.JSON(http.StatusCreated, gin.H{"entry": in})
}

func (a *API) adminKBUpdate(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	var in app.KBEntry
	_ = c.ShouldBindJSON(&in)
	a.store.MuLock(func() {
		entry, exists := a.store.KBEntries[id]
		if !exists {
			fail(c, 404, "KB_NOT_FOUND", "资料不存在")
			return
		}
		if in.Title != "" {
			entry.Title = in.Title
		}
		if in.Content != "" {
			if in.Content != entry.Content {
				// 答案内容修订后历史差评失效，重新积累
				entry.Dislikes = 0
				entry.LastDislikeAt = nil
			}
			entry.Content = in.Content
		}
		if in.Category != "" {
			entry.Category = in.Category
		}
		entry.Source = in.Source
		entry.SourceDate = in.SourceDate
		entry.Enabled = in.Enabled
		entry.UpdatedAt = time.Now()
		c.JSON(http.StatusOK, gin.H{"entry": entry})
	})
}

func (a *API) adminKBDelete(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	admin := c.MustGet("admin").(string)
	a.store.MuLock(func() {
		if _, exists := a.store.KBEntries[id]; !exists {
			fail(c, 404, "KB_NOT_FOUND", "资料不存在")
			return
		}
		delete(a.store.KBEntries, id)
		a.store.AddAuditUnlocked(admin, "kb.delete", fmt.Sprintf("kb:%d", id), "success", "", "operational")
	})
	c.Status(http.StatusNoContent)
}

// ---- 管理端：待补充问题 ----

func (a *API) adminPendingQuestions(c *gin.Context) {
	items := []app.PendingQuestion{}
	disliked := []app.KBEntry{}
	a.store.MuRLock(func() {
		for _, q := range a.store.PendingQuestions {
			items = append(items, *q)
		}
		// 被用户在答案确认中点过「否」的知识库条目，提示管理员复查质量
		for _, e := range a.store.KBEntries {
			if e.Dislikes > 0 {
				disliked = append(disliked, *e)
			}
		}
	})
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
	sort.Slice(disliked, func(i, j int) bool { return disliked[i].Dislikes > disliked[j].Dislikes })
	c.JSON(http.StatusOK, gin.H{"items": items, "kb_disliked": disliked})
}

func (a *API) adminAnswerQuestion(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	var in struct {
		Answer string `json:"answer"`
	}
	if c.ShouldBindJSON(&in) != nil || strings.TrimSpace(in.Answer) == "" {
		fail(c, 422, "ANSWER_INVALID", "补充答案不能为空")
		return
	}
	admin := c.MustGet("admin").(string)
	a.store.MuLock(func() {
		q, exists := a.store.PendingQuestions[id]
		if !exists || q.Status != "open" {
			fail(c, 404, "QUESTION_NOT_FOUND", "问题不存在或已处理")
			return
		}
		now := time.Now()
		q.Status = "answered"
		q.Answer = strings.TrimSpace(in.Answer)
		q.AnsweredAt = &now
		// 官方回答通知：关联原问题与补充答案，查看不消耗 AI 额度
		a.store.NotifyLocked(q.AccountID, "official_answer", "你提问的问题有了官方回答", fmt.Sprintf("问：%s\n答：%s", truncateRunes(q.Question, 50), truncateRunes(q.Answer, 200)), "", 0)
		a.store.AddAuditUnlocked(admin, "question.answer", fmt.Sprintf("question:%d", id), "success", "", "operational")
		c.JSON(http.StatusOK, gin.H{"question": q})
	})
}

// ---- 管理端：申诉处理 ----

func (a *API) adminAppeals(c *gin.Context) {
	status := c.Query("status")
	items := []gin.H{}
	a.store.MuRLock(func() {
		for _, ap := range a.store.Appeals {
			if status != "" && ap.Status != status {
				continue
			}
			nickname := ""
			if acc, ok := a.store.Accounts[ap.AccountID]; ok {
				nickname = acc.Nickname
			}
			items = append(items, gin.H{"appeal": ap, "nickname": nickname})
		}
	})
	sort.Slice(items, func(i, j int) bool {
		return items[i]["appeal"].(*app.Appeal).CreatedAt.After(items[j]["appeal"].(*app.Appeal).CreatedAt)
	})
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (a *API) resolveAppeal(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	var in struct {
		Action string `json:"action"` // uphold（维持处罚）/ lift（解除处罚）
		Reason string `json:"reason"`
	}
	if c.ShouldBindJSON(&in) != nil || (in.Action != "uphold" && in.Action != "lift") {
		fail(c, 422, "ACTION_INVALID", "处理动作无效")
		return
	}
	admin := c.MustGet("admin").(string)
	a.store.MuLock(func() {
		ap, exists := a.store.Appeals[id]
		if !exists || ap.Status != "pending" {
			fail(c, 404, "APPEAL_NOT_FOUND", "申诉不存在或已处理")
			return
		}
		now := time.Now()
		ap.ResolvedAt = &now
		ap.Result = in.Reason
		title, body := "", ""
		if in.Action == "lift" {
			ap.Status = "lifted"
			if p, ok := a.store.Punishments[ap.PunishmentID]; ok && p.Status == "active" {
				p.Status = "lifted"
			}
			if acc, ok := a.store.Accounts[ap.AccountID]; ok {
				acc.Status = "active"
				acc.MutedUntil = nil
			}
			title = "申诉通过，处罚已解除"
			body = in.Reason
		} else {
			ap.Status = "upheld"
			title = "申诉未通过，维持原处罚"
			body = in.Reason
		}
		a.store.NotifyLocked(ap.AccountID, "appeal_result", title, body, "", 0)
		a.store.AddAuditUnlocked(admin, "appeal.resolve", fmt.Sprintf("appeal:%d", id), in.Action, in.Reason, "security")
		c.JSON(http.StatusOK, gin.H{"appeal": ap})
	})
}

// ---- 管理端：运营配置 ----

func (a *API) adminGetSettings(c *gin.Context) {
	a.store.MuRLock(func() {
		c.JSON(http.StatusOK, gin.H{"settings": a.store.Settings})
	})
}

func (a *API) adminUpdateSettings(c *gin.Context) {
	var in app.Settings
	if c.ShouldBindJSON(&in) != nil {
		fail(c, 400, "INVALID_BODY", "配置格式错误")
		return
	}
	admin := c.MustGet("admin").(string)
	a.store.MuLock(func() {
		if strings.TrimSpace(in.Greeting) != "" {
			a.store.Settings.Greeting = strings.TrimSpace(in.Greeting)
		}
		if in.HotTopics != nil {
			topics := []string{}
			for _, t := range in.HotTopics {
				if t = strings.TrimSpace(t); t != "" && len([]rune(t)) <= 10 {
					topics = append(topics, t)
				}
			}
			a.store.Settings.HotTopics = topics
		}
		a.store.AddAuditUnlocked(admin, "settings.update", "settings", "success", "", "operational")
		c.JSON(http.StatusOK, gin.H{"settings": a.store.Settings})
	})
}
