package app

import "time"

// AdminAccount 独立于社区账号。只有种子超级管理员拥有 IsSuper；
// 其他管理员通过 RoleIDs 聚合权限，不因学生认证获得后台权限。
type AdminAccount struct {
	ID           int64     `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	IsSuper      bool      `json:"is_super"`
	RoleIDs      []int64   `json:"role_ids"`
	Enabled      bool      `json:"enabled"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type AdminRole struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Permissions []string  `json:"permissions"`
	Protected   bool      `json:"protected"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Account struct {
	ID           int64      `json:"id"`
	Phone        string     `json:"phone,omitempty"`
	PasswordHash string     `json:"-"`
	Nickname     string     `json:"nickname"`
	Avatar       string     `json:"avatar"`
	Gender       string     `json:"gender,omitempty"`
	RealName     string     `json:"real_name,omitempty"`
	StudentNo    string     `json:"student_no,omitempty"`
	ClassName    string     `json:"class_name,omitempty"`
	ProfileDone  bool       `json:"profile_done"`
	Verified     bool       `json:"verified"`
	Status       string     `json:"status"` // active / muted / banned / deactivated
	MutedUntil   *time.Time `json:"muted_until,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

type PublicAccount struct {
	ID       int64  `json:"id"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
	Gender   string `json:"gender"`
	Verified bool   `json:"verified"`
}

type Post struct {
	ID         int64         `json:"id"`
	Author     PublicAccount `json:"author"`
	Text       string        `json:"text"`
	Images     []string      `json:"images"`
	Tags       []string      `json:"tags"`
	Status     string        `json:"status"`
	Pinned     bool          `json:"pinned"`
	Likes      int           `json:"likes"`
	Comments   int           `json:"comments"`
	Bookmarks  int           `json:"bookmarks"`
	Liked      bool          `json:"liked"`
	Bookmarked bool          `json:"bookmarked"`
	CreatedAt  time.Time     `json:"created_at"`
	UpdatedAt  time.Time     `json:"updated_at"`
}

type Comment struct {
	ID        int64         `json:"id"`
	PostID    int64         `json:"post_id"`
	ParentID  *int64        `json:"parent_id,omitempty"`
	Author    PublicAccount `json:"author"`
	Text      string        `json:"text"`
	Image     string        `json:"image,omitempty"`
	Status    string        `json:"status"`
	Deleted   bool          `json:"deleted"`
	CreatedAt time.Time     `json:"created_at"`
}

type Verification struct {
	ID           int64     `json:"id"`
	AccountID    int64     `json:"account_id"`
	Nickname     string    `json:"nickname"`
	RealName     string    `json:"real_name"`
	StudentNo    string    `json:"student_no"`
	MaterialURL  string    `json:"material_url"`
	Status       string    `json:"status"`
	RejectReason string    `json:"reject_reason,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

type Announcement struct {
	ID          int64      `json:"id"`
	Title       string     `json:"title"`
	Summary     string     `json:"summary"`
	Body        string     `json:"body"`
	ImageURL    string     `json:"image_url,omitempty"`
	LinkURL     string     `json:"link_url,omitempty"`
	LinkText    string     `json:"link_text,omitempty"`
	Published   bool       `json:"published"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	PublishedAt *time.Time `json:"published_at,omitempty"`
}
type Tool struct {
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	Type    string `json:"type"`
	Icon    string `json:"icon"`
	URL     string `json:"url,omitempty"`
	Weight  int    `json:"weight"`
	Enabled bool   `json:"enabled"`
}
type AIProvider struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	Protocol      string `json:"protocol"`
	BaseURL       string `json:"base_url"`
	APIKey        string `json:"-"` // 真实密钥仅供服务端调用供应商使用，任何接口都不得序列化输出
	APIKeyMasked  string `json:"api_key_masked"`
	Model         string `json:"model"`
	Enabled       bool   `json:"enabled"`
	Public        bool   `json:"public"`
	FallbackOrder int    `json:"fallback_order"`
}
type Conversation struct {
	ID        int64       `json:"id"`
	OwnerID   int64       `json:"owner_id"`
	Title     string      `json:"title"`
	Model     string      `json:"model"`
	Messages  []AIMessage `json:"messages"`
	CreatedAt time.Time   `json:"created_at"`
}
type AIMessage struct {
	ID        int64     `json:"id"`
	Role      string    `json:"role"`
	Text      string    `json:"text"`
	Model     string    `json:"model,omitempty"`
	Source    string    `json:"source,omitempty"`
	// NeedsFeedback 为 true 表示这是知识库直接命中的答案，等待用户确认
	// 「这个答案是你想要的吗？」；确认后清零并记录 Feedback（"yes"/"no"）。
	NeedsFeedback bool      `json:"needs_feedback,omitempty"`
	Feedback      string    `json:"feedback,omitempty"`
	// RetryOf 非零表示这是对消息 RetryOf 的「不满意重答」：
	// 知识库答错后的补救不应再扣当日额度，额度统计会跳过此类消息。
	RetryOf int64 `json:"retry_of,omitempty"`
	// KBEntryID 非零表示该答案直接引用了对应知识库条目，
	// 用户点「否」时据此给条目累计差评。
	KBEntryID int64     `json:"kb_entry_id,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}
type DirectConversation struct {
	ID         int64           `json:"id"`
	MemberIDs  []int64         `json:"member_ids"`
	GreetingBy map[int64]bool  `json:"-"`
	Messages   []DirectMessage `json:"messages"`
	UpdatedAt  time.Time       `json:"updated_at"`
}
type DirectMessage struct {
	ID        int64     `json:"id"`
	SenderID  int64     `json:"sender_id"`
	Text      string    `json:"text"`
	System    bool      `json:"system"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}
type AuditLog struct {
	ID        int64     `json:"id"`
	Operator  string    `json:"operator"`
	Action    string    `json:"action"`
	Target    string    `json:"target"`
	Result    string    `json:"result"`
	Reason    string    `json:"reason,omitempty"`
	Category  string    `json:"category"`
	CreatedAt time.Time `json:"created_at"`
}

// Report 举报：帖子 / 评论 / 私信共用一张表，举报人身份仅超管可见。
type Report struct {
	ID         int64      `json:"id"`
	ReporterID int64      `json:"-"`           // 不向普通接口泄露举报人
	TargetType string     `json:"target_type"` // post / comment / dm
	TargetID   int64      `json:"target_id"`
	Reason     string     `json:"reason"`
	Status     string     `json:"status"` // pending / dismissed / actioned
	Result     string     `json:"result,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	ResolvedAt *time.Time `json:"resolved_at,omitempty"`
}

// KBEntry 校内知识库：部门电话、官方通知等人工维护资料。
type KBEntry struct {
	ID         int64     `json:"id"`
	Title      string    `json:"title"`
	Category   string    `json:"category"` // phone / notice / faq
	Content    string    `json:"content"`
	Source     string    `json:"source"`      // 来源说明，如「学校官网-校长办公室」
	SourceDate string    `json:"source_date"` // 来源发布日期
	Enabled    bool      `json:"enabled"`
	// Dislikes 用户在答案确认中点「否」的次数，用于后台发现质量不佳的条目；
	// LastDislikeAt 最近一次被点「否」的时间。
	Dislikes      int        `json:"dislikes"`
	LastDislikeAt *time.Time `json:"last_dislike_at,omitempty"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// PendingQuestion AI 未能回答、等待管理员补充的问题。
type PendingQuestion struct {
	ID         int64      `json:"id"`
	AccountID  int64      `json:"account_id"`
	Question   string     `json:"question"`
	Status     string     `json:"status"` // open / answered / withdrawn
	Answer     string     `json:"answer,omitempty"`
	AskCount   int        `json:"ask_count"` // 相似问题合并计数
	CreatedAt  time.Time  `json:"created_at"`
	AnsweredAt *time.Time `json:"answered_at,omitempty"`
}

// Settings 运营配置：内置招呼文案、热门话题等超管手配项。
type Settings struct {
	Greeting  string   `json:"greeting"`   // 私信首次联系内置文案
	HotTopics []string `json:"hot_topics"` // 热门话题（手动配置的标签及顺序）
}

// SMSCode 短信验证码状态：120 秒间隔、5 分钟有效、3 次错误失效。
type SMSCode struct {
	Code      string
	Purpose   string // register / reset
	ExpiresAt time.Time
	Attempts  int
	LastSent  time.Time
}

// Notification 消息页通知：点赞 / 评论 / 回复 / 举报结果 / 官方回答 / 处罚 / 申诉结果。
type Notification struct {
	ID        int64     `json:"id"`
	AccountID int64     `json:"-"`
	Type      string    `json:"type"` // like / comment / reply / report_result / official_answer / punishment / appeal_result
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	RefType   string    `json:"ref_type,omitempty"`
	RefID     int64     `json:"ref_id,omitempty"`
	Read      bool      `json:"read"`
	CreatedAt time.Time `json:"created_at"`
}

// Punishment 账号处罚：禁言固定档位（1/3/7 天），封号永久。每次处罚只允许申诉一次。
type Punishment struct {
	ID        int64      `json:"id"`
	AccountID int64      `json:"account_id"`
	Kind      string     `json:"kind"` // mute / ban
	MuteDays  int        `json:"mute_days,omitempty"`
	Reason    string     `json:"reason"`
	Status    string     `json:"status"` // active / lifted / expired
	CreatedAt time.Time  `json:"created_at"`
	EndsAt    *time.Time `json:"ends_at,omitempty"`
}

// Appeal 申诉：针对一次处罚只能提交一次，管理员 7 天内处理（超时保持待审）。
type Appeal struct {
	ID           int64      `json:"id"`
	PunishmentID int64      `json:"punishment_id"`
	AccountID    int64      `json:"account_id"`
	Kind         string     `json:"kind"` // 冗余处罚类型，便于列表展示
	Reason       string     `json:"reason"`
	Status       string     `json:"status"` // pending / upheld / lifted
	Result       string     `json:"result,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	ResolvedAt   *time.Time `json:"resolved_at,omitempty"`
}
