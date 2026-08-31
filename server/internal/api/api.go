package api

import (
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/xsnbb/server/internal/adapters"
	"github.com/xsnbb/server/internal/app"
	"github.com/xsnbb/server/internal/config"
)

const (
	communityCookie = "xsnbb_session"
	adminCookie     = "xsnbb_admin_session"
	csrfCookie      = "xsnbb_csrf"
	csrfAdminCookie = "xsnbb_admin_csrf" // 同源部署时与社区 CSRF Cookie 隔离
)

type API struct {
	cfg      *config.Config
	store    *app.Store
	adapters *adapters.Set
}

func New(cfg *config.Config, store *app.Store, ads *adapters.Set) *API {
	return &API{cfg: cfg, store: store, adapters: ads}
}

func (a *API) Register(r *gin.Engine) {
	r.Use(a.cors())
	r.GET("/healthz", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok", "time": time.Now()}) })
	v1 := r.Group("/api/v1")
	v1.POST("/auth/sms-code", a.requestSMSCode)
	v1.POST("/auth/register", a.register)
	v1.POST("/auth/login", a.login)
	v1.POST("/auth/reset-password", a.resetPassword)
	v1.POST("/auth/logout", a.auth(), a.csrf(), a.logout)
	v1.GET("/me", a.auth(), a.me)
	v1.GET("/settings/public", a.publicSettings)
	v1.GET("/capabilities", a.adaptersStatus)
	// 封禁账号仅可使用：处罚通知、申诉与申诉结果（其余社区功能由 activeOnly 拦截）
	v1.GET("/me/notifications", a.auth(), a.notifications)
	v1.POST("/me/notifications/read", a.auth(), a.csrf(), a.markNotificationsRead)
	v1.GET("/me/appeals", a.auth(), a.myAppeals)
	v1.POST("/me/appeals", a.auth(), a.csrf(), a.createAppeal)

	// 以下全部要求账号未被封禁；写操作再叠加 CSRF 与禁言检查
	act := v1.Group("", a.auth(), a.activeOnly())
	act.PUT("/me/profile", a.csrf(), a.updateProfile)
	act.POST("/me/verification", a.csrf(), a.submitVerification)
	act.GET("/me/verification", a.myVerification)
	act.POST("/me/password", a.csrf(), a.changePassword)
	act.DELETE("/me", a.csrf(), a.deleteAccount)
	act.GET("/me/bookmarks", a.myBookmarks)
	act.GET("/posts", a.listPosts)
	act.POST("/posts", a.csrf(), a.notMuted(), a.createPost)
	act.GET("/posts/:id", a.getPost)
	act.PUT("/posts/:id", a.csrf(), a.notMuted(), a.updatePost)
	act.DELETE("/posts/:id", a.csrf(), a.deletePost)
	act.POST("/posts/:id/like", a.csrf(), a.likePost)
	act.POST("/posts/:id/bookmark", a.csrf(), a.bookmarkPost)
	act.GET("/posts/:id/comments", a.listComments)
	act.POST("/posts/:id/comments", a.csrf(), a.notMuted(), a.createComment)
	act.POST("/posts/:id/reports", a.csrf(), func(c *gin.Context) {
		id, ok := idParam(c)
		if ok {
			a.reportTarget(c, "post", id)
		}
	})
	act.POST("/comments/:id/reports", a.csrf(), func(c *gin.Context) {
		id, ok := idParam(c)
		if ok {
			a.reportTarget(c, "comment", id)
		}
	})
	act.POST("/users/:id/reports", a.csrf(), func(c *gin.Context) {
		id, ok := idParam(c)
		if ok {
			a.reportTarget(c, "user", id)
		}
	})
	act.GET("/tags", a.listTags)
	act.POST("/uploads", a.csrf(), a.upload)
	act.GET("/users/:id", a.publicUser)
	act.GET("/announcements", a.listAnnouncements)
	act.GET("/announcements/:id", a.getAnnouncement)
	act.GET("/tools", a.listTools)
	act.POST("/direct-conversations", a.csrf(), a.notMuted(), a.startDirectConversation)
	act.GET("/direct-conversations", a.listDirectConversations)
	act.GET("/direct-conversations/:id", a.getDirectConversation)
	act.POST("/direct-conversations/:id/messages", a.csrf(), a.notMuted(), a.sendDirectMessage)
	act.POST("/direct-conversations/:id/read", a.csrf(), a.markDirectConversationRead)
	act.POST("/direct-conversations/:id/reports", a.csrf(), func(c *gin.Context) {
		id, ok := idParam(c)
		if ok {
			a.reportTarget(c, "dm", id)
		}
	})
	act.GET("/ai/models", a.aiModels)
	act.GET("/ai/conversations", a.aiConversations)
	act.POST("/ai/conversations", a.csrf(), a.createAIConversation)
	act.DELETE("/ai/conversations/:id", a.csrf(), a.deleteAIConversation)
	act.POST("/ai/conversations/:id/messages", a.csrf(), a.askAI)

	admin := v1.Group("/admin")
	admin.POST("/auth/login", a.adminLogin)
	secured := admin.Group("", a.adminAuth())
	secured.POST("/auth/logout", a.csrf(), a.adminLogout)
	secured.GET("/me", a.adminMe)
	secured.GET("/dashboard", a.adminDashboard)
	secured.GET("/verifications", a.requireAdminPermission("verification.review"), a.adminVerifications)
	secured.PATCH("/verifications/:id", a.requireAdminPermission("verification.review"), a.csrf(), a.reviewVerification)
	secured.GET("/posts", a.requireAdminPermission("post.moderate"), a.adminPosts)
	secured.PATCH("/posts/:id", a.requireAdminPermission("post.moderate"), a.csrf(), a.moderatePost)
	secured.GET("/users", a.requireAdminPermission("user.manage"), a.adminUsers)
	secured.PATCH("/users/:id", a.requireAdminPermission("user.manage"), a.csrf(), a.updateUserStatus)
	secured.GET("/announcements", a.superAdminOnly(), a.adminAnnouncements)
	secured.POST("/announcements", a.superAdminOnly(), a.csrf(), a.createAnnouncement)
	secured.PATCH("/announcements/:id", a.superAdminOnly(), a.csrf(), a.updateAnnouncement)
	secured.POST("/announcements/upload", a.superAdminOnly(), a.csrf(), a.upload)
	secured.GET("/tools", a.requireAdminPermission("tool.manage"), a.adminTools)
	secured.POST("/tools", a.requireAdminPermission("tool.manage"), a.csrf(), a.createTool)
	secured.PATCH("/tools/:id", a.requireAdminPermission("tool.manage"), a.csrf(), a.updateTool)
	secured.GET("/ai-providers", a.requireAdminPermission("ai_provider.manage"), a.adminProviders)
	secured.POST("/ai-providers", a.requireAdminPermission("ai_provider.manage"), a.csrf(), a.createProvider)
	secured.PATCH("/ai-providers/:id", a.requireAdminPermission("ai_provider.manage"), a.csrf(), a.updateProvider)
	secured.GET("/roles", a.superAdminOnly(), a.adminRoles)
	secured.POST("/roles", a.superAdminOnly(), a.csrf(), a.createAdminRole)
	secured.PATCH("/roles/:id", a.superAdminOnly(), a.csrf(), a.updateAdminRole)
	secured.DELETE("/roles/:id", a.superAdminOnly(), a.csrf(), a.deleteAdminRole)
	secured.GET("/admins", a.superAdminOnly(), a.adminAccounts)
	secured.POST("/admins", a.superAdminOnly(), a.csrf(), a.createAdminAccount)
	secured.PATCH("/admins/:username", a.superAdminOnly(), a.csrf(), a.updateAdminAccount)
	secured.POST("/admins/:username/reset-password", a.superAdminOnly(), a.csrf(), a.resetAdminPassword)
	secured.GET("/audit-logs", a.requireAdminPermission("audit.security.read"), a.adminAudits)
	secured.GET("/comments", a.requireAdminPermission("comment.moderate"), a.adminComments)
	secured.PATCH("/comments/:id", a.requireAdminPermission("comment.moderate"), a.csrf(), a.moderateComment)
	secured.GET("/reports", a.requireAdminPermission("report.review"), a.adminReports)
	secured.PATCH("/reports/:id", a.requireAdminPermission("report.review"), a.csrf(), a.resolveReport)
	secured.GET("/appeals", a.requireAdminPermission("appeal.review"), a.adminAppeals)
	secured.PATCH("/appeals/:id", a.requireAdminPermission("appeal.review"), a.csrf(), a.resolveAppeal)
	secured.GET("/kb", a.requireAdminPermission("kb.manage"), a.adminKBList)
	secured.POST("/kb", a.requireAdminPermission("kb.manage"), a.csrf(), a.adminKBCreate)
	secured.PATCH("/kb/:id", a.requireAdminPermission("kb.manage"), a.csrf(), a.adminKBUpdate)
	secured.DELETE("/kb/:id", a.requireAdminPermission("kb.manage"), a.csrf(), a.adminKBDelete)
	secured.GET("/pending-questions", a.requireAdminPermission("pending_question.answer"), a.adminPendingQuestions)
	secured.POST("/pending-questions/:id/answer", a.requireAdminPermission("pending_question.answer"), a.csrf(), a.adminAnswerQuestion)
	secured.GET("/settings", a.requireAdminPermission("settings.manage"), a.adminGetSettings)
	secured.PUT("/settings", a.requireAdminPermission("settings.manage"), a.csrf(), a.adminUpdateSettings)
}

func (a *API) cors() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == a.cfg.WebOrigin || origin == a.cfg.AdminOrigin {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token")
			c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
func (a *API) setSession(c *gin.Context, name, value, csrfName string) {
	http.SetCookie(c.Writer, &http.Cookie{Name: name, Value: value, Path: "/", HttpOnly: true, Secure: a.cfg.CookieSecure, SameSite: http.SameSiteLaxMode, MaxAge: 7 * 24 * 3600})
	csrf := strconv.FormatInt(time.Now().UnixNano(), 36)
	http.SetCookie(c.Writer, &http.Cookie{Name: csrfName, Value: csrf, Path: "/", HttpOnly: false, Secure: a.cfg.CookieSecure, SameSite: http.SameSiteLaxMode, MaxAge: 7 * 24 * 3600})
}
func clearCookie(c *gin.Context, name string) {
	http.SetCookie(c.Writer, &http.Cookie{Name: name, Value: "", Path: "/", HttpOnly: true, MaxAge: -1})
}
func fail(c *gin.Context, status int, code, message string) {
	c.AbortWithStatusJSON(status, gin.H{"error": gin.H{"code": code, "message": message}})
}
func idParam(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		fail(c, 400, "INVALID_ID", "无效的资源编号")
		return 0, false
	}
	return id, true
}

func (a *API) auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		t, err := c.Cookie(communityCookie)
		if err != nil {
			fail(c, 401, "UNAUTHENTICATED", "请先登录")
			return
		}
		account, ok := a.store.AccountBySession(t)
		if !ok {
			fail(c, 401, "SESSION_EXPIRED", "登录状态已失效")
			return
		}
		if account.Status == "deactivated" {
			fail(c, 401, "ACCOUNT_DEACTIVATED", "账号已注销，请重新登录")
			return
		}
		c.Set("account", account)
		c.Next()
	}
}

