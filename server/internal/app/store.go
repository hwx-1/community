package app

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/xsnbb/server/internal/config"
	"github.com/xsnbb/server/internal/security"
	"gorm.io/gorm"
)

type Store struct {
	mu                  sync.RWMutex
	db                  *gorm.DB
	strictPersistence   bool
	nextID              int64
	Accounts            map[int64]*Account
	Phones              map[string]int64
	Sessions            map[string]int64
	AdminSessions       map[string]string
	Posts               map[int64]*Post
	Comments            map[int64]*Comment
	Verifications       map[int64]*Verification
	Announcements       map[int64]*Announcement
	Tools               map[int64]*Tool
	Providers           map[int64]*AIProvider
	AIConversations     map[int64]*Conversation
	DirectConversations map[int64]*DirectConversation
	AuditLogs           []AuditLog
	Admins              map[string]*AdminAccount
	AdminRoles          map[int64]*AdminRole

	SMSCodes         map[string]*SMSCode
	Reports          map[int64]*Report
	KBEntries        map[int64]*KBEntry
	PendingQuestions map[int64]*PendingQuestion
	Settings         Settings

	PostLikes     map[int64]map[int64]bool
	PostBookmarks map[int64]map[int64]bool
	Notifications map[int64]*Notification
	Punishments   map[int64]*Punishment
	Appeals       map[int64]*Appeal
}

// storeSnapshot 持久化用户登录会话（Sessions）：部署重启不应把在线用户踢下线，
// Cookie 有效期 7 天，服务端会话需同样存活才有意义。
// AdminSessions 与 SMSCodes 仍是易失安全状态：管理员在重启后需重新登录（缩小令牌暴露面），
// 短信验证码短时效无需持久化。其余用户与管理员产生的内容均为持久数据。
type storeSnapshot struct {
	NextID                 int64                         `json:"next_id"`
	Sessions               map[string]int64              `json:"sessions"`
	Accounts               map[int64]*Account            `json:"accounts"`
	Phones                 map[string]int64              `json:"phones"`
	Posts                  map[int64]*Post               `json:"posts"`
	Comments               map[int64]*Comment            `json:"comments"`
	Verifications          map[int64]*Verification       `json:"verifications"`
	Announcements          map[int64]*Announcement       `json:"announcements"`
	Tools                  map[int64]*Tool               `json:"tools"`
	Providers              map[int64]*AIProvider         `json:"providers"`
	AIConversations        map[int64]*Conversation       `json:"ai_conversations"`
	DirectConversations    map[int64]*DirectConversation `json:"direct_conversations"`
	AuditLogs              []AuditLog                    `json:"audit_logs"`
	Admins                 map[string]*AdminAccount      `json:"admins"`
	AdminRoles             map[int64]*AdminRole          `json:"admin_roles"`
	Reports                map[int64]*Report             `json:"reports"`
	KBEntries              map[int64]*KBEntry            `json:"kb_entries"`
	PendingQuestions       map[int64]*PendingQuestion    `json:"pending_questions"`
	Settings               Settings                      `json:"settings"`
	PostLikes              map[int64]map[int64]bool      `json:"post_likes"`
	PostBookmarks          map[int64]map[int64]bool      `json:"post_bookmarks"`
	Notifications          map[int64]*Notification       `json:"notifications"`
	Punishments            map[int64]*Punishment         `json:"punishments"`
	Appeals                map[int64]*Appeal             `json:"appeals"`
	AccountPasswordHashes  map[int64]string              `json:"account_password_hashes"`
	AdminPasswordHashes    map[string]string             `json:"admin_password_hashes"`
	ProviderAPIKeys        map[int64]string              `json:"provider_api_keys"`
	DirectGreetingBy       map[int64]map[int64]bool      `json:"direct_greeting_by"`
	ReportReporterIDs      map[int64]int64               `json:"report_reporter_ids"`
	NotificationAccountIDs map[int64]int64               `json:"notification_account_ids"`
}

