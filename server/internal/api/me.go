package api

import (
	"errors"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xsnbb/server/internal/app"
	"github.com/xsnbb/server/internal/security"
)

// ---- 我的认证状态 ----

// myVerification 返回本人最近一次认证申请，供认证页展示状态与驳回原因。
func (a *API) myVerification(c *gin.Context) {
	account := current(c)
	a.store.MuRLock(func() {
		var latest *app.Verification
		for _, v := range a.store.Verifications {
			if v.AccountID != account.ID {
				continue
			}
			if latest == nil || v.CreatedAt.After(latest.CreatedAt) {
				latest = v
			}
		}
		c.JSON(http.StatusOK, gin.H{"verification": latest})
	})
}

// ---- 修改密码 ----

func (a *API) changePassword(c *gin.Context) {
	account := current(c)
	var in struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if c.ShouldBindJSON(&in) != nil || in.CurrentPassword == "" {
		fail(c, 400, "INVALID_BODY", "请填写当前密码和新密码")
		return
	}
	if len(in.NewPassword) < 8 {
		fail(c, 422, "PASSWORD_INVALID", "新密码至少 8 位")
		return
	}
	if !security.VerifyPassword(account.PasswordHash, in.CurrentPassword) {
		fail(c, 422, "WRONG_PASSWORD", "当前密码不正确")
		return
	}
	hash, err := security.HashPassword(in.NewPassword)
	if err != nil {
		fail(c, 500, "HASH_FAILED", "密码处理失败，请重试")
		return
	}
	currentSession, _ := c.Cookie(communityCookie)
	a.store.MuLock(func() {
		account.PasswordHash = hash
		// 保留当前设备，撤销同一账号的其他会话，避免旧密码设备继续长期在线。
		for session, accountID := range a.store.Sessions {
			if accountID == account.ID && session != currentSession {
				delete(a.store.Sessions, session)
			}
		}
	})
	c.JSON(http.StatusOK, gin.H{"changed": true})
}

// ---- 账号注销 ----

// deleteAccount 注销：标记停用、内部资料物理删除、帖子/评论作者匿名化、
// 学号与手机号释放（可重新注册认证），认证记录匿名化保留。
func (a *API) deleteAccount(c *gin.Context) {
	account := current(c)
	operator := account.Phone // 先留存操作标识，注销后字段被清空
	a.store.MuLock(func() {
		delete(a.store.Phones, account.Phone)
		account.Status = "deactivated"
		account.Nickname = "已注销用户"
		account.Avatar = ""
		account.Gender = ""
		account.Phone = ""
		account.RealName = ""
		account.StudentNo = ""
		account.ClassName = ""
		account.ProfileDone = false
		account.Verified = false
		account.MutedUntil = nil
		// 已发内容匿名化但保留
		for _, p := range a.store.Posts {
			if p.Author.ID == account.ID {
				p.Author.Nickname = "已注销用户"
				p.Author.Avatar = ""
				p.Author.Verified = false
				p.Author.Badge = ""
			}
		}
		for _, cm := range a.store.Comments {
			if cm.Author.ID == account.ID {
				cm.Author.Nickname = "已注销用户"
				cm.Author.Avatar = ""
				cm.Author.Verified = false
				cm.Author.Badge = ""
			}
		}
		// 认证记录匿名化（保留审核事实，删除身份资料）
		for _, v := range a.store.Verifications {
			if v.AccountID == account.ID {
				v.RealName = "已注销"
				v.StudentNo = ""
				v.Nickname = "已注销用户"
				v.MaterialURL = ""
			}
		}
		a.store.AddAuditUnlocked(operator, "account.deactivate", "self", "success", "用户自助注销", "security")
	})
	if t, err := c.Cookie(communityCookie); err == nil {
		a.store.DeleteSession(t)
	}
	clearCookie(c, communityCookie)
	c.Status(http.StatusNoContent)
}

// ---- 我的收藏 ----

func (a *API) myBookmarks(c *gin.Context) {
	account := current(c)
	a.store.MuRLock(func() {
		posts := a.store.BookmarksOfLocked(account.ID)
		a.store.DecoratePosts(posts, account.ID)
		c.JSON(http.StatusOK, gin.H{"items": posts})
	})
}

// ---- 通知 ----

func (a *API) notifications(c *gin.Context) {
	account := current(c)
	a.store.MuRLock(func() {
		items := []app.Notification{}
		unread := 0
		for _, n := range a.store.Notifications {
			if n.AccountID != account.ID {
				continue
			}
			if !n.Read {
				unread++
			}
			items = append(items, *n)
		}
		sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
		c.JSON(http.StatusOK, gin.H{"items": items, "unread": unread})
	})
}

// markNotificationsRead 标记已读：ids 为空表示全部已读。
func (a *API) markNotificationsRead(c *gin.Context) {
	account := current(c)
	var in struct {
		IDs []int64 `json:"ids"`
	}
	_ = c.ShouldBindJSON(&in)
	a.store.MuLock(func() {
		unread := 0
		for _, n := range a.store.Notifications {
			if n.AccountID != account.ID || n.Read {
				continue
			}
			if len(in.IDs) == 0 || contains(in.IDs, n.ID) {
				n.Read = true
			} else {
				unread++
			}
		}
		c.JSON(http.StatusOK, gin.H{"unread": unread})
	})
}

// ---- 申诉 ----

func (a *API) myAppeals(c *gin.Context) {
	account := current(c)
	items := []app.Appeal{}
	a.store.MuRLock(func() {
		for _, ap := range a.store.Appeals {
			if ap.AccountID == account.ID {
				items = append(items, *ap)
			}
		}
	})
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// createAppeal 针对一次处罚提交申诉：每次处罚只能申诉一次。
func (a *API) createAppeal(c *gin.Context) {
	account := current(c)
	var in struct {
		PunishmentID int64  `json:"punishment_id"`
		Reason       string `json:"reason"`
	}
	if c.ShouldBindJSON(&in) != nil || strings.TrimSpace(in.Reason) == "" {
		fail(c, 422, "APPEAL_INVALID", "请填写申诉理由")
		return
	}
	err := a.store.WithLockErr(func() error {
		p, ok := a.store.Punishments[in.PunishmentID]
		if !ok || p.AccountID != account.ID {
			return errors.New("处罚记录不存在")
		}
		for _, ap := range a.store.Appeals {
			if ap.PunishmentID == in.PunishmentID {
				return errors.New("该处罚已申诉过，每次处罚只能申诉一次")
			}
		}
		id := a.store.NextID()
		a.store.Appeals[id] = &app.Appeal{ID: id, PunishmentID: in.PunishmentID, AccountID: account.ID, Kind: p.Kind, Reason: strings.TrimSpace(in.Reason), Status: "pending", CreatedAt: time.Now()}
		return nil
	})
	if err != nil {
		fail(c, 422, "APPEAL_FAILED", err.Error())
		return
	}
	c.JSON(http.StatusCreated, gin.H{"submitted": true})
}