// activeOnly 拦截封禁账号：封号后仅保留处罚通知与申诉入口。
func (a *API) activeOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		if current(c).Status == "banned" {
			fail(c, 403, "ACCOUNT_BANNED", "账号已被封禁，仅可查看处罚通知和提交申诉")
			return
		}
		c.Next()
	}
}

// notMuted 拦截禁言账号的发帖 / 编辑 / 评论 / 私信（浏览、点赞、收藏、AI、举报不受影响）。
func (a *API) notMuted() gin.HandlerFunc {
	return func(c *gin.Context) {
		muted := false
		a.store.MuLock(func() { muted = a.store.MutedLocked(current(c)) })
		if muted {
			fail(c, 403, "ACCOUNT_MUTED", "账号处于禁言中，暂不能发帖、评论或发送私信")
			return
		}
		c.Next()
	}
}
func (a *API) adminAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		t, err := c.Cookie(adminCookie)
		if err != nil {
			fail(c, 401, "ADMIN_UNAUTHENTICATED", "请登录管理后台")
			return
		}
		name, ok := a.store.AdminBySession(t)
		if !ok {
			fail(c, 401, "ADMIN_SESSION_EXPIRED", "后台登录已失效")
			return
		}
		c.Set("admin", name)
		if account, exists := a.store.AdminAccount(name); exists {
			c.Set("admin_account", account)
		}
		c.Next()
	}
}
func (a *API) requireAdminPermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		username := c.MustGet("admin").(string)
		if !a.store.AdminHasPermission(username, permission) {
			fail(c, http.StatusForbidden, "ADMIN_PERMISSION_DENIED", "当前管理员没有执行此操作的权限")
			return
		}
		c.Next()
	}
}
func (a *API) superAdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		account, ok := c.MustGet("admin_account").(*app.AdminAccount)
		if !ok || !account.IsSuper {
			fail(c, http.StatusForbidden, "SUPER_ADMIN_REQUIRED", "仅超级管理员可执行此操作")
			return
		}
		c.Next()
	}
}
func (a *API) csrf() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("X-CSRF-Token")
		if header == "" {
			fail(c, 403, "CSRF_INVALID", "请求校验失败，请刷新后重试")
			return
		}
		// 社区与后台各用各的 CSRF Cookie（同源部署时互不覆盖），任一匹配即通过
		matched := false
		for _, name := range []string{csrfCookie, csrfAdminCookie} {
			if cookie, err := c.Cookie(name); err == nil && cookie != "" && cookie == header {
				matched = true
				break
			}
		}
		if !matched {
			fail(c, 403, "CSRF_INVALID", "请求校验失败，请刷新后重试")
			return
		}
		c.Next()
	}
}
func current(c *gin.Context) *app.Account { return c.MustGet("account").(*app.Account) }