func NewStore(cfg *config.Config) *Store {
	adminHash, _ := security.HashPassword(cfg.SuperAdminPassword)
	demoHash, _ := security.HashPassword("Demo12345")
	s := &Store{
		strictPersistence: cfg.Env == "prod",
		nextID:            100, Accounts: map[int64]*Account{}, Phones: map[string]int64{},
		Sessions: map[string]int64{}, AdminSessions: map[string]string{},
		Posts: map[int64]*Post{}, Comments: map[int64]*Comment{},
		Verifications: map[int64]*Verification{}, Announcements: map[int64]*Announcement{},
		Tools: map[int64]*Tool{}, Providers: map[int64]*AIProvider{},
		AIConversations: map[int64]*Conversation{}, DirectConversations: map[int64]*DirectConversation{},
		SMSCodes: map[string]*SMSCode{}, Reports: map[int64]*Report{},
		KBEntries: map[int64]*KBEntry{}, PendingQuestions: map[int64]*PendingQuestion{},
		PostLikes: map[int64]map[int64]bool{}, PostBookmarks: map[int64]map[int64]bool{},
		Notifications: map[int64]*Notification{}, Punishments: map[int64]*Punishment{},
		Appeals:  map[int64]*Appeal{},
		Settings: Settings{Greeting: "你好，我想和你聊聊", HotTopics: []string{"期末复习", "羽毛球", "食堂新品"}},
		Admins:   map[string]*AdminAccount{}, AdminRoles: map[int64]*AdminRole{},
	}
	now := time.Now()

	// 连接 PostgreSQL
	if cfg.DatabaseURL != "" {
		s.db = ConnectDB(cfg.DatabaseURL)
		if s.db != nil {
			if err := Migrate(s.db); err != nil {
				if s.strictPersistence {
					panic(fmt.Sprintf("PostgreSQL migration failed: %v", err))
				}
				fmt.Printf("[db] migrate failed: %v; using memory store\n", err)
				s.db = nil
			} else {
				loaded, err := s.loadSnapshot()
				if err != nil {
					if s.strictPersistence {
						panic(fmt.Sprintf("PostgreSQL snapshot restore failed: %v", err))
					}
					fmt.Printf("[db] snapshot restore failed: %v; using fresh memory store\n", err)
				} else if loaded {
					fmt.Printf("[db] restored snapshot with %d accounts, %d posts\n", len(s.Accounts), len(s.Posts))
					return s
				}
			}
		}
	}
	if s.strictPersistence && s.db == nil {
		panic("PostgreSQL is required when APP_ENV=prod")
	}

	s.AdminRoles[1] = &AdminRole{ID: 1, Name: "超级管理员", Permissions: []string{"*"}, Protected: true, CreatedAt: now, UpdatedAt: now}
	s.AdminRoles[2] = &AdminRole{ID: 2, Name: "认证审核", Permissions: []string{"verification.review", "profile.private.read"}, CreatedAt: now, UpdatedAt: now}
	s.AdminRoles[3] = &AdminRole{ID: 3, Name: "内容与举报审核", Permissions: []string{"post.moderate", "comment.moderate", "report.review", "appeal.review"}, CreatedAt: now, UpdatedAt: now}
	s.Admins[cfg.SuperAdminUser] = &AdminAccount{ID: 1, Username: cfg.SuperAdminUser, PasswordHash: adminHash, IsSuper: true, RoleIDs: []int64{1}, Enabled: true, CreatedAt: now, UpdatedAt: now}
	if cfg.Env != "prod" && len(s.Accounts) == 0 {
		s.Accounts[1] = &Account{ID: 1, Phone: "13800000000", PasswordHash: demoHash, Nickname: "李大壮", Avatar: "李", Gender: "男", RealName: "李同学", StudentNo: "2023000042", ClassName: "计算机 2301 班", ProfileDone: true, Verified: true, Status: "active", CreatedAt: now.AddDate(0, 0, -23)}
		s.Accounts[2] = &Account{ID: 2, Phone: "13800000001", PasswordHash: demoHash, Nickname: "王小雨", Avatar: "王", Gender: "女", ProfileDone: true, Verified: true, Status: "active", CreatedAt: now.AddDate(0, 0, -18)}
		s.Accounts[3] = &Account{ID: 3, Phone: "13800000002", PasswordHash: demoHash, Nickname: "张同学", Avatar: "张", Gender: "男", ProfileDone: true, Verified: true, Status: "active", CreatedAt: now.AddDate(0, 0, -12)}
	}
	for id, account := range s.Accounts {
		s.Phones[account.Phone] = id
	}
	if cfg.Env != "prod" {
		s.Posts[1] = &Post{ID: 1, Author: s.public(1), Text: "【社区提示】下周起图书馆开放时间调整为 8:00–22:00，期末周延长至 23:00。", Status: "public", Pinned: true, Likes: 32, Comments: 0, Bookmarks: 12, CreatedAt: now.Add(-2 * time.Hour), UpdatedAt: now.Add(-2 * time.Hour)}
		s.Posts[2] = &Post{ID: 2, Author: s.public(1), Text: "周六下午体育馆羽毛球局，还差 2 人，想来的评论区报名～", Images: []string{"/uploads/demo/court-1.jpg", "/uploads/demo/court-2.jpg"}, Tags: []string{"运动", "羽毛球"}, Status: "public", Likes: 8, Comments: 2, Bookmarks: 3, CreatedAt: now.Add(-25 * time.Minute), UpdatedAt: now.Add(-25 * time.Minute)}
		s.Posts[3] = &Post{ID: 3, Author: s.public(2), Text: "高数期末复习重点整理完了，需要的同学可以自取。", Tags: []string{"学习资料", "期末复习"}, Status: "public", Likes: 21, Comments: 1, Bookmarks: 9, CreatedAt: now.Add(-time.Hour), UpdatedAt: now.Add(-time.Hour)}
		s.Comments[1] = &Comment{ID: 1, PostID: 2, Author: s.public(2), Text: "算我一个！", Status: "public", CreatedAt: now.Add(-18 * time.Minute)}
		s.Comments[2] = &Comment{ID: 2, PostID: 2, Author: s.public(3), Text: "新手可以参加吗？", Status: "public", CreatedAt: now.Add(-8 * time.Minute)}
		s.Verifications[1] = &Verification{ID: 1, AccountID: 3, Nickname: "张同学", RealName: "张同学", StudentNo: "2023000066", MaterialURL: "/private/verifications/demo.jpg", Status: "pending", CreatedAt: now.Add(-8 * 24 * time.Hour)}
		s.DirectConversations[1] = &DirectConversation{ID: 1, MemberIDs: []int64{1, 3}, GreetingBy: map[int64]bool{3: true}, Messages: []DirectMessage{{ID: 1, SenderID: 3, Text: "我想和你聊聊", System: true, Status: "delivered", CreatedAt: now.Add(-10 * time.Minute)}}, UpdatedAt: now.Add(-10 * time.Minute)}
		s.PendingQuestions[1] = &PendingQuestion{ID: 1, AccountID: 2, Question: "游泳馆几点关门？", Status: "open", AskCount: 3, CreatedAt: now.Add(-30 * time.Hour)}
	}
	publishedRecently := now.Add(-2 * time.Hour)
	publishedEarlier := now.Add(-72 * time.Hour)
	s.Announcements[1] = &Announcement{ID: 1, Title: "图书馆开放时间调整", Summary: "期末复习期间延长开放时间。", Body: "请同学们合理安排学习计划，具体安排以相关部门正式通知为准。", LinkURL: "https://www.syu.edu.cn/", LinkText: "查看学校官网", Published: true, CreatedAt: publishedRecently, UpdatedAt: publishedRecently, PublishedAt: &publishedRecently}
	s.Announcements[2] = &Announcement{ID: 2, Title: "校园社区内测说明", Summary: "当前处于 100 人内测阶段。", Body: "欢迎通过反馈入口提交建议。", Published: true, CreatedAt: publishedEarlier, UpdatedAt: publishedEarlier, PublishedAt: &publishedEarlier}
	s.Tools[1] = &Tool{ID: 1, Name: "AI 问答", Type: "ai", Icon: "sparkles", Weight: 100, Enabled: true}
	s.Tools[2] = &Tool{ID: 2, Name: "校园地图", Type: "map", Icon: "map", Weight: 90, Enabled: true}
	s.Tools[3] = &Tool{ID: 3, Name: "常用网址", Type: "links", Icon: "link", Weight: 80, Enabled: true}
	if cfg.Env != "prod" {
		s.Providers[1] = &AIProvider{ID: 1, Name: "本地开发模型", Protocol: "openai-compatible", BaseURL: "http://localhost:9000/v1", APIKeyMasked: "••••dev", Model: "campus-demo", Enabled: true, Public: true, FallbackOrder: 1}
	}
	s.KBEntries[1] = &KBEntry{ID: 1, Title: "教务处联系电话", Category: "phone", Content: "教务处本科教学运行科：024-6272 0000（工作日 8:30–16:30）。", Source: "学校官网-机构设置", SourceDate: "2026-06-01", Enabled: true, UpdatedAt: now.Add(-48 * time.Hour)}
	s.KBEntries[2] = &KBEntry{ID: 2, Title: "图书馆开放时间", Category: "notice", Content: "图书馆常规开放时间为 8:00–22:00，期末周延长至 23:00，以官方通知为准。", Source: "学校图书馆公告", SourceDate: "2026-08-20", Enabled: true, UpdatedAt: now.Add(-2 * time.Hour)}
	if err := s.persistLocked(); err != nil {
		if s.strictPersistence {
			panic(err)
		}
		fmt.Printf("[db] initial snapshot failed: %v\n", err)
	}
	return s
}

