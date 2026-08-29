package api

import (
	"crypto/rand"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xsnbb/server/internal/app"
	"github.com/xsnbb/server/internal/security"
)

func hashPassword(password string) (string, error) { return security.HashPassword(password) }

const (
	smsInterval  = 120 * time.Second // 同一手机号两次发送最小间隔
	smsTTL       = 5 * time.Minute   // 验证码有效期
	smsMaxTrials = 3                 // 累计输错次数上限
)

func smsKey(purpose, phone string) string { return purpose + ":" + phone }

func validPhone(p string) bool {
	if len(p) != 11 || p[0] != '1' {
		return false
	}
	for _, r := range p {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func newSMSCode() string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	n := int(b[0])<<24 | int(b[1])<<16 | int(b[2])<<8 | int(b[3])
	return fmt.Sprintf("%06d", n%1000000)
}

// requestSMSCode 发送短信验证码。开发模式下验证码直接随响应返回并显式标记 dev_mode。
func (a *API) requestSMSCode(c *gin.Context) {
	var in struct {
		Phone   string `json:"phone"`
		Purpose string `json:"purpose"` // register / reset
	}
	if c.ShouldBindJSON(&in) != nil || !validPhone(in.Phone) || (in.Purpose != "register" && in.Purpose != "reset") {
		fail(c, 422, "SMS_REQUEST_INVALID", "手机号或用途不正确")
		return
	}
	key := smsKey(in.Purpose, in.Phone)
	code := newSMSCode()
	var dev bool
	err := a.store.WithLockErr(func() error {
		if prev, ok := a.store.SMSCodes[key]; ok && time.Since(prev.LastSent) < smsInterval {
			return errors.New("interval")
		}
		a.store.SMSCodes[key] = &app.SMSCode{Code: code, Purpose: in.Purpose, ExpiresAt: time.Now().Add(smsTTL), LastSent: time.Now()}
		return nil
	})
	if err != nil {
		fail(c, 429, "SMS_TOO_FREQUENT", "发送过于频繁，请 120 秒后再试")
		return
	}
	if err := a.adapters.SMS.Send(c.Request.Context(), in.Phone, code); err != nil {
		// 配置了真实供应商但调用未接入/失败：明确报错，不伪装成功
		fail(c, 502, "SMS_PROVIDER_ERROR", err.Error())
		return
	}
	dev = a.adapters.SMS.DevMode()
	resp := gin.H{"sent": true, "dev_mode": dev, "expires_in": int(smsTTL.Seconds())}
	if dev {
		resp["dev_code"] = code // 仅开发模式下发，便于本地联调
	}
	c.JSON(http.StatusOK, resp)
}

// verifySMSCodeLocked 校验验证码：有效期、错误次数上限、一次性使用。
// 调用方必须已持有 store 写锁。
func (a *API) verifySMSCodeLocked(purpose, phone, code string) error {
	key := smsKey(purpose, phone)
	entry, ok := a.store.SMSCodes[key]
	if !ok || time.Now().After(entry.ExpiresAt) {
		return errors.New("验证码已过期，请重新获取")
	}
	if entry.Attempts >= smsMaxTrials {
		return errors.New("验证码已失效，请重新获取")
	}
	if entry.Code != code {
		entry.Attempts++
		return errors.New("验证码错误")
	}
	delete(a.store.SMSCodes, key) // 一次性使用
	return nil
}

// resetPassword 已绑定手机号的账号通过短信验证码重置密码。
func (a *API) resetPassword(c *gin.Context) {
	var in struct {
		Phone    string `json:"phone"`
		Code     string `json:"code"`
		Password string `json:"password"`
	}
	if c.ShouldBindJSON(&in) != nil || !validPhone(in.Phone) || len(in.Password) < 8 {
		fail(c, 422, "RESET_INVALID", "请填写手机号、验证码和至少 8 位新密码")
		return
	}
	err := a.store.WithLockErr(func() error {
		if err := a.verifySMSCodeLocked("reset", in.Phone, in.Code); err != nil {
			return err
		}
		id, ok := a.store.Phones[in.Phone]
		if !ok {
			return errors.New("该手机号未绑定账号")
		}
		hash, err := hashPassword(in.Password)
		if err != nil {
			return err
		}
		a.store.Accounts[id].PasswordHash = hash
		return nil
	})
	if err != nil {
		fail(c, 422, "RESET_FAILED", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"reset": true})
}
