import { Api } from '../service/Api';
import { ApiError } from '../service/Http';
import { Session } from '../service/Session';
import { AppColors } from '../constants/AppConfig';
import { RegisterBody } from '../model/Types';

@Component
export struct RegisterPage {
  @Consume('navStack') navStack: NavPathStack;
  @State phone: string = '';
  @State code: string = '';
  @State password: string = '';
  @State nickname: string = '';
  @State inviteCode: string = '';
  @State sending: boolean = false;
  @State submitting: boolean = false;
  @State countdown: number = 0;
  @State devCodeTip: string = '';

  private get canSendCode(): boolean {
    return this.phone.length === 11 && !this.sending && this.countdown === 0;
  }

  private get canSubmit(): boolean {
    return this.phone.length === 11
      && this.code.length >= 4
      && this.password.length >= 6
      && this.nickname.trim().length > 0
      && this.inviteCode.trim().length > 0
      && !this.submitting;
  }

  private toast(message: string): void {
    try {
      this.getUIContext().getPromptAction().showToast({ message });
    } catch {
      // Toast 失败不影响主流程
    }
  }

  private startCountdown(): void {
    this.countdown = 60;
    const timer = setInterval(() => {
      this.countdown = this.countdown - 1;
      if (this.countdown <= 0) {
        clearInterval(timer);
      }
    }, 1000);
  }

  private async handleSendCode(): Promise<void> {
    if (!this.canSendCode) {
      return;
    }
    this.sending = true;
    try {
      const resp = await Api.smsCode(this.phone);
      this.startCountdown();
      // 开发模式：真实短信未接入，验证码随响应下发并明确标注
      this.devCodeTip = resp.dev_mode && resp.dev_code
        ? `开发模式验证码：${resp.dev_code}`
        : '验证码已发送，请注意查收';
      this.toast('验证码已下发');
    } catch (err) {
      this.toast(err instanceof ApiError ? err.message : '发送失败，请稍后重试');
    } finally {
      this.sending = false;
    }
  }

  private async handleRegister(): Promise<void> {
    if (!this.canSubmit) {
      return;
    }
    this.submitting = true;
    try {
      const body: RegisterBody = {
        phone: this.phone,
        code: this.code,
        password: this.password,
        nickname: this.nickname.trim(),
        invite_code: this.inviteCode.trim(),
      };
      const resp = await Api.register(body);
      Session.applyAccount(resp.account);
      this.toast('注册成功，欢迎加入沈大社区');
      this.navStack.replacePath({ name: 'Tabs' });
    } catch (err) {
      this.toast(err instanceof ApiError ? err.message : '注册失败，请稍后重试');
    } finally {
      this.submitting = false;
    }
  }

  build() {
    Column({ space: 16 }) {
      Row() {
        Text('‹ 返回登录')
          .fontSize(14)
          .fontColor(AppColors.PRIMARY)
          .onClick(() => {
            this.navStack.pop();
          })
        Blank()
        Text('注册账号')
          .fontSize(17)
          .fontWeight(FontWeight.Medium)
          .fontColor(AppColors.TEXT_PRIMARY)
        Blank()
        Text('    ')
      }
      .width('100%')
      .margin({ top: 12, bottom: 12 })

      TextInput({ placeholder: '手机号', text: $$this.phone })
        .type(InputType.PhoneNumber)
        .maxLength(11)
        .height(48)
        .backgroundColor(AppColors.CARD_BG)
        .borderRadius(10)

      Row({ space: 10 }) {
        TextInput({ placeholder: '短信验证码', text: $$this.code })
          .type(InputType.Number)
          .maxLength(6)
          .height(48)
          .layoutWeight(1)
          .backgroundColor(AppColors.CARD_BG)
          .borderRadius(10)
        Button(this.countdown > 0 ? `${this.countdown}s` : '获取验证码')
          .height(48)
          .fontSize(13)
          .backgroundColor(this.canSendCode ? AppColors.PRIMARY : '#9AB6EA')
          .enabled(this.canSendCode)
          .onClick(() => {
            this.handleSendCode();
          })
      }

      if (this.devCodeTip.length > 0) {
        Text(this.devCodeTip)
          .fontSize(12)
          .fontColor(AppColors.ORANGE)
          .width('100%')
      }

      TextInput({ placeholder: '密码（至少 6 位）', text: $$this.password })
        .type(InputType.Password)
        .height(48)
        .backgroundColor(AppColors.CARD_BG)
        .borderRadius(10)

      TextInput({ placeholder: '昵称', text: $$this.nickname })
        .maxLength(16)
        .height(48)
        .backgroundColor(AppColors.CARD_BG)
        .borderRadius(10)

      TextInput({ placeholder: '邀请码（内测默认 xsnbb-test）', text: $$this.inviteCode })
        .height(48)
        .backgroundColor(AppColors.CARD_BG)
        .borderRadius(10)

      Button(this.submitting ? '注册中…' : '注册并登录')
        .width('100%')
        .height(48)
        .fontSize(16)
        .backgroundColor(this.canSubmit ? AppColors.PRIMARY : '#9AB6EA')
        .enabled(this.canSubmit)
        .onClick(() => {
          this.handleRegister();
        })
    }
    .width('100%')
    .height('100%')
    .padding({ left: 28, right: 28 })
    .backgroundColor(AppColors.PAGE_BG)
  }
}