func (s *Store) next() int64 { s.nextID++; return s.nextID }
func (s *Store) public(id int64) PublicAccount {
	a := s.Accounts[id]
	if a == nil {
		return PublicAccount{}
	}
	out := PublicAccount{ID: a.ID, Nickname: a.Nickname, Avatar: a.Avatar, Gender: a.Gender, Verified: a.Verified}
	// 与客户端契约对齐：认证账号展示蓝 V（org），客户端对空值也按 org 兜底，显示效果一致。
	if a.Verified {
		out.Badge = "org"
	}
	return out
}
func (s *Store) NextID() int64                        { return s.next() }
func (s *Store) PublicAccount(id int64) PublicAccount { return s.public(id) }
func (s *Store) MuLock(fn func()) {
	s.mu.Lock()
	defer s.mu.Unlock()
	fn()
	if err := s.persistLocked(); err != nil {
		if s.strictPersistence {
			panic(err)
		}
		fmt.Printf("[db] persist failed: %v\n", err)
	}
}
func (s *Store) MuRLock(fn func()) { s.mu.RLock(); defer s.mu.RUnlock(); fn() }

func (s *Store) WithLockErr(fn func() error) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := fn(); err != nil {
		return err
	}
	return s.persistLocked()
}

func token() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func (s *Store) NewSession(accountID int64, admin string) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	t := token()
	if admin != "" {
		s.AdminSessions[t] = admin
	} else {
		s.Sessions[t] = accountID
	}
	return t
}