func (a *API) register(c *gin.Context) {
	var in struct {
		Phone      string `json:"phone"`
		Code       string `json:"code"`
		Password   string `json:"password"`
		Nickname   string `json:"nickname"`
		InviteCode string `json:"invite_code"`
	}
	if c.ShouldBindJSON(&in) != nil {
		fail(c, 400, "INVALID_BODY", "请填写完整注册信息")
		return
	}
	if !validPhone(in.Phone) {
		fail(c, 422, "PHONE_INVALID", "手机号格式不正确")
		return
	}
	if len(in.Password) < 8 {
		fail(c, 422, "PASSWORD_INVALID", "密码至少 8 位")
		return
	}
	if in.InviteCode != a.cfg.InviteCode {
		fail(c, 422, "INVITE_INVALID", "邀请码无效")
		return
	}
	var smsErr error
	a.store.MuLock(func() { smsErr = a.verifySMSCodeLocked("register", in.Phone, in.Code) })
	if smsErr != nil {
		fail(c, 422, "SMS_CODE_INVALID", smsErr.Error())
		return
	}
	account, err := a.store.Register(in.Phone, in.Password, in.Nickname)
	if err != nil {
		fail(c, 409, "REGISTER_FAILED", err.Error())
		return
	}
	session := a.store.NewSession(account.ID, "")
	a.setSession(c, communityCookie, session, csrfCookie)
	c.JSON(201, gin.H{"account": account})
}
func (a *API) login(c *gin.Context) {
	var in struct {
		Phone    string `json:"phone"`
		Password string `json:"password"`
	}
	if c.ShouldBindJSON(&in) != nil {
		fail(c, 400, "INVALID_BODY", "请输入手机号和密码")
		return
	}
	account, err := a.store.Login(in.Phone, in.Password)
	if err != nil {
		fail(c, 401, "LOGIN_FAILED", err.Error())
		return
	}
	if account.Status == "deactivated" {
		fail(c, 403, "ACCOUNT_DEACTIVATED", "账号已注销，该手机号可重新注册")
		return
	}
	session := a.store.NewSession(account.ID, "")
	a.setSession(c, communityCookie, session, csrfCookie)
	c.JSON(200, gin.H{"account": account})
}
func (a *API) logout(c *gin.Context) {
	if t, err := c.Cookie(communityCookie); err == nil {
		a.store.DeleteSession(t)
	}
	clearCookie(c, communityCookie)
	c.Status(204)
}
func (a *API) me(c *gin.Context) { c.JSON(200, gin.H{"account": current(c)}) }
func (a *API) updateProfile(c *gin.Context) {
	account := current(c)
	var in struct {
		Nickname  string `json:"nickname"`
		Avatar    string `json:"avatar"`
		Gender    string `json:"gender"`
		RealName  string `json:"real_name"`
		StudentNo string `json:"student_no"`
		ClassName string `json:"class_name"`
	}
	if c.ShouldBindJSON(&in) != nil {
		fail(c, 400, "INVALID_BODY", "资料格式错误")
		return
	}
	if len([]rune(in.Nickname)) < 2 || len([]rune(in.Nickname)) > 16 {
		fail(c, 422, "NICKNAME_INVALID", "昵称需为 2–16 个字符")
		return
	}
	if in.Gender != "男" && in.Gender != "女" {
		fail(c, 422, "GENDER_INVALID", "性别仅支持男或女")
		return
	}
	a.store.MuLock(func() {
		account.Nickname = in.Nickname
		account.Avatar = in.Avatar
		account.Gender = in.Gender
		account.ClassName = in.ClassName
		if !account.Verified {
			account.RealName = in.RealName
			account.StudentNo = in.StudentNo
		}
		account.ProfileDone = account.Nickname != "" && account.Avatar != "" && account.Gender != "" && account.RealName != "" && account.StudentNo != "" && account.ClassName != ""
	})
	c.JSON(200, gin.H{"account": account})
}
func (a *API) submitVerification(c *gin.Context) {
	account := current(c)
	var in struct {
		MaterialURL string `json:"material_url"`
		RealName    string `json:"real_name"`
		StudentNo   string `json:"student_no"`
	}
	if c.ShouldBindJSON(&in) != nil || in.MaterialURL == "" {
		fail(c, 422, "MATERIAL_REQUIRED", "请上传一张证明材料")
		return
	}
	var v *app.Verification
	a.store.MuLock(func() {
		id := a.store.NextID()
		v = &app.Verification{ID: id, AccountID: account.ID, Nickname: account.Nickname, RealName: in.RealName, StudentNo: in.StudentNo, MaterialURL: in.MaterialURL, Status: "pending", CreatedAt: time.Now()}
		a.store.Verifications[id] = v
	})
	c.JSON(201, gin.H{"verification": v})
}

