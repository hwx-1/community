import { Account, ContentListParam } from '../../model/Types';
import { Session } from '../../service/Session';
import { AppColors } from '../../constants/AppConfig';
import { AvatarView } from '../common/AvatarView';

/** 我的：资料卡 + 功能入口 + 退出登录。 */
@Component
export struct MineTab {
  @Consume('navStack') navStack: NavPathStack;
  @StorageProp('xsnbb_account') account: Account | null = null;

  private toast(message: string): void {
    try {
      this.getUIContext().getPromptAction().showToast({ message });
    } catch {
      // Toast 失败不影响主流程
    }
  }

  private profileCompleteness(): number {
    const account = this.account;
    if (!account) {
      return 0;
    }
    let done = 0;
    if (account.avatar.length > 0) {
      done++;
    }
    if (account.real_name && account.real_name.length > 0) {
      done++;
    }
    if (account.student_no && account.student_no.length > 0) {
      done++;
    }
    if (account.class_name && account.class_name.length > 0) {
      done++;
    }
    if (account.gender.length > 0) {
      done++;
    }
    return Math.round((done / 5) * 100);
  }

  private confirmLogout(): void {
    this.getUIContext().getPromptAction().showDialog({
      title: '退出登录',
      message: '确定要退出当前账号吗？',
      buttons: [
        { text: '取消', color: AppColors.TEXT_SECONDARY },
        { text: '退出', color: AppColors.DANGER },
      ],
    }).then((resp) => {
      if (resp.index === 1) {
        Session.logout().then(() => {
          this.toast('已退出登录');
          this.navStack.replacePath({ name: 'Login' });
        });
      }
    }).catch(() => {
      // 对话框被取消或系统异常时不影响主流程
    });
  }

  build() {
    Scroll() {
      Column({ space: 14 }) {
        // 资料卡
        Row({ space: 14 }) {
          AvatarView({
            avatar: this.account?.avatar ?? '',
            nickname: this.account?.nickname ?? '',
            diameter: 60
          })
          Column({ space: 4 }) {
            Row({ space: 6 }) {
              Text(this.account?.nickname ?? '未登录')
                .fontSize(19)
                .fontWeight(FontWeight.Bold)
                .fontColor(AppColors.TEXT_PRIMARY)
              if (this.account?.verified) {
                Text('已认证')
                  .fontSize(10)
                  .fontColor(AppColors.PRIMARY)
                  .padding({ left: 6, right: 6, top: 1, bottom: 1 })
                  .border({ width: 1, color: AppColors.PRIMARY, radius: 4 })
              }
            }
            Text(this.account?.phone ?? '')
              .fontSize(13)
              .fontColor(AppColors.TEXT_SECONDARY)
            Row({ space: 6 }) {
              Text(`资料完整度 ${this.profileCompleteness()}%`)
                .fontSize(11)
                .fontColor(AppColors.TEXT_SECONDARY)
              Progress({ value: this.profileCompleteness(), total: 100, type: ProgressType.Linear })
                .width(100)
                .color(AppColors.PRIMARY)
            }
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
        }
        .width('100%')
        .padding(16)
        .backgroundColor(AppColors.CARD_BG)
        .borderRadius(14)
        .onClick(() => {
          this.navStack.pushPath({ name: 'EditProfile' });
        })

        // 功能入口
        Column() {
          this.EntryRow('📝', '我的帖子', () => {
            const param: ContentListParam = { mode: 'mine' };
            this.navStack.pushPath({ name: 'ContentList', param: param });
          })
          this.EntryRow('⭐', '我的收藏', () => {
            const param: ContentListParam = { mode: 'bookmarks' };
            this.navStack.pushPath({ name: 'ContentList', param: param });
          })
          this.EntryRow('🎓', '学生认证', () => {
            this.navStack.pushPath({ name: 'Verification' });
          })
          this.EntryRow('🧰', '校园百宝箱', () => {
            this.navStack.pushPath({ name: 'Tools' });
          })
          this.EntryRow('⚙️', '账号设置', () => {
            this.navStack.pushPath({ name: 'AccountSettings' });
          })
        }
        .width('100%')
        .backgroundColor(AppColors.CARD_BG)
        .borderRadius(14)

        Text('退出登录')
          .fontSize(15)
          .fontColor(AppColors.DANGER)
          .width('100%')
          .textAlign(TextAlign.Center)
          .padding(14)
          .backgroundColor(AppColors.CARD_BG)
          .borderRadius(14)
          .onClick(() => {
            this.confirmLogout();
          })
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 16, bottom: 100 })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(AppColors.PAGE_BG)
  }

  @Builder
  private EntryRow(icon: string, label: string, action: () => void) {
    Row({ space: 12 }) {
      Text(icon)
        .fontSize(18)
      Text(label)
        .fontSize(15)
        .fontColor(AppColors.TEXT_PRIMARY)
        .layoutWeight(1)
      Text('›')
        .fontSize(18)
        .fontColor(AppColors.TEXT_SECONDARY)
    }
    .width('100%')
    .padding({ left: 16, right: 16, top: 14, bottom: 14 })
    .onClick(() => action())
  }
}