func (s *Store) AccountBySession(t string) (*Account, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	id, ok := s.Sessions[t]
	if !ok {
		return nil, false
	}
	a, ok := s.Accounts[id]
	return a, ok
}

func (s *Store) AdminBySession(t string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	username, ok := s.AdminSessions[t]
	if !ok {
		return "", false
	}
	admin, exists := s.Admins[username]
	if !exists || !admin.Enabled {
		return "", false
	}
	return username, true
}

func (s *Store) AdminLogin(username, password string) (*AdminAccount, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	admin, ok := s.Admins[username]
	if !ok || !admin.Enabled || !security.VerifyPassword(admin.PasswordHash, password) {
		return nil, errors.New("登录名或密码错误")
	}
	copy := *admin
	copy.RoleIDs = append([]int64(nil), admin.RoleIDs...)
	return &copy, nil
}

func (s *Store) AdminAccount(username string) (*AdminAccount, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	admin, ok := s.Admins[username]
	if !ok {
		return nil, false
	}
	copy := *admin
	copy.RoleIDs = append([]int64(nil), admin.RoleIDs...)
	return &copy, true
}

func (s *Store) AdminPermissions(username string) []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.AdminPermissionsUnlocked(username)
}

func (s *Store) AdminPermissionsUnlocked(username string) []string {
	admin := s.Admins[username]
	if admin == nil {
		return []string{}
	}
	if admin.IsSuper {
		return []string{"*"}
	}
	seen := map[string]bool{}
	out := []string{}
	for _, roleID := range admin.RoleIDs {
		role := s.AdminRoles[roleID]
		if role == nil {
			continue
		}
		for _, permission := range role.Permissions {
			if permission != "*" && !seen[permission] {
				seen[permission] = true
				out = append(out, permission)
			}
		}
	}
	sort.Strings(out)
	return out
}

