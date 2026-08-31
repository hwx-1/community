import { Api } from '../../service/Api';
import { ApiError } from '../../service/Http';
import { AppNotification, ChatParam, DirectConversationItem } from '../../model/Types';
import { AppColors } from '../../constants/AppConfig';
import { NotificationItemView } from '../business/NotificationItemView';
import { ConversationItemView } from '../business/ConversationItemView';
import { LoadingView } from '../common/LoadingView';
import { EmptyState } from '../common/EmptyState';

/** 消息页：系统通知 + 私信会话。 */
@Component
export struct MessagesTab {
  @Consume('navStack') navStack: NavPathStack;
  @State segment: number = 0;
  @State loading: boolean = true;
  @State refreshing: boolean = false;
  @State notifications: AppNotification[] = [];
  @State unread: number = 0;
  @State conversations: DirectConversationItem[] = [];

  aboutToAppear(): void {
    this.loadAll();
  }

  private toast(message: string): void {
    try {
      this.getUIContext().getPromptAction().showToast({ message });
    } catch {
      // Toast 失败不影响主流程
    }
  }

  private async loadAll(): Promise<void> {
    try {
      const resp = await Api.notifications();
      this.notifications = resp.items;
      this.unread = resp.unread;
    } catch {
    }
    try {
      const convResp = await Api.listDirectConversations();
      this.conversations = convResp.items;
    } catch {
    }
    this.loading = false;
    this.refreshing = false;
  }

  private async markAllRead(): Promise<void> {
    if (this.unread === 0) {
      return;
    }
    try {
      const resp = await Api.markNotificationsRead([]);
      this.unread = resp.unread;
      this.notifications = this.notifications.map((item: AppNotification) => {
        const copy: AppNotification = {
          id: item.id,
          type: item.type,
          title: item.title,
          body: item.body,
          ref_type: item.ref_type,
          ref_id: item.ref_id,
          read: true,
          created_at: item.created_at,
        };
        return copy;
      });
    } catch (err) {
      this.toast(err instanceof ApiError ? err.message : '操作失败');
    }
  }

  build() {
    Column() {
      Row() {
        Text('消息')
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor(AppColors.TEXT_PRIMARY)
        Blank()
        if (this.segment === 0 && this.unread > 0) {
          Text(`全部已读（${this.unread} 条未读）`)
            .fontSize(12)
            .fontColor(AppColors.PRIMARY)
            .onClick(() => {
              this.markAllRead();
            })
        }
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 12, bottom: 8 })

      Row({ space: 8 }) {
        this.SegmentButton('通知', 0, this.unread)
        this.SegmentButton('私信', 1, 0)
      }
      .width('100%')
      .padding({ left: 16, right: 16, bottom: 10 })

      if (this.loading) {
        LoadingView()
      } else {
        Refresh({ refreshing: $$this.refreshing }) {
          List() {
            if (this.segment === 0) {
              ForEach(this.notifications, (item: AppNotification) => {
                ListItem() {
                  NotificationItemView({ notification: item })
                }
              }, (item: AppNotification) => `${item.id}`)
              if (this.notifications.length === 0) {
                ListItem() {
                  EmptyState({ title: '暂无通知' })
                }
              }
            } else {
              ForEach(this.conversations, (item: DirectConversationItem) => {
                ListItem() {
                  ConversationItemView({
                    conversation: item,
                    onOpen: (target: DirectConversationItem) => {
                      const param: ChatParam = { id: target.id, name: target.other.nickname };
                      this.navStack.pushPath({ name: 'Chat', param: param });
                    }
                  })
                }
              }, (item: DirectConversationItem) => `${item.id}`)
              if (this.conversations.length === 0) {
                ListItem() {
                  EmptyState({ title: '暂无私信', desc: '和同学打个招呼吧' })
                }
              }
            }
          }
          .width('100%')
          .divider({ strokeWidth: 1, color: AppColors.DIVIDER, startMargin: 16, endMargin: 16 })
          .padding({ bottom: 90 })
        }
        .onRefreshing(() => {
          this.refreshing = true;
          this.loadAll();
        })
        .layoutWeight(1)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(AppColors.PAGE_BG)
  }

  @Builder
  private SegmentButton(label: string, index: number, badge: number) {
    Row({ space: 4 }) {
      Text(label)
        .fontSize(14)
        .fontColor(this.segment === index ? Color.White : AppColors.TEXT_SECONDARY)
      if (badge > 0) {
        Text(`${badge}`)
          .fontSize(10)
          .fontColor(Color.White)
          .padding({ left: 5, right: 5, top: 1, bottom: 1 })
          .backgroundColor(AppColors.DANGER)
          .borderRadius(8)
      }
    }
    .layoutWeight(1)
    .height(34)
    .justifyContent(FlexAlign.Center)
    .backgroundColor(this.segment === index ? AppColors.PRIMARY : AppColors.CARD_BG)
    .borderRadius(17)
    .onClick(() => {
      this.segment = index;
    })
  }
}