func (a *API) listPosts(c *gin.Context) {
	account := current(c)
	var mine *int64
	if c.Query("mine") == "1" {
		id := account.ID
		mine = &id
	}
	a.store.MuRLock(func() {
		posts := a.store.ListPostsUnlocked(c.Query("q"), mine)
		a.store.DecoratePosts(posts, account.ID)
		c.JSON(200, gin.H{"items": posts})
	})
}
func (a *API) createPost(c *gin.Context) {
	account := current(c)
	if !account.ProfileDone || !account.Verified {
		fail(c, 403, "VERIFICATION_REQUIRED", "完成资料并通过学生认证后才能发帖")
		return
	}
	var in struct {
		Text   string   `json:"text"`
		Images []string `json:"images"`
		Tags   []string `json:"tags"`
	}
	if c.ShouldBindJSON(&in) != nil || len([]rune(strings.TrimSpace(in.Text))) < 1 || len([]rune(in.Text)) > 2000 || len(in.Images) > 9 || len(in.Tags) > 3 {
		fail(c, 422, "POST_INVALID", "正文、图片或标签不符合要求")
		return
	}
	for _, t := range in.Tags {
		if n := len([]rune(t)); n < 1 || n > 10 {
			fail(c, 422, "TAG_INVALID", "标签需为 1–10 字")
			return
		}
	}
	// 内容审核适配层：开发模式为内置演示违禁词检查，命中即拦截；
	// 生产环境应接入独立审核服务，失败/不确定必须转人工，不得默认通过。
	check := a.adapters.Moderation.CheckText(c.Request.Context(), in.Text+" "+strings.Join(in.Tags, " "))
	status := "public"
	if !check.Pass {
		status = "rejected"
	}
	var post *app.Post
	a.store.MuLock(func() {
		id := a.store.NextID()
		now := time.Now()
		post = &app.Post{ID: id, Author: a.store.PublicAccount(account.ID), Text: strings.TrimSpace(in.Text), Images: in.Images, Tags: in.Tags, Status: status, CreatedAt: now, UpdatedAt: now}
		a.store.Posts[id] = post
	})
	if !check.Pass {
		c.JSON(201, gin.H{"post": post, "moderation": check, "message": "内容未通过自动检查：" + check.Reason})
		return
	}
	c.JSON(201, gin.H{"post": post, "moderation": check, "message": "发布成功，等待人工复核"})
}
func (a *API) getPost(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	account := current(c)
	a.store.MuRLock(func() {
		p, exists := a.store.Posts[id]
		// 未公开内容仅作者本人可见，其他人（含搜索/分享链接）一律 404
		if !exists || (p.Status != "public" && p.Author.ID != account.ID) {
			fail(c, 404, "POST_NOT_FOUND", "帖子不存在或已删除")
			return
		}
		out := []app.Post{*p}
		a.store.DecoratePosts(out, account.ID)
		c.JSON(200, gin.H{"post": out[0]})
	})
}
func (a *API) updatePost(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	account := current(c)
	var in struct {
		Text   string   `json:"text"`
		Images []string `json:"images"`
		Tags   []string `json:"tags"`
	}
	if c.ShouldBindJSON(&in) != nil {
		fail(c, 400, "INVALID_BODY", "内容格式错误")
		return
	}
	a.store.MuLock(func() {
		p, exists := a.store.Posts[id]
		if !exists || p.Author.ID != account.ID {
			fail(c, 404, "POST_NOT_FOUND", "帖子不存在")
			return
		}
		p.Text = in.Text
		p.Images = in.Images
		p.Tags = in.Tags
		p.Status = "pending"
		p.UpdatedAt = time.Now()
		c.JSON(200, gin.H{"post": p, "message": "修改稿已提交审核"})
	})
}
func (a *API) deletePost(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	account := current(c)
	a.store.MuLock(func() {
		p, exists := a.store.Posts[id]
		if !exists || p.Author.ID != account.ID {
			fail(c, 404, "POST_NOT_FOUND", "帖子不存在")
			return
		}
		p.Status = "deleted"
		p.UpdatedAt = time.Now()
		c.Status(204)
	})
}
func (a *API) likePost(c *gin.Context)     { a.togglePostFlag(c, "like") }
func (a *API) bookmarkPost(c *gin.Context) { a.togglePostFlag(c, "bookmark") }
func (a *API) togglePostFlag(c *gin.Context, kind string) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	account := current(c)
	a.store.MuLock(func() {
		p, exists := a.store.Posts[id]
		if !exists || p.Status != "public" {
			fail(c, 404, "POST_NOT_FOUND", "帖子不存在")
			return
		}
		if kind == "like" {
			liked, _ := a.store.ToggleLikeLocked(id, account.ID)
			// 仅在“未点赞 → 已点赞”时通知帖子作者。取消点赞不产生消息，
			// 作者给自己的帖子点赞也不产生无意义的自通知。
			if liked && p.Author.ID != account.ID {
				a.store.NotifyLocked(
					p.Author.ID,
					"like",
					fmt.Sprintf("%s 赞同了你的帖子", account.Nickname),
					truncateRunes(p.Text, 50),
					"post",
					id,
				)
			}
		} else {
			a.store.ToggleBookmarkLocked(id, account.ID)
		}
		out := []app.Post{*p}
		a.store.DecoratePosts(out, account.ID)
		c.JSON(200, gin.H{"post": out[0]})
	})
}
func (a *API) listComments(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	account := current(c)
	items := []app.Comment{}
	a.store.MuRLock(func() {
		for _, item := range a.store.Comments {
			if item.PostID == id && (item.Status == "public" || item.Author.ID == account.ID) {
				items = append(items, *item)
			}
		}
	})
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.Before(items[j].CreatedAt) })
	c.JSON(200, gin.H{"items": items})
}
func (a *API) createComment(c *gin.Context) {
	postID, ok := idParam(c)
	if !ok {
		return
	}
	account := current(c)
	if !account.Verified {
		fail(c, 403, "VERIFICATION_REQUIRED", "通过学生认证后才能评论")
		return
	}
	var in struct {
		Text     string `json:"text"`
		Image    string `json:"image"`
		ParentID *int64 `json:"parent_id"`
	}
	if c.ShouldBindJSON(&in) != nil || len([]rune(strings.TrimSpace(in.Text))) < 1 || len([]rune(in.Text)) > 500 {
		fail(c, 422, "COMMENT_INVALID", "评论需为 1–500 字")
		return
	}
	check := a.adapters.Moderation.CheckText(c.Request.Context(), in.Text)
	status := "public"
	if !check.Pass {
		status = "rejected"
	}
	var item *app.Comment
	a.store.MuLock(func() {
		// 主评论已删除时禁止在其下新增回复
		if in.ParentID != nil {
			parent, ok := a.store.Comments[*in.ParentID]
			if !ok || parent.PostID != postID {
				fail(c, 404, "COMMENT_NOT_FOUND", "要回复的评论不存在")
				return
			}
			if parent.Deleted || parent.Status != "public" {
				fail(c, 403, "COMMENT_CLOSED", "该评论已删除，不能再回复")
				return
			}
		}
		id := a.store.NextID()
		item = &app.Comment{ID: id, PostID: postID, ParentID: in.ParentID, Author: a.store.PublicAccount(account.ID), Text: strings.TrimSpace(in.Text), Image: in.Image, Status: status, CreatedAt: time.Now()}
		a.store.Comments[id] = item
		p := a.store.Posts[postID]
		if p != nil && status == "public" {
			p.Comments++
			// 通知规则：主评论通知帖子作者；回复只通知被回复者，不重复通知帖子作者
			if in.ParentID == nil {
				if p.Author.ID != account.ID {
					a.store.NotifyLocked(p.Author.ID, "comment", "你的帖子有了新评论", truncateRunes(item.Text, 50), "post", postID)
				}
			} else if parent := a.store.Comments[*in.ParentID]; parent != nil && parent.Author.ID != account.ID {
				a.store.NotifyLocked(parent.Author.ID, "reply", "有人回复了你的评论", truncateRunes(item.Text, 50), "post", postID)
			}
		}
	})
	if item == nil {
		return
	}
	if !check.Pass {
		c.JSON(201, gin.H{"comment": item, "moderation": check, "message": "评论未通过自动检查：" + check.Reason})
		return
	}
	c.JSON(201, gin.H{"comment": item, "moderation": check, "message": "评论已发布"})
}
func (a *API) publicUser(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	viewer := current(c)
	a.store.MuRLock(func() {
		account, exists := a.store.Accounts[id]
		if !exists || account.Status == "deactivated" {
			fail(c, 404, "USER_NOT_FOUND", "用户不存在")
			return
		}
		// 公开主页只展示已公开帖子，不泄露待审 / 未通过 / 下架内容
		posts := []app.Post{}
		for _, p := range a.store.ListPostsUnlocked("", nil) {
			if p.Author.ID == account.ID {
				posts = append(posts, p)
			}
		}
		a.store.DecoratePosts(posts, viewer.ID)
		c.JSON(200, gin.H{"user": a.store.PublicAccount(account.ID), "posts": posts})
	})
}
func (a *API) listAnnouncements(c *gin.Context) {
	items := []app.Announcement{}
	a.store.MuRLock(func() {
		for _, item := range a.store.Announcements {
			if item.Published {
				items = append(items, *item)
			}
		}
	})
	sort.Slice(items, func(i, j int) bool { return announcementTime(items[i]).After(announcementTime(items[j])) })
	c.JSON(200, gin.H{"items": items})
}
func (a *API) getAnnouncement(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	a.store.MuRLock(func() {
		item, exists := a.store.Announcements[id]
		if !exists || !item.Published {
			fail(c, 404, "ANNOUNCEMENT_NOT_FOUND", "公告不存在")
			return
		}
		c.JSON(200, gin.H{"announcement": item})
	})
}
func (a *API) listTools(c *gin.Context) {
	items := []app.Tool{}
	a.store.MuRLock(func() {
		for _, item := range a.store.Tools {
			if item.Enabled {
				items = append(items, *item)
			}
		}
	})
	sort.Slice(items, func(i, j int) bool { return items[i].Weight > items[j].Weight })
	c.JSON(200, gin.H{"items": items})
}

// startDirectConversation 从公开主页发起私信：建立（或复用）一对一会话。
// 首次联系的内置招呼由客户端随后通过 messages 接口以 system=true 发送。
func (a *API) startDirectConversation(c *gin.Context) {
	account := current(c)
	if !account.ProfileDone || !account.Verified {
		fail(c, 403, "VERIFICATION_REQUIRED", "完成资料并通过学生认证后才能发送私信")
		return
	}
	var in struct {
		UserID int64 `json:"user_id"`
	}
	if c.ShouldBindJSON(&in) != nil || in.UserID == 0 {
		fail(c, 400, "INVALID_BODY", "缺少对方用户编号")
		return
	}
	if in.UserID == account.ID {
		fail(c, 422, "DM_SELF_INVALID", "不能给自己发私信")
		return
	}
	a.store.MuLock(func() {
		target, exists := a.store.Accounts[in.UserID]
		if !exists || target.Status == "deactivated" {
			fail(c, 404, "USER_NOT_FOUND", "用户不存在")
			return
		}
		for _, conv := range a.store.DirectConversations {
			if contains(conv.MemberIDs, account.ID) && contains(conv.MemberIDs, in.UserID) {
				c.JSON(200, gin.H{"item": directConversationItem(a.store, conv, account.ID)})
				return
			}
		}
		id := a.store.NextID()
		conv := &app.DirectConversation{ID: id, MemberIDs: []int64{account.ID, in.UserID}, GreetingBy: map[int64]bool{}, Messages: []app.DirectMessage{}, UpdatedAt: time.Now()}
		a.store.DirectConversations[id] = conv
		c.JSON(201, gin.H{"item": directConversationItem(a.store, conv, account.ID)})
	})
}

// directConversationItem 会话的对外展示结构（调用方需持有锁）。
func directConversationItem(s *app.Store, conv *app.DirectConversation, viewerID int64) gin.H {
	other := conv.MemberIDs[0]
	if other == viewerID {
		other = conv.MemberIDs[1]
	}
	return gin.H{"id": conv.ID, "other": s.PublicAccount(other), "unlocked": conv.GreetingBy[viewerID] && conv.GreetingBy[other], "messages": conv.Messages, "updated_at": conv.UpdatedAt}
}