func (s *Store) AdminHasPermission(username, permission string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	admin := s.Admins[username]
	if admin == nil || !admin.Enabled {
		return false
	}
	if admin.IsSuper {
		return true
	}
	for _, item := range s.AdminPermissionsUnlocked(username) {
		if item == permission {
			return true
		}
	}
	return false
}

func (s *Store) InvalidateAdminSessionsUnlocked(username string) {
	for token, sessionUsername := range s.AdminSessions {
		if sessionUsername == username {
			delete(s.AdminSessions, token)
		}
	}
}

func (s *Store) Login(phone, password string) (*Account, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	id, ok := s.Phones[phone]
	if !ok {
		return nil, errors.New("手机号或密码错误")
	}
	a := s.Accounts[id]
	if !security.VerifyPassword(a.PasswordHash, password) {
		return nil, errors.New("手机号或密码错误")
	}
	return a, nil
}

func (s *Store) Register(phone, password, nickname string) (*Account, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.Phones[phone]; ok {
		return nil, errors.New("该手机号已被使用")
	}
	hash, err := security.HashPassword(password)
	if err != nil {
		return nil, err
	}
	id := s.next()
	if nickname == "" {
		nickname = "新同学"
	}
	for _, a := range s.Accounts {
		if a.Nickname == nickname {
			return nil, errors.New("昵称已被使用")
		}
	}
	a := &Account{ID: id, Phone: phone, PasswordHash: hash, Nickname: nickname, Avatar: "新", Status: "active", CreatedAt: time.Now()}
	s.Accounts[id] = a
	s.Phones[phone] = id

	if err := s.persistLocked(); err != nil {
		delete(s.Accounts, id)
		delete(s.Phones, phone)
		return nil, fmt.Errorf("保存账号失败: %w", err)
	}

	return a, nil
}

