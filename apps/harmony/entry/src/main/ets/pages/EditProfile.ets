import { Api } from '../service/Api';
import { ApiError } from '../service/Http';
import { Session } from '../service/Session';
import { UpdateProfileBody } from '../model/Types';
import { AppColors } from '../constants/AppConfig';
import { FormField } from '../components/common/FormField';

@Component
export struct EditProfilePage {
  @Consume('navStack') navStack: NavPathStack;
  @State nickname: string = '';
  @State gender: string = '';
  @State realName: string = '';
  @State studentNo: string = '';
  @State className: string = '';
  @State saving: boolean = false;
  private avatar: string = '';

  aboutToAppear(): void {
    const account = Session.currentAccount();
    if (account) {
      this.nickname = account.nickname;
      this.gender = account.gender;
      this.realName = account.real_name ?? '';
      this.studentNo = account.student_no ?? '';
      this.className = account.class_name ?? '';
      this.avatar = account.avatar;
    }
  }

  private toast(message: string): void {
    try {
      this.getUIContext().getPromptAction().showToast({ message });
    } catch {
      // Toast 失败不影响主流程
    }
  }

  private async save(): Promise<void> {
    if (this.nickname.trim().length === 0 || this.saving) {
      this.toast('昵称不能为空');
      return;
    }
    this.saving = true;
    try {
      const body: UpdateProfileBody = {
        nickname: this.nickname.trim(),
        avatar: this.avatar,
        gender: this.gender,
        real_name: this.realName.trim(),
        student_no: this.studentNo.trim(),
        class_name: this.className.trim(),
      };
      const resp = await Api.updateProfile(body);
      Session.applyAccount(resp.account);
      this.toast('资料已保存');
      this.navStack.pop();
    } catch (err) {
      this.toast(err instanceof ApiError ? err.message : '保存失败，请稍后重试');
    } finally {
      this.saving = false;
    }
  }

  build() {
    Column() {
      Row() {
        Text('取消')
          .fontSize(14)
          .fontColor(AppColors.TEXT_SECONDARY)
          .onClick(() => {
            this.navStack.pop();
          })
        Blank()
        Text('编辑资料')
          .fontSize(17)
          .fontWeight(FontWeight.Medium)
          .fontColor(AppColors.TEXT_PRIMARY)
        Blank()
        Text(this.saving ? '保存中…' : '保存')
          .fontSize(14)
          .fontColor(this.nickname.trim().length > 0 ? AppColors.PRIMARY : AppColors.TEXT_SECONDARY)
          .onClick(() => {
            this.save();
          })
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 12, bottom: 12 })

      Scroll() {
        Column({ space: 14 }) {
          FormField({ label: '昵称', placeholder: '请输入昵称', value: this.$nickname })
          this.GenderPicker()
          FormField({ label: '真实姓名', placeholder: '选填', value: this.$realName })
          FormField({ label: '学号', placeholder: '选填', value: this.$studentNo })
          FormField({ label: '班级', placeholder: '选填', value: this.$className })

          Text('学号与班级将用于学生认证核验，请如实填写。')
            .fontSize(11)
            .fontColor(AppColors.TEXT_SECONDARY)
            .width('100%')
        }
        .width('100%')
        .padding({ left: 16, right: 16 })
      }
      .layoutWeight(1)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(AppColors.PAGE_BG)
  }

  @Builder
  private GenderPicker() {
    Column({ space: 6 }) {
      Text('性别')
        .fontSize(13)
        .fontColor(AppColors.TEXT_SECONDARY)
        .width('100%')
      Row({ space: 10 }) {
        ForEach(['男', '女', '保密'], (option: string) => {
          Text(option)
            .fontSize(14)
            .fontColor(this.gender === option ? Color.White : AppColors.TEXT_PRIMARY)
            .padding({ left: 18, right: 18, top: 8, bottom: 8 })
            .backgroundColor(this.gender === option ? AppColors.PRIMARY : AppColors.CARD_BG)
            .borderRadius(18)
            .onClick(() => {
              this.gender = option;
            })
        }, (option: string) => option)
      }
      .width('100%')
    }
    .width('100%')
  }
}