func (a *API) listDirectConversations(c *gin.Context) {
	account := current(c)
	items := []gin.H{}
	a.store.MuRLock(func() {
		for _, conv := range a.store.DirectConversations {
			if !contains(conv.MemberIDs, account.ID) {
				continue
			}
			items = append(items, directConversationItem(a.store, conv, account.ID))
		}
	})
	c.JSON(200, gin.H{"items": items})
}
func (a *API) getDirectConversation(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	account := current(c)
	a.store.MuRLock(func() {
		conv, exists := a.store.DirectConversations[id]
		if !exists || !contains(conv.MemberIDs, account.ID) {
			fail(c, 404, "CONVERSATION_NOT_FOUND", "会话不存在")
			return
		}
		other := conv.MemberIDs[0]
		if other == account.ID {
			other = conv.MemberIDs[1]
		}
		c.JSON(200, gin.H{"conversation": conv, "other": a.store.PublicAccount(other), "unlocked": conv.GreetingBy[account.ID] && conv.GreetingBy[other]})
	})
}
func (a *API) sendDirectMessage(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	account := current(c)
	if !account.ProfileDone || !account.Verified {
		fail(c, 403, "VERIFICATION_REQUIRED", "完成资料并通过学生认证后才能发送私信")
		return
	}
	var in struct {
		Text   string `json:"text"`
		System bool   `json:"system"`
	}
	if c.ShouldBindJSON(&in) != nil || strings.TrimSpace(in.Text) == "" {
		fail(c, 422, "MESSAGE_INVALID", "消息不能为空")
		return
	}
	var msg app.DirectMessage
	a.store.MuLock(func() {
		conv, exists := a.store.DirectConversations[id]
		if !exists || !contains(conv.MemberIDs, account.ID) {
			fail(c, 404, "CONVERSATION_NOT_FOUND", "会话不存在")
			return
		}
		other := conv.MemberIDs[0]
		if other == account.ID {
			other = conv.MemberIDs[1]
		}
		unlocked := conv.GreetingBy[account.ID] && conv.GreetingBy[other]
		if !unlocked && !in.System {
			fail(c, 403, "GREETING_REQUIRED", "双方回复内置消息后才能自由聊天")
			return
		}
		if in.System && conv.GreetingBy[account.ID] {
			fail(c, 409, "GREETING_ALREADY_SENT", "不能重复发送内置招呼")
			return
		}
		// 私信经过审核适配层后送达；审核异常保持未送达，由用户手动重试
		msgStatus := "delivered"
		if check := a.adapters.Moderation.CheckText(c.Request.Context(), in.Text); !check.Pass {
			msgStatus = "blocked"
		}
		msg = app.DirectMessage{ID: a.store.NextID(), SenderID: account.ID, Text: strings.TrimSpace(in.Text), System: in.System, Status: msgStatus, CreatedAt: time.Now()}
		conv.Messages = append(conv.Messages, msg)
		if in.System {
			conv.GreetingBy[account.ID] = true
		}
		conv.UpdatedAt = time.Now()
		c.JSON(201, gin.H{"message": msg, "unlocked": conv.GreetingBy[account.ID] && conv.GreetingBy[other]})
	})
}

// markDirectConversationRead 进入会话后持久化已读：把会话中对方已送达的消息置为 read，
// 返回当前用户全部会话的私信未读总数，便于客户端直接刷新底栏冒泡。
func (a *API) markDirectConversationRead(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	account := current(c)
	a.store.MuLock(func() {
		conv, exists := a.store.DirectConversations[id]
		if !exists || !contains(conv.MemberIDs, account.ID) {
			fail(c, 404, "CONVERSATION_NOT_FOUND", "会话不存在")
			return
		}
		for i := range conv.Messages {
			if conv.Messages[i].SenderID != account.ID && conv.Messages[i].Status == "delivered" {
				conv.Messages[i].Status = "read"
			}
		}
		c.JSON(200, gin.H{"unread": directUnreadUnlocked(a.store, account.ID)})
	})
}

// directUnreadUnlocked 统计当前用户所有会话中对方发来且未读的消息总数（调用方需持有锁）。
func directUnreadUnlocked(s *app.Store, accountID int64) int {
	unread := 0
	for _, conv := range s.DirectConversations {
		if !contains(conv.MemberIDs, accountID) {
			continue
		}
		for _, m := range conv.Messages {
			if m.SenderID != accountID && m.Status == "delivered" {
				unread++
			}
		}
	}
	return unread
}

func (a *API) aiModels(c *gin.Context) {
	items := []app.AIProvider{}
	a.store.MuRLock(func() {
		for _, p := range a.store.Providers {
			if p.Enabled && p.Public {
				safe := *p
				safe.BaseURL = ""
				items = append(items, safe)
			}
		}
	})
	c.JSON(200, gin.H{"items": items})
}
func (a *API) aiConversations(c *gin.Context) {
	account := current(c)
	items := []app.Conversation{}
	a.store.MuRLock(func() {
		for _, conv := range a.store.AIConversations {
			if conv.OwnerID == account.ID {
				items = append(items, *conv)
			}
		}
	})
	c.JSON(200, gin.H{"items": items, "remaining": 10 - countAnswersToday(items)})
}
func (a *API) createAIConversation(c *gin.Context) {
	account := current(c)
	if !account.Verified {
		fail(c, 403, "VERIFICATION_REQUIRED", "通过学生认证后才能使用 AI 问答")
		return
	}
	var in struct{ Title, Model string }
	_ = c.ShouldBindJSON(&in)
	if in.Title == "" {
		in.Title = "新会话"
	}
	var conv *app.Conversation
	a.store.MuLock(func() {
		id := a.store.NextID()
		conv = &app.Conversation{ID: id, OwnerID: account.ID, Title: in.Title, Model: in.Model, Messages: []app.AIMessage{}, CreatedAt: time.Now()}
		a.store.AIConversations[id] = conv
	})
	c.JSON(201, gin.H{"conversation": conv})
}
func (a *API) deleteAIConversation(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	account := current(c)
	a.store.MuLock(func() {
		conv, exists := a.store.AIConversations[id]
		if !exists || conv.OwnerID != account.ID {
			fail(c, 404, "CONVERSATION_NOT_FOUND", "会话不存在")
			return
		}
		delete(a.store.AIConversations, id)
		c.Status(204)
	})
}
func (a *API) askAI(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	account := current(c)
	var in struct{ Text, Model string }
	if c.ShouldBindJSON(&in) != nil || strings.TrimSpace(in.Text) == "" {
		fail(c, 422, "QUESTION_INVALID", "问题不能为空")
		return
	}
	question := strings.TrimSpace(in.Text)
	model := in.Model
	if model == "" {
		model = "campus-demo"
	}
	now := time.Now()

	// 第一阶段（持锁，只做快速内存操作）：校验会话与额度、知识库优先命中、
	// 写入用户消息；未命中知识库时快照历史与可用 AI 服务，随后释放锁再发起外部调用。
	var (
		user      app.AIMessage
		remaining int
		kbHit     bool
		failed    bool
		history   []app.AIMessage
		providers []app.AIProvider
	)
	a.store.MuLock(func() {
		conv, exists := a.store.AIConversations[id]
		if !exists || conv.OwnerID != account.ID {
			fail(c, 404, "CONVERSATION_NOT_FOUND", "会话不存在")
			failed = true
			return
		}
		remaining = 10 - countAnswersTodayUnlocked(a.store.AIConversations, account.ID)
		if remaining <= 0 {
			fail(c, 429, "AI_QUOTA_EXHAUSTED", "今日问答额度已用完")
			failed = true
			return
		}
		user = app.AIMessage{ID: a.store.NextID(), Role: "user", Text: question, CreatedAt: now}
		// 1) 优先检索校内知识库（结构化 + 关键词），命中则直接引用并标注来源
		for _, e := range a.store.KBEntries {
			if !e.Enabled {
				continue
			}
			if kbMatch(e, question) {
				answer := app.AIMessage{ID: a.store.NextID(), Role: "assistant", Text: e.Content, Model: model, Source: fmt.Sprintf("校内资料 · %s（%s）", e.Source, e.SourceDate), CreatedAt: now}
				conv.Messages = append(conv.Messages, user, answer)
				conv.Model = model
				if conv.Title == "新会话" {
					conv.Title = truncateRunes(question, 20)
				}
				kbHit = true
				c.JSON(200, gin.H{"user_message": user, "answer": answer, "remaining": remaining - 1})
				return
			}
		}
		// 2) 知识库未命中：先落用户消息（调用外部服务耗时不可控，不能持锁），
		//    再快照对话历史与可用 AI 服务（含真实密钥的副本）
		conv.Messages = append(conv.Messages, user)
		conv.Model = model
		if conv.Title == "新会话" {
			conv.Title = truncateRunes(question, 20)
		}
		history = append(history, conv.Messages...)
		providers = enabledProviders(a.store.Providers, model)
	})
	if failed || kbHit {
		return
	}

	// 第二阶段（不持锁）：依次调用 AI 服务（OpenAI 兼容协议）；
	// 全部失败再退回联网检索适配层，最后退回本地开发回答。
	answerText, source := "", ""
	if len(providers) > 0 {
		messages := buildChatMessages(history)
		for _, p := range providers {
			text, err := a.adapters.AI.Chat(c.Request.Context(), p.BaseURL, p.APIKey, p.Model, messages)
			if err != nil || strings.TrimSpace(text) == "" {
				continue
			}
			answerText = text
			source = fmt.Sprintf("AI 服务 · %s", p.Name)
			break
		}
	}
	needRecord := false
	if answerText == "" {
		if searchResult, err := a.adapters.Search.Search(c.Request.Context(), question); err == nil && searchResult != "" {
			answerText = searchResult
			source = "联网检索"
		} else {
			answerText = "本地开发回答：校内资料未覆盖该问题，且联网检索服务未配置。该问题已记录到后台「待补充问题」，管理员补充答案后会在消息页通知你。"
			source = "本地开发模式"
		}
		// 知识库与大模型都没答上的问题，记录待补充等待管理员补充
		needRecord = true
	}

	// 第三阶段（持锁）：会话可能在等待期间被删除；追加回答并按需记录待补充问题
	a.store.MuLock(func() {
		conv, exists := a.store.AIConversations[id]
		if !exists || conv.OwnerID != account.ID {
			fail(c, 404, "CONVERSATION_NOT_FOUND", "会话不存在")
			return
		}
		answer := app.AIMessage{ID: a.store.NextID(), Role: "assistant", Text: answerText, Model: model, Source: source, CreatedAt: now}
		conv.Messages = append(conv.Messages, answer)
		if needRecord {
			recordPendingQuestion(a.store, account.ID, question)
		}
		c.JSON(200, gin.H{"user_message": user, "answer": answer, "remaining": remaining - 1})
	})
}

