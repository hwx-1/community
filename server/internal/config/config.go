package config

import (
	"bufio"
	"os"
	"strings"
)

// Config 聚合服务运行所需的全部配置，全部来自环境变量，
// 密钥不进入前端产物，也不写入日志。
type Config struct {
	Env      string // dev / prod
	HTTPAddr string // API 监听地址

	DatabaseURL string // PostgreSQL 连接串
	RedisAddr   string // Redis 地址

	// Session 配置
	SessionSecret      string
	CookieSecure       bool // 生产环境必须为 true（Secure Cookie）
	InviteCode         string
	SuperAdminUser     string
	SuperAdminPassword string
	WebOrigin          string
	AdminOrigin        string

	// 外部服务适配器配置：留空即落入开发模式实现，
	// 开发模式结果会显式标记 dev_mode，不伪装成真实供应商调用。
	SMSAccessKey  string // 阿里云短信 AccessKey
	SMSSecret     string // 阿里云短信 Secret
	SMSSignName   string // 短信签名（个人资质 + 中性品牌 xsnbb）
	SMSTemplate   string // 短信模板编号
	OSSAccessKey  string
	OSSSecret     string
	OSSEndpoint   string
	OSSBucket     string
	UploadDir     string // 开发模式本地存储目录
	WebDist       string // 社区 Web 构建产物目录（存在则由本服务托管）
	AdminDist     string // 管理后台构建产物目录（挂载在 /admin/）
	SearchBaseURL string // 独立联网检索服务
	SearchAPIKey  string

	BannedWords []string // 开发模式内容审核演示违禁词
}

func Load() *Config {
	loadDotEnv(".env") // 本地开发可选；已存在的环境变量优先，不覆盖
	return &Config{
		Env:                getenv("APP_ENV", "dev"),
		HTTPAddr:           getenv("HTTP_ADDR", ":8080"),
		DatabaseURL:        getenv("DATABASE_URL", "postgres://xsnbb:xsnbb@localhost:5432/xsnbb?sslmode=disable"),
		RedisAddr:          getenv("REDIS_ADDR", "localhost:6379"),
		SessionSecret:      getenv("SESSION_SECRET", "dev-secret-change-me"),
		CookieSecure:       getenv("APP_ENV", "dev") == "prod",
		InviteCode:         getenv("INVITE_CODE", "xsnbb-test"),
		SuperAdminUser:     getenv("SUPER_ADMIN_USER", "admin"),
		SuperAdminPassword: getenv("SUPER_ADMIN_PASSWORD", "Admin12345"),
		WebOrigin:          getenv("WEB_ORIGIN", "http://localhost:5173"),
		AdminOrigin:        getenv("ADMIN_ORIGIN", "http://localhost:5174"),
		SMSAccessKey:       getenv("SMS_ACCESS_KEY", ""),
		SMSSecret:          getenv("SMS_SECRET", ""),
		SMSSignName:        getenv("SMS_SIGN_NAME", ""),
		SMSTemplate:        getenv("SMS_TEMPLATE", ""),
		OSSAccessKey:       getenv("OSS_ACCESS_KEY", ""),
		OSSSecret:          getenv("OSS_SECRET", ""),
		OSSEndpoint:        getenv("OSS_ENDPOINT", ""),
		OSSBucket:          getenv("OSS_BUCKET", ""),
		UploadDir:          getenv("UPLOAD_DIR", "uploads"),
		WebDist:            getenv("WEB_DIST", "../apps/web/dist"),
		AdminDist:          getenv("ADMIN_DIST", "../apps/admin/dist"),
		SearchBaseURL:      getenv("SEARCH_BASE_URL", ""),
		SearchAPIKey:       getenv("SEARCH_API_KEY", ""),
		BannedWords:        splitWords(getenv("BANNED_WORDS", "代考,枪手,赌博,诈骗")),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// loadDotEnv 读取 KEY=VALUE 形式的本地配置文件；文件不存在时静默跳过。
// 不覆盖已设置的环境变量，便于部署环境注入真实配置。
func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		if key == "" || os.Getenv(key) != "" {
			continue
		}
		_ = os.Setenv(key, strings.TrimSpace(value))
	}
}

func splitWords(v string) []string {
	out := []string{}
	for _, w := range strings.Split(v, ",") {
		if w = strings.TrimSpace(w); w != "" {
			out = append(out, w)
		}
	}
	return out
}
