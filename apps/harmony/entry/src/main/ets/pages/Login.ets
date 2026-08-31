import { Api } from '../service/Api';
import { ApiError } from '../service/Http';
import { Session } from '../service/Session';
import { AppColors } from '../constants/AppConfig';

@Component
export struct LoginPage {
  @Consume('navStack') navStack: NavPathStack;
  @State phone: string = '';
  @State password: string = '';
  @State submitting: boolean = false;

  private get canSubmit(): boolean {
    return this.phone.length === 11 && this.password.length >= 6 && !this.submitting;
  }

  private toast(message: string): void {
    try {
      this.getUIContext().getPromptAction().showToast({ message });
    } catch {
      // Toast 失败不影响主流程
    }
  }

  private async handleLogin(): Promise<void> {
    if (!this.canSubmit) {
      return;
    }
    this.submitting = true;
    try {
      const resp = await Api.login(this.phone, this.password);
      Session.applyAccount(resp.account);
      this.toast(`欢迎回来，${resp.account.nickname}`);
      this.navStack.replacePath({ name: 'Tabs' });
    } catch (err) {
      this.toast(err instanceof ApiError ? err.message : '登录失败，请稍后重试');
    } finally {
      this.submitting = false;
    }
  }

  build() {
    Column({ space: 20 }) {
      Column({ space: 8 }) {
        Text('沈大社区')
          .fontSize(32)
          .fontWeight(FontWeight.Bold)
          .fontColor(AppColors.TEXT_PRIMARY)
        Text('沈阳大学校园社区')
          .fontSize(14)
          .fontColor(AppColors.TEXT_SECONDARY)
      }
      .margin({ top: 72, bottom: 24 })

      TextInput({ placeholder: '手机号', text: $$this.phone })
        .type(InputType.PhoneNumber)
        .maxLength(11)
        .height(48)
        .backgroundColor(AppColors.CARD_BG)
        .borderRadius(10)

      TextInput({ placeholder: '密码（至少 6 位）', text: $$this.password })
        .type(InputType.Password)
        .height(48)
        .backgroundColor(AppColors.CARD_BG)
        .borderRadius(10)

      Button(this.submitting ? '登录中…' : '登 录')
        .width('100%')
        .height(48)
        .fontSize(16)
        .backgroundColor(this.canSubmit ? AppColors.PRIMARY : '#9AB6EA')
        .enabled(this.canSubmit)
        .onClick(() => {
          this.handleLogin();
        })

      Row({ space: 4 }) {
        Text('还没有账号？')
          .fontSize(13)
          .fontColor(AppColors.TEXT_SECONDARY)
        Text('立即注册')
          .fontSize(13)
          .fontColor(AppColors.PRIMARY)
          .onClick(() => {
            this.navStack.pushPath({ name: 'Register' });
          })
      }
      .margin({ top: 8 })
    }
    .width('100%')
    .height('100%')
    .padding({ left: 28, right: 28 })
    .backgroundColor(AppColors.PAGE_BG)
    .alignItems(HorizontalAlign.Center)
  }
}