const aiHistoryLimit = 20

// enabledProviders 快照可调用的大模型服务：启用且已配置地址与真实密钥，
// 按 FallbackOrder 升序；请求指定了模型时，匹配该模型的服务优先（调用方需持有锁）。
func enabledProviders(all map[int64]*app.AIProvider, model string) []app.AIProvider {
	items := []app.AIProvider{}
	for _, p := range all {
		if p.Enabled && p.BaseURL != "" && p.APIKey != "" {
			items = append(items, *p)
		}
	}
	sort.SliceStable(items, func(i, j int) bool {
		mi, mj := items[i].Model == model, items[j].Model == model
		if mi != mj {
			return mi
		}
		return items[i].FallbackOrder < items[j].FallbackOrder
	})
	return items
}

// buildChatMessages 把会话历史映射为 OpenAI 兼容协议消息，附带校园助手系统提示。
func buildChatMessages(history []app.AIMessage) []adapters.ChatMessage {
	messages := []adapters.ChatMessage{{Role: "system", Content: "你是校园社区的 AI 助手，请用简洁、准确、友好的中文回答学生的问题；不确定的信息不要编造，建议同学核实官方渠道。"}}
	if len(history) > aiHistoryLimit {
		history = history[len(history)-aiHistoryLimit:]
	}
	for _, m := range history {
		if m.Role != "user" && m.Role != "assistant" {
			continue
		}
		messages = append(messages, adapters.ChatMessage{Role: m.Role, Content: m.Text})
	}
	return messages
}

// maskAPIKey 生成密钥掩码：仅保留末 4 位，绝不回显完整密钥。
func maskAPIKey(key string) string {
	runes := []rune(key)
	if len(runes) <= 4 {
		return "••••"
	}
	return "••••" + string(runes[len(runes)-4:])
}

