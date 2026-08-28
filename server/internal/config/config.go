package config

import (
	"os"
)

// Config 聚合服务运行所需的全部配置，全部来自环境变量，
// 密钥不进入前端产物，也不写入日志。
type Config struct {
	Env      string // dev / prod
	HTTPAddr string // API 监听地址

	DatabaseURL string // PostgreSQL 连接串
	RedisAddr   string // Redis 地址

	// Session 配置
	SessionSecret string
	CookieSecure  bool // 生产环境必须为 true（Secure Cookie）
}

func Load() *Config {
	return &Config{
		Env:           getenv("APP_ENV", "dev"),
		HTTPAddr:      getenv("HTTP_ADDR", ":8080"),
		DatabaseURL:   getenv("DATABASE_URL", "postgres://xsnbb:xsnbb@localhost:5432/xsnbb?sslmode=disable"),
		RedisAddr:     getenv("REDIS_ADDR", "localhost:6379"),
		SessionSecret: getenv("SESSION_SECRET", "dev-secret-change-me"),
		CookieSecure:  getenv("APP_ENV", "dev") == "prod",
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
