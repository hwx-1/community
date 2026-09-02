package adapters

import (
	"context"
	"encoding/json"
	"fmt"

	openapi "github.com/alibabacloud-go/darabonba-openapi/v2/client"
	dysmsapi "github.com/alibabacloud-go/dysmsapi-20170525/v5/client"
	"github.com/alibabacloud-go/tea/tea"
)

// aliyunSMS 阿里云短信真实实现（dysmsapi 2017-05-25）。
// 模板变量名固定为 code（模板内容形如：您的验证码为${code}，5 分钟内有效）。
// 若控制台模板变量名不同，需要同步修改这里。
type aliyunSMS struct {
	client   *dysmsapi.Client
	sign     string
	template string
}

func newAliyunSMS(accessKeyID, accessKeySecret, sign, template string) (*aliyunSMS, error) {
	cfg := &openapi.Config{
		AccessKeyId:     tea.String(accessKeyID),
		AccessKeySecret: tea.String(accessKeySecret),
		Endpoint:        tea.String("dysmsapi.aliyuncs.com"),
	}
	c, err := dysmsapi.NewClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("初始化阿里云短信客户端失败: %w", err)
	}
	return &aliyunSMS{client: c, sign: sign, template: template}, nil
}

func (a *aliyunSMS) Send(_ context.Context, phone, code string) error {
	param, _ := json.Marshal(map[string]string{"code": code})
	resp, err := a.client.SendSms(&dysmsapi.SendSmsRequest{
		PhoneNumbers:  tea.String(phone),
		SignName:      tea.String(a.sign),
		TemplateCode:  tea.String(a.template),
		TemplateParam: tea.String(string(param)),
	})
	if err != nil {
		return fmt.Errorf("阿里云短信发送失败: %w", err)
	}
	if resp == nil || resp.Body == nil || resp.Body.Code == nil {
		return fmt.Errorf("阿里云短信返回空响应")
	}
	if tea.StringValue(resp.Body.Code) != "OK" {
		return fmt.Errorf("阿里云短信被拒绝: %s (%s)",
			tea.StringValue(resp.Body.Message), tea.StringValue(resp.Body.Code))
	}
	return nil
}

func (a *aliyunSMS) DevMode() bool { return false }