func (a *API) adminLogin(c *gin.Context) {
	var in struct{ Username, Password string }
	if c.ShouldBindJSON(&in) != nil {
		fail(c, 401, "ADMIN_LOGIN_FAILED", "登录名或密码错误")
		return
	}
	admin, err := a.store.AdminLogin(in.Username, in.Password)
	if err != nil {
		fail(c, 401, "ADMIN_LOGIN_FAILED", "登录名或密码错误")
		return
	}
	session := a.store.NewSession(0, in.Username)
	a.setSession(c, adminCookie, session, csrfAdminCookie)
	a.store.MuLock(func() { a.store.AddAuditUnlocked(in.Username, "admin.login", "session", "success", "", "security") })
	c.JSON(200, gin.H{"admin": a.adminResponse(admin)})
}
func (a *API) adminLogout(c *gin.Context) { clearCookie(c, adminCookie); c.Status(204) }
func (a *API) adminMe(c *gin.Context) {
	username := c.MustGet("admin").(string)
	admin, ok := a.store.AdminAccount(username)
	if !ok {
		fail(c, 401, "ADMIN_SESSION_EXPIRED", "后台登录已失效")
		return
	}
	c.JSON(200, gin.H{"admin": a.adminResponse(admin)})
}
func (a *API) adminDashboard(c *gin.Context) {
	canReadAudits := a.store.AdminHasPermission(c.MustGet("admin").(string), "audit.security.read")
	a.store.MuRLock(func() {
		pending := 0
		for _, v := range a.store.Verifications {
			if v.Status == "pending" {
				pending++
			}
		}
		publicPosts := 0
		for _, p := range a.store.Posts {
			if p.Status == "public" {
				publicPosts++
			}
		}
		recentAudits := []app.AuditLog{}
		if canReadAudits {
			recentAudits = lastAudits(a.store.AuditLogs, 5)
		}
		c.JSON(200, gin.H{"users": len(a.store.Accounts), "public_posts": publicPosts, "pending_verifications": pending, "ai_providers": len(a.store.Providers), "recent_audits": recentAudits})
	})
}
func (a *API) adminVerifications(c *gin.Context) {
	items := []app.Verification{}
	a.store.MuRLock(func() {
		for _, v := range a.store.Verifications {
			items = append(items, *v)
		}
	})
	c.JSON(200, gin.H{"items": items})
}
func (a *API) reviewVerification(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	var in struct{ Status, Reason string }
	if c.ShouldBindJSON(&in) != nil || (in.Status != "approved" && in.Status != "rejected") {
		fail(c, 422, "STATUS_INVALID", "审核结果无效")
		return
	}
	admin := c.MustGet("admin").(string)
	a.store.MuLock(func() {
		v, exists := a.store.Verifications[id]
		if !exists {
			fail(c, 404, "VERIFICATION_NOT_FOUND", "认证申请不存在")
			return
		}
		v.Status = in.Status
		v.RejectReason = in.Reason
		if in.Status == "approved" {
			if account := a.store.Accounts[v.AccountID]; account != nil {
				account.Verified = true
				account.RealName = v.RealName
				account.StudentNo = v.StudentNo
			}
		}
		a.store.AddAuditUnlocked(admin, "verification.review", fmt.Sprintf("verification:%d", id), in.Status, in.Reason, "security")
		c.JSON(200, gin.H{"verification": v})
	})
}
func (a *API) adminPosts(c *gin.Context) {
	a.store.MuRLock(func() {
		c.JSON(200, gin.H{"items": a.store.ListAllPostsUnlocked(c.Query("q"))})
	})
}
func (a *API) moderatePost(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	var in struct {
		Status string `json:"status"`
		Pinned *bool  `json:"pinned"`
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&in)
	if in.Status != "" && in.Status != "public" && in.Status != "removed" {
		fail(c, 422, "STATUS_INVALID", "管理端仅支持恢复公开或下架")
		return
	}
	admin := c.MustGet("admin").(string)
	a.store.MuLock(func() {
		p, exists := a.store.Posts[id]
		if !exists {
			fail(c, 404, "POST_NOT_FOUND", "帖子不存在")
			return
		}
		action := "post.moderate"
		if in.Status != "" {
			p.Status = in.Status
			p.UpdatedAt = time.Now()
		}
		if in.Pinned != nil {
			p.Pinned = *in.Pinned
			action = "post.pin"
		}
		a.store.AddAuditUnlocked(admin, action, fmt.Sprintf("post:%d", id), p.Status, in.Reason, "security")
		c.JSON(200, gin.H{"post": p})
	})
}
func (a *API) adminUsers(c *gin.Context) {
	items := []*app.Account{}
	canReadPrivate := a.store.AdminHasPermission(c.MustGet("admin").(string), "profile.private.read")
	a.store.MuRLock(func() {
		for _, account := range a.store.Accounts {
			copy := *account
			if !canReadPrivate {
				copy.Phone = ""
				copy.RealName = ""
				copy.StudentNo = ""
				copy.ClassName = ""
			}
			items = append(items, &copy)
		}
	})
	c.JSON(200, gin.H{"items": items})
}
func (a *API) updateUserStatus(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	var in struct {
		Status   string `json:"status"`    // active / muted / banned
		MuteDays int    `json:"mute_days"` // 禁言固定档位：1 / 3 / 7 天
		Reason   string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&in)
	if in.Status != "active" && in.Status != "muted" && in.Status != "banned" {
		fail(c, 422, "STATUS_INVALID", "状态仅支持 active / muted / banned")
		return
	}
	if in.Status == "muted" && in.MuteDays != 1 && in.MuteDays != 3 && in.MuteDays != 7 {
		fail(c, 422, "MUTE_DAYS_INVALID", "禁言时长仅支持 1 / 3 / 7 天档位")
		return
	}
	admin := c.MustGet("admin").(string)
	a.store.MuLock(func() {
		account, exists := a.store.Accounts[id]
		if !exists || account.Status == "deactivated" {
			fail(c, 404, "USER_NOT_FOUND", "用户不存在")
			return
		}
		now := time.Now()
		switch in.Status {
		case "muted", "banned":
			account.Status = in.Status
			kind := "mute"
			var ends *time.Time
			if in.Status == "banned" {
				kind = "ban"
				account.MutedUntil = nil
			} else {
				t := now.Add(time.Duration(in.MuteDays) * 24 * time.Hour)
				ends = &t
				account.MutedUntil = ends
			}
			pid := a.store.NextID()
			a.store.Punishments[pid] = &app.Punishment{ID: pid, AccountID: id, Kind: kind, MuteDays: in.MuteDays, Reason: in.Reason, Status: "active", CreatedAt: now, EndsAt: ends}
			title := "你的账号已被禁言"
			body := fmt.Sprintf("禁言 %d 天，原因：%s。期间不能发帖、评论或发送私信；如有异议可在 7 天内申诉一次。", in.MuteDays, in.Reason)
			if kind == "ban" {
				title = "你的账号已被封禁"
				body = fmt.Sprintf("永久封禁，原因：%s。封禁期间仅可查看处罚通知和提交申诉。", in.Reason)
			}
			a.store.NotifyLocked(id, "punishment", title, body, "punishment", pid)
		case "active":
			account.Status = "active"
			account.MutedUntil = nil
			for _, p := range a.store.Punishments {
				if p.AccountID == id && p.Status == "active" {
					p.Status = "lifted"
				}
			}
		}
		a.store.AddAuditUnlocked(admin, "user.status", fmt.Sprintf("user:%d", id), in.Status, in.Reason, "security")
		c.JSON(200, gin.H{"account": account})
	})
}
func (a *API) adminAnnouncements(c *gin.Context) {
	items := []app.Announcement{}
	a.store.MuRLock(func() {
		for _, item := range a.store.Announcements {
			items = append(items, *item)
		}
	})
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
	c.JSON(200, gin.H{"items": items})
}

type announcementInput struct {
	Title     string `json:"title"`
	Summary   string `json:"summary"`
	Body      string `json:"body"`
	ImageURL  string `json:"image_url"`
	LinkURL   string `json:"link_url"`
	LinkText  string `json:"link_text"`
	Published bool   `json:"published"`
}

func (in *announcementInput) normalize() error {
	in.Title = strings.TrimSpace(in.Title)
	in.Summary = strings.TrimSpace(in.Summary)
	in.Body = strings.TrimSpace(in.Body)
	in.ImageURL = strings.TrimSpace(in.ImageURL)
	in.LinkURL = strings.TrimSpace(in.LinkURL)
	in.LinkText = strings.TrimSpace(in.LinkText)
	if in.Title == "" || in.Summary == "" || in.Body == "" {
		return fmt.Errorf("请完整填写标题、摘要和正文")
	}
	if utf8.RuneCountInString(in.Title) > 60 || utf8.RuneCountInString(in.Summary) > 120 || utf8.RuneCountInString(in.Body) > 10000 {
		return fmt.Errorf("标题最多 60 字、摘要最多 120 字、正文最多 10000 字")
	}
	if in.ImageURL != "" && !strings.HasPrefix(in.ImageURL, "/uploads/") && !safeHTTPURL(in.ImageURL) {
		return fmt.Errorf("图片地址无效")
	}
	if in.LinkURL != "" && !safeHTTPURL(in.LinkURL) {
		return fmt.Errorf("点击链接必须是有效的 http 或 https 地址")
	}
	if in.LinkURL == "" {
		in.LinkText = ""
	} else if in.LinkText == "" {
		in.LinkText = "查看详情"
	}
	if utf8.RuneCountInString(in.LinkText) > 30 {
		return fmt.Errorf("链接文字最多 30 字")
	}
	return nil
}

func safeHTTPURL(raw string) bool {
	parsed, err := url.ParseRequestURI(raw)
	return err == nil && parsed.Host != "" && (parsed.Scheme == "http" || parsed.Scheme == "https")
}

func announcementTime(item app.Announcement) time.Time {
	if item.PublishedAt != nil {
		return *item.PublishedAt
	}
	return item.CreatedAt
}

