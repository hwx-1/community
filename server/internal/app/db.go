package app

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ConnectDB 连接 PostgreSQL，失败返回 nil 不报错（保持内存模式兼容）。
func ConnectDB(dsn string) *gorm.DB {
	if dsn == "" {
		return nil
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		fmt.Printf("[db] connect failed: %v, falling back to memory store\n", err)
		return nil
	}
	return db
}

// Migrate 自动创建或更新数据库表。
func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&DBAccount{},
		&DBProfile{},
		&DBPost{},
		&DBComment{},
		&DBAdminAccount{},
		&DBRole{},
		&DBPermission{},
		&DBAdminAuditLog{},
		&DBStudentVerification{},
		&DBStudentBinding{},
	)
}

// ========== GORM 模型 ==========

type DBAccount struct {
	ID           int64  `gorm:"primaryKey"`
	Phone        string `gorm:"uniqueIndex;not null"`
	PasswordHash string `gorm:"not null"`
	Nickname     string `gorm:"uniqueIndex;not null"`
	Status       string `gorm:"default:'active'"`
	CreatedAt    int64  `gorm:"autoCreateTime"`
	UpdatedAt    int64  `gorm:"autoUpdateTime"`
}

type DBProfile struct {
	AccountID  int64  `gorm:"primaryKey"`
	AvatarURL  string
	Gender     string
	RealName   string
	StudentNo  string
	ClassName  string
	ProfileDone bool `gorm:"default:false"`
}

type DBPost struct {
	ID        int64  `gorm:"primaryKey"`
	AuthorID  int64  `gorm:"index"`
	Text      string `gorm:"type:text"`
	Images    string `gorm:"type:text"` // JSON array
	Tags      string `gorm:"type:text"` // JSON array
	Status    string `gorm:"default:'pending'"`
	Pinned    bool   `gorm:"default:false"`
	Likes     int    `gorm:"default:0"`
	Comments  int    `gorm:"default:0"`
	Bookmarks int    `gorm:"default:0"`
	CreatedAt int64  `gorm:"autoCreateTime"`
	UpdatedAt int64  `gorm:"autoUpdateTime"`
}

type DBComment struct {
	ID        int64  `gorm:"primaryKey"`
	PostID    int64  `gorm:"index"`
	ParentID  *int64
	AuthorID  int64  `gorm:"index"`
	Text      string `gorm:"type:text"`
	Image     string
	Status    string `gorm:"default:'pending'"`
	Deleted   bool   `gorm:"default:false"`
	CreatedAt int64  `gorm:"autoCreateTime"`
}

type DBAdminAccount struct {
	ID           int64  `gorm:"primaryKey"`
	Username     string `gorm:"uniqueIndex;not null"`
	PasswordHash string `gorm:"not null"`
	IsSuper      bool   `gorm:"default:false"`
	Enabled      bool   `gorm:"default:true"`
	CreatedAt    int64  `gorm:"autoCreateTime"`
	UpdatedAt    int64  `gorm:"autoUpdateTime"`
}

type DBRole struct {
	ID        int64  `gorm:"primaryKey"`
	Name      string `gorm:"uniqueIndex;not null"`
	Protected bool   `gorm:"default:false"`
	CreatedAt int64  `gorm:"autoCreateTime"`
	UpdatedAt int64  `gorm:"autoUpdateTime"`
}

type DBPermission struct {
	ID   int64  `gorm:"primaryKey"`
	Code string `gorm:"uniqueIndex;not null"`
}

type DBAdminAuditLog struct {
	ID         int64  `gorm:"primaryKey"`
	OperatorID int64  `gorm:"index"`
	Action     string `gorm:"not null"`
	TargetType string
	TargetID   string
	Result     string
	Reason     string
	RequestID  string
	CreatedAt  int64 `gorm:"autoCreateTime"`
}

type DBStudentVerification struct {
	ID           int64  `gorm:"primaryKey"`
	AccountID    int64  `gorm:"index;not null"`
	Status       string `gorm:"default:'pending'"`
	MaterialURL  string
	RejectReason string
	ReviewedBy   *int64
	ReviewedAt   *int64
	CreatedAt    int64 `gorm:"autoCreateTime"`
}

type DBStudentBinding struct {
	StudentNo string `gorm:"primaryKey"`
	AccountID int64  `gorm:"uniqueIndex;not null"`
	BoundBy   int64  `gorm:"not null"`
	Reason    string
	BoundAt   int64 `gorm:"autoCreateTime"`
}
