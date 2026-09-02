package adapters

import (
	"context"
	"fmt"

	openapi "github.com/alibabacloud-go/darabonba-openapi/v2/client"
	dypnsapi "github.com/alibabacloud-go/dypnsapi-20170525/v2/client"
	"github.com/alibabacloud-go/tea/tea"
)

// aliyunSMS 阿里云号码认证服务（dypnsapi 2017-05-25）真实实现。
//
// 使用 SendSmsVerifyCode 的「用户自生成验证码」模式：验证码由本服务生成、存储和校验
// （有效期 / 试错上限 / 一次性使用均在本服务强制执行），阿里云只负责下发短信。
//
// 签名与模板必须使用号码认证控制台的「赠送签名 / 赠送模板」（该产品不支持自定义签名）。
// TemplateParam 的变量名（code / min）必须与控制台所选赠送模板的变量名一致；
// 其中 min 固定为 5，与本服务 smsTTL = 5 分钟对应。模板变量名不同需同步修改此处。
type aliyunSMS struct {
	client   *dypnsapi.Client
	sign     string
	template string
}

func newAliyunSMS(accessKeyID, accessKeySecret, sign, template string) (*aliyunSMS, error) {
	cfg := &openapi.Config{
		AccessKeyId:     tea.String(accessKeyID),
		AccessKeySecret: tea.String(accessKeySecret),
		Endpoint:        tea.String("dypnsapi.aliyuncs.com"),
	}
	c, err := dypnsapi.NewClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("初始化号码认证客户端失败: %w", err)
	}
	return &aliyunSMS{client: c, sign: sign, template: template}, nil
}

func (a *aliyunSMS) Send(_ context.Context, phone, code string) error {
	resp, err := a.client.SendSmsVerifyCode(&dypnsapi.SendSmsVerifyCodeRequest{
		PhoneNumber:   tea.String(phone),
		SignName:      tea.String(a.sign),
		TemplateCode:  tea.String(a.template),
		TemplateParam: tea.String(fmt.Sprintf(`{"code":"%s","min":"5"}`, code)),
		// 自生成验证码模式下 CodeType 不生效；频控间隔与本服务 smsInterval = 120 秒对齐
		Interval: tea.Int64(120),
	})
	if err != nil {
		return fmt.Errorf("号码认证短信发送失败: %w", err)
	}
	if resp == nil || resp.Body == nil || resp.Body.Code == nil {
		return fmt.Errorf("号码认证返回空响应")
	}
	if tea.StringValue(resp.Body.Code) != "OK" {
		return fmt.Errorf("号码认证短信被拒绝: %s (%s)",
			tea.StringValue(resp.Body.Message), tea.StringValue(resp.Body.Code))
	}
	return nil
}

func (a *aliyunSMS) DevMode() bool { return false }