func (a *API) createAnnouncement(c *gin.Context) {
	var input announcementInput
	if c.ShouldBindJSON(&input) != nil {
		fail(c, 422, "ANNOUNCEMENT_INVALID", "公告内容格式不正确")
		return
	}
	if err := input.normalize(); err != nil {
		fail(c, 422, "ANNOUNCEMENT_INVALID", err.Error())
		return
	}
	admin := c.MustGet("admin").(string)
	var created app.Announcement
	a.store.MuLock(func() {
		now := time.Now()
		created = app.Announcement{ID: a.store.NextID(), Title: input.Title, Summary: input.Summary, Body: input.Body, ImageURL: input.ImageURL, LinkURL: input.LinkURL, LinkText: input.LinkText, Published: input.Published, CreatedAt: now, UpdatedAt: now}
		if created.Published {
			created.PublishedAt = &now
		}
		a.store.Announcements[created.ID] = &created
		a.store.AddAuditUnlocked(admin, "announcement.create", fmt.Sprintf("announcement:%d", created.ID), "success", "", "operational")
	})
	c.JSON(201, gin.H{"announcement": created})
}
func (a *API) updateAnnouncement(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	var input announcementInput
	if c.ShouldBindJSON(&input) != nil {
		fail(c, 422, "ANNOUNCEMENT_INVALID", "公告内容格式不正确")
		return
	}
	if err := input.normalize(); err != nil {
		fail(c, 422, "ANNOUNCEMENT_INVALID", err.Error())
		return
	}
	admin := c.MustGet("admin").(string)
	a.store.MuLock(func() {
		item, exists := a.store.Announcements[id]
		if !exists {
			fail(c, 404, "ANNOUNCEMENT_NOT_FOUND", "公告不存在")
			return
		}
		wasPublished := item.Published
		item.Title = input.Title
		item.Summary = input.Summary
		item.Body = input.Body
		item.ImageURL = input.ImageURL
		item.LinkURL = input.LinkURL
		item.LinkText = input.LinkText
		item.Published = input.Published
		item.UpdatedAt = time.Now()
		if input.Published && !wasPublished {
			publishedAt := item.UpdatedAt
			item.PublishedAt = &publishedAt
		}
		a.store.AddAuditUnlocked(admin, "announcement.update", fmt.Sprintf("announcement:%d", id), "success", "", "operational")
		c.JSON(200, gin.H{"announcement": item})
	})
}
func (a *API) adminTools(c *gin.Context) {
	items := []app.Tool{}
	a.store.MuRLock(func() {
		for _, item := range a.store.Tools {
			items = append(items, *item)
		}
	})
	c.JSON(200, gin.H{"items": items})
}
func (a *API) createTool(c *gin.Context) {
	var in app.Tool
	if c.ShouldBindJSON(&in) != nil || in.Name == "" {
		fail(c, 422, "TOOL_INVALID", "工具名称不能为空")
		return
	}
	admin := c.MustGet("admin").(string)
	a.store.MuLock(func() {
		in.ID = a.store.NextID()
		a.store.Tools[in.ID] = &in
		a.store.AddAuditUnlocked(admin, "tool.create", fmt.Sprintf("tool:%d", in.ID), "success", "", "operational")
	})
	c.JSON(201, gin.H{"tool": in})
}
func (a *API) updateTool(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	var in app.Tool
	_ = c.ShouldBindJSON(&in)
	admin := c.MustGet("admin").(string)
	a.store.MuLock(func() {
		item, exists := a.store.Tools[id]
		if !exists {
			fail(c, 404, "TOOL_NOT_FOUND", "工具不存在")
			return
		}
		if in.Name != "" {
			item.Name = in.Name
		}
		if in.Type != "" {
			item.Type = in.Type
		}
		item.URL = in.URL
		item.Weight = in.Weight
		item.Enabled = in.Enabled
		a.store.AddAuditUnlocked(admin, "tool.update", fmt.Sprintf("tool:%d", id), "success", "", "operational")
		c.JSON(200, gin.H{"tool": item})
	})
}
func (a *API) adminProviders(c *gin.Context) {
	items := []app.AIProvider{}
	a.store.MuRLock(func() {
		for _, item := range a.store.Providers {
			items = append(items, *item)
		}
	})
	c.JSON(200, gin.H{"items": items})
}
// providerInput 管理端 AI 服务入参；api_key 为真实密钥，仅用于服务端调用，响应中只回掩码。
type providerInput struct {
	Name          string `json:"name"`
	Protocol      string `json:"protocol"`
	BaseURL       string `json:"base_url"`
	Model         string `json:"model"`
	APIKey        string `json:"api_key"`
	Enabled       bool   `json:"enabled"`
	Public        bool   `json:"public"`
	FallbackOrder int    `json:"fallback_order"`
}

func (a *API) createProvider(c *gin.Context) {
	var in providerInput
	if c.ShouldBindJSON(&in) != nil || in.Name == "" || in.BaseURL == "" || in.Model == "" {
		fail(c, 422, "PROVIDER_INVALID", "服务名称、地址和模型不能为空")
		return
	}
	if in.Protocol == "" {
		in.Protocol = "openai-compatible"
	}
	provider := &app.AIProvider{
		Name:          in.Name,
		Protocol:      in.Protocol,
		BaseURL:       in.BaseURL,
		Model:         in.Model,
		Enabled:       in.Enabled,
		Public:        in.Public,
		FallbackOrder: in.FallbackOrder,
	}
	if in.APIKey != "" {
		provider.APIKey = in.APIKey
		provider.APIKeyMasked = maskAPIKey(in.APIKey)
	} else {
		provider.APIKeyMasked = "••••configured"
	}
	admin := c.MustGet("admin").(string)
	a.store.MuLock(func() {
		provider.ID = a.store.NextID()
		a.store.Providers[provider.ID] = provider
		a.store.AddAuditUnlocked(admin, "ai_provider.create", fmt.Sprintf("ai_provider:%d", provider.ID), "success", "", "security")
	})
	c.JSON(201, gin.H{"provider": provider})
}
func (a *API) updateProvider(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	var in providerInput
	_ = c.ShouldBindJSON(&in)
	admin := c.MustGet("admin").(string)
	a.store.MuLock(func() {
		item, exists := a.store.Providers[id]
		if !exists {
			fail(c, 404, "PROVIDER_NOT_FOUND", "AI 服务不存在")
			return
		}
		if in.Name != "" {
			item.Name = in.Name
		}
		if in.BaseURL != "" {
			item.BaseURL = in.BaseURL
		}
		if in.Model != "" {
			item.Model = in.Model
		}
		// 密钥留空表示不修改；提交新密钥则整体替换并更新掩码
		if in.APIKey != "" {
			item.APIKey = in.APIKey
			item.APIKeyMasked = maskAPIKey(in.APIKey)
		}
		item.Enabled = in.Enabled
		item.Public = in.Public
		item.FallbackOrder = in.FallbackOrder
		a.store.AddAuditUnlocked(admin, "ai_provider.update", fmt.Sprintf("ai_provider:%d", id), "success", "", "security")
		c.JSON(200, gin.H{"provider": item})
	})
}
func (a *API) adminAudits(c *gin.Context) {
	a.store.MuRLock(func() { c.JSON(200, gin.H{"items": a.store.AuditLogs}) })
}

func contains(items []int64, id int64) bool {
	for _, item := range items {
		if item == id {
			return true
		}
	}
	return false
}
func truncateRunes(v string, n int) string {
	r := []rune(v)
	if len(r) <= n {
		return v
	}
	return string(r[:n]) + "…"
}

// kbMatch 知识库关键词匹配：问题与条目标题/内容存在公共子串（≥2 字）即视为命中。
// 生产环境由 PostgreSQL pg_trgm 承担，此处为本地数据实现。
func kbMatch(e *app.KBEntry, question string) bool {
	q := strings.ToLower(question)
	haystack := strings.ToLower(e.Title + " " + e.Content)
	runes := []rune(q)
	for i := 0; i+2 <= len(runes); i++ {
		if strings.Contains(haystack, strings.ToLower(string(runes[i:i+2]))) {
			return true
		}
	}
	return false
}

// recordPendingQuestion 记录或合并待补充问题（调用方需已持有写锁）。
func recordPendingQuestion(s *app.Store, accountID int64, question string) {
	for _, q := range s.PendingQuestions {
		if q.Status == "open" && q.Question == question {
			q.AskCount++
			return
		}
	}
	id := s.NextID()
	s.PendingQuestions[id] = &app.PendingQuestion{ID: id, AccountID: accountID, Question: question, Status: "open", AskCount: 1, CreatedAt: time.Now()}
}
func countAnswersToday(items []app.Conversation) int {
	count := 0
	for _, conv := range items {
		for _, m := range conv.Messages {
			if m.Role == "assistant" && sameDay(m.CreatedAt, time.Now()) {
				count++
			}
		}
	}
	return count
}
func countAnswersTodayUnlocked(items map[int64]*app.Conversation, owner int64) int {
	count := 0
	for _, conv := range items {
		if conv.OwnerID != owner {
			continue
		}
		for _, m := range conv.Messages {
			if m.Role == "assistant" && sameDay(m.CreatedAt, time.Now()) {
				count++
			}
		}
	}
	return count
}
func sameDay(a, b time.Time) bool {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	ay, am, ad := a.In(loc).Date()
	by, bm, bd := b.In(loc).Date()
	return ay == by && am == bm && ad == bd
}
func lastAudits(items []app.AuditLog, n int) []app.AuditLog {
	if len(items) <= n {
		return items
	}
	return items[len(items)-n:]
}