func (s *Store) ListPosts(query string, mine *int64) []Post {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []Post{}
	for _, p := range s.Posts {
		if mine != nil && p.Author.ID != *mine {
			continue
		}
		if mine == nil && p.Status != "public" {
			continue
		}
		if query != "" && !strings.Contains(strings.ToLower(p.Text+" "+strings.Join(p.Tags, " ")), strings.ToLower(query)) {
			continue
		}
		out = append(out, *p)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Pinned != out[j].Pinned {
			return out[i].Pinned
		}
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	return out
}

func (s *Store) ListPostsUnlocked(query string, mine *int64) []Post {
	out := []Post{}
	for _, p := range s.Posts {
		if mine != nil && p.Author.ID != *mine {
			continue
		}
		if mine == nil && p.Status != "public" {
			continue
		}
		if query != "" && !strings.Contains(strings.ToLower(p.Text+" "+strings.Join(p.Tags, " ")), strings.ToLower(query)) {
			continue
		}
		out = append(out, *p)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Pinned != out[j].Pinned {
			return out[i].Pinned
		}
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	return out
}

func (s *Store) AddAudit(operator, action, target, result, reason, category string) {
	s.AuditLogs = append(s.AuditLogs, AuditLog{ID: s.next(), Operator: operator, Action: action, Target: target, Result: result, Reason: reason, Category: category, CreatedAt: time.Now()})
}

func (s *Store) AddAuditUnlocked(operator, action, target, result, reason, category string) {
	s.AddAudit(operator, action, target, result, reason, category)
}

func (s *Store) ListAllPostsUnlocked(query string) []Post {
	out := []Post{}
	for _, p := range s.Posts {
		if query != "" && !strings.Contains(strings.ToLower(p.Text+" "+strings.Join(p.Tags, " ")), strings.ToLower(query)) {
			continue
		}
		out = append(out, *p)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

func (s *Store) DecoratePosts(posts []Post, viewerID int64) {
	for i := range posts {
		posts[i].Liked = s.PostLikes[posts[i].ID][viewerID]
		posts[i].Bookmarked = s.PostBookmarks[posts[i].ID][viewerID]
	}
}

func (s *Store) ToggleLikeLocked(postID, accountID int64) (liked bool, likes int) {
	set, ok := s.PostLikes[postID]
	if !ok {
		set = map[int64]bool{}
		s.PostLikes[postID] = set
	}
	p := s.Posts[postID]
	if set[accountID] {
		delete(set, accountID)
		if p.Likes > 0 {
			p.Likes--
		}
		return false, p.Likes
	}
	set[accountID] = true
	p.Likes++
	return true, p.Likes
}

func (s *Store) ToggleBookmarkLocked(postID, accountID int64) bool {
	set, ok := s.PostBookmarks[postID]
	if !ok {
		set = map[int64]bool{}
		s.PostBookmarks[postID] = set
	}
	p := s.Posts[postID]
	if set[accountID] {
		delete(set, accountID)
		if p.Bookmarks > 0 {
			p.Bookmarks--
		}
		return false
	}
	set[accountID] = true
	p.Bookmarks++
	return true
}

func (s *Store) BookmarksOfLocked(accountID int64) []Post {
	out := []Post{}
	for postID, set := range s.PostBookmarks {
		if !set[accountID] {
			continue
		}
		if p, ok := s.Posts[postID]; ok && p.Status == "public" {
			out = append(out, *p)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

func (s *Store) MutedLocked(a *Account) bool {
	if a.Status != "muted" {
		return false
	}
	if a.MutedUntil != nil && time.Now().After(*a.MutedUntil) {
		a.Status = "active"
		a.MutedUntil = nil
		for _, p := range s.Punishments {
			if p.AccountID == a.ID && p.Kind == "mute" && p.Status == "active" {
				p.Status = "expired"
			}
		}
		return false
	}
	return true
}

func (s *Store) NotifyLocked(accountID int64, ntype, title, body, refType string, refID int64) {
	if accountID <= 0 {
		return
	}
	id := s.next()
	s.Notifications[id] = &Notification{ID: id, AccountID: accountID, Type: ntype, Title: title, Body: body, RefType: refType, RefID: refID, CreatedAt: time.Now()}
}

func (s *Store) DeleteSession(t string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.Sessions, t)
}

// ========== 数据库持久化方法 ==========

func (s *Store) snapshot() storeSnapshot {
	snap := storeSnapshot{
		NextID: s.nextID, Sessions: s.Sessions, Accounts: s.Accounts, Phones: s.Phones, Posts: s.Posts,
		Comments: s.Comments, Verifications: s.Verifications, Announcements: s.Announcements,
		Tools: s.Tools, Providers: s.Providers, AIConversations: s.AIConversations,
		DirectConversations: s.DirectConversations, AuditLogs: s.AuditLogs, Admins: s.Admins,
		AdminRoles: s.AdminRoles, Reports: s.Reports, KBEntries: s.KBEntries,
		PendingQuestions: s.PendingQuestions, Settings: s.Settings, PostLikes: s.PostLikes,
		PostBookmarks: s.PostBookmarks, Notifications: s.Notifications,
		Punishments: s.Punishments, Appeals: s.Appeals,
		AccountPasswordHashes: map[int64]string{}, AdminPasswordHashes: map[string]string{},
		ProviderAPIKeys: map[int64]string{}, DirectGreetingBy: map[int64]map[int64]bool{},
		ReportReporterIDs: map[int64]int64{}, NotificationAccountIDs: map[int64]int64{},
	}
	for id, item := range s.Accounts {
		snap.AccountPasswordHashes[id] = item.PasswordHash
	}
	for username, item := range s.Admins {
		snap.AdminPasswordHashes[username] = item.PasswordHash
	}
	for id, item := range s.Providers {
		snap.ProviderAPIKeys[id] = item.APIKey
	}
	for id, item := range s.DirectConversations {
		snap.DirectGreetingBy[id] = item.GreetingBy
	}
	for id, item := range s.Reports {
		snap.ReportReporterIDs[id] = item.ReporterID
	}
	for id, item := range s.Notifications {
		snap.NotificationAccountIDs[id] = item.AccountID
	}
	return snap
}

func (s *Store) persistLocked() error {
	if s.db == nil {
		return nil
	}
	payload, err := json.Marshal(s.snapshot())
	if err != nil {
		return fmt.Errorf("encode snapshot: %w", err)
	}
	row := DBStoreSnapshot{ID: 1, Payload: string(payload)}
	if err := s.db.Save(&row).Error; err != nil {
		return fmt.Errorf("write snapshot: %w", err)
	}
	return nil
}

func (s *Store) loadSnapshot() (bool, error) {
	if s.db == nil {
		return false, nil
	}
	var row DBStoreSnapshot
	if err := s.db.First(&row, 1).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, fmt.Errorf("load snapshot: %w", err)
	}
	var snap storeSnapshot
	if err := json.Unmarshal([]byte(row.Payload), &snap); err != nil {
		return false, fmt.Errorf("decode snapshot: %w", err)
	}
	s.nextID = snap.NextID
	if snap.Sessions != nil {
		s.Sessions = snap.Sessions
	}
	s.Accounts, s.Phones, s.Posts, s.Comments = snap.Accounts, snap.Phones, snap.Posts, snap.Comments
	s.Verifications, s.Announcements, s.Tools = snap.Verifications, snap.Announcements, snap.Tools
	s.Providers, s.AIConversations = snap.Providers, snap.AIConversations
	s.DirectConversations, s.AuditLogs = snap.DirectConversations, snap.AuditLogs
	s.Admins, s.AdminRoles = snap.Admins, snap.AdminRoles
	s.Reports, s.KBEntries, s.PendingQuestions = snap.Reports, snap.KBEntries, snap.PendingQuestions
	s.Settings, s.PostLikes, s.PostBookmarks = snap.Settings, snap.PostLikes, snap.PostBookmarks
	s.Notifications, s.Punishments, s.Appeals = snap.Notifications, snap.Punishments, snap.Appeals
	s.ensureMaps()
	for id, value := range snap.AccountPasswordHashes {
		if s.Accounts[id] != nil {
			s.Accounts[id].PasswordHash = value
		}
	}
	for username, value := range snap.AdminPasswordHashes {
		if s.Admins[username] != nil {
			s.Admins[username].PasswordHash = value
		}
	}
	for id, value := range snap.ProviderAPIKeys {
		if s.Providers[id] != nil {
			s.Providers[id].APIKey = value
		}
	}
	for id, value := range snap.DirectGreetingBy {
		if s.DirectConversations[id] != nil {
			s.DirectConversations[id].GreetingBy = value
		}
	}
	for id, value := range snap.ReportReporterIDs {
		if s.Reports[id] != nil {
			s.Reports[id].ReporterID = value
		}
	}
	for id, value := range snap.NotificationAccountIDs {
		if s.Notifications[id] != nil {
			s.Notifications[id].AccountID = value
		}
	}
	return true, nil
}

func (s *Store) ensureMaps() {
	if s.Accounts == nil {
		s.Accounts = map[int64]*Account{}
	}
	if s.Phones == nil {
		s.Phones = map[string]int64{}
	}
	if s.Posts == nil {
		s.Posts = map[int64]*Post{}
	}
	if s.Comments == nil {
		s.Comments = map[int64]*Comment{}
	}
	if s.Verifications == nil {
		s.Verifications = map[int64]*Verification{}
	}
	if s.Announcements == nil {
		s.Announcements = map[int64]*Announcement{}
	}
	if s.Tools == nil {
		s.Tools = map[int64]*Tool{}
	}
	if s.Providers == nil {
		s.Providers = map[int64]*AIProvider{}
	}
	if s.AIConversations == nil {
		s.AIConversations = map[int64]*Conversation{}
	}
	if s.DirectConversations == nil {
		s.DirectConversations = map[int64]*DirectConversation{}
	}
	if s.Admins == nil {
		s.Admins = map[string]*AdminAccount{}
	}
	if s.AdminRoles == nil {
		s.AdminRoles = map[int64]*AdminRole{}
	}
	if s.Reports == nil {
		s.Reports = map[int64]*Report{}
	}
	if s.KBEntries == nil {
		s.KBEntries = map[int64]*KBEntry{}
	}
	if s.PendingQuestions == nil {
		s.PendingQuestions = map[int64]*PendingQuestion{}
	}
	if s.PostLikes == nil {
		s.PostLikes = map[int64]map[int64]bool{}
	}
	if s.PostBookmarks == nil {
		s.PostBookmarks = map[int64]map[int64]bool{}
	}
	if s.Notifications == nil {
		s.Notifications = map[int64]*Notification{}
	}
	if s.Punishments == nil {
		s.Punishments = map[int64]*Punishment{}
	}
	if s.Appeals == nil {
		s.Appeals = map[int64]*Appeal{}
	}
}

func (s *Store) loadFromDB() {
	if s.db == nil {
		return
	}

	var dbAccounts []DBAccount
	if err := s.db.Find(&dbAccounts).Error; err != nil {
		fmt.Printf("[db] load accounts failed: %v\n", err)
		return
	}
	for _, dba := range dbAccounts {
		s.Accounts[dba.ID] = &Account{
			ID: dba.ID, Phone: dba.Phone, PasswordHash: dba.PasswordHash,
			Nickname: dba.Nickname, Avatar: "新", Status: dba.Status,
			CreatedAt: time.Unix(dba.CreatedAt, 0),
		}
		s.Phones[dba.Phone] = dba.ID
		if dba.ID >= s.nextID {
			s.nextID = dba.ID
		}
	}

	var dbPosts []DBPost
	if err := s.db.Find(&dbPosts).Error; err != nil {
		fmt.Printf("[db] load posts failed: %v\n", err)
		return
	}
	for _, dbp := range dbPosts {
		var images, tags []string
		json.Unmarshal([]byte(dbp.Images), &images)
		json.Unmarshal([]byte(dbp.Tags), &tags)
		author := s.public(dbp.AuthorID)
		if author.ID == 0 {
			author = PublicAccount{ID: dbp.AuthorID, Nickname: "未知用户", Avatar: "?"}
		}
		s.Posts[dbp.ID] = &Post{
			ID: dbp.ID, Author: author, Text: dbp.Text,
			Images: images, Tags: tags, Status: dbp.Status,
			Pinned: dbp.Pinned, Likes: dbp.Likes, Comments: dbp.Comments,
			Bookmarks: dbp.Bookmarks,
			CreatedAt: time.Unix(dbp.CreatedAt, 0),
			UpdatedAt: time.Unix(dbp.UpdatedAt, 0),
		}
		if dbp.ID >= s.nextID {
			s.nextID = dbp.ID
		}
	}

	s.nextID++ // 确保 nextID 比所有已有 ID 大
}
