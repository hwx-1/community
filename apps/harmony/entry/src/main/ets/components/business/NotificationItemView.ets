import { AppNotification } from '../../model/Types';
import { TimeUtil } from '../../utils/TimeUtil';
import { AppColors } from '../../constants/AppConfig';

/** 系统通知条目。 */
@Component
export struct NotificationItemView {
  @Prop notification: AppNotification;

  private get typeLabel(): string {
    switch (this.notification.type) {
      case 'comment':
        return '评论';
      case 'reply':
        return '回复';
      case 'report_result':
        return '举报结果';
      case 'official_answer':
        return '官方答复';
      case 'punishment':
        return '处罚通知';
      case 'appeal_result':
        return '申诉结果';
      default:
        return '通知';
    }
  }

  build() {
    Row({ space: 10 }) {
      Stack() {
        Text(this.typeLabel)
          .fontSize(11)
          .fontColor(Color.White)
      }
      .width(52)
      .height(24)
      .borderRadius(6)
      .backgroundColor(AppColors.PRIMARY)

      Column({ space: 4 }) {
        Row({ space: 6 }) {
          Text(this.notification.title)
            .fontSize(15)
            .fontWeight(this.notification.read ? FontWeight.Normal : FontWeight.Medium)
            .fontColor(AppColors.TEXT_PRIMARY)
            .layoutWeight(1)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          if (!this.notification.read) {
            Circle({ width: 8, height: 8 })
              .fill(AppColors.DANGER)
          }
        }
        if (this.notification.body.length > 0) {
          Text(this.notification.body)
            .fontSize(13)
            .fontColor(AppColors.TEXT_SECONDARY)
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        Text(TimeUtil.format(this.notification.created_at))
          .fontSize(11)
          .fontColor(AppColors.TEXT_SECONDARY)
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
    }
    .width('100%')
    .padding(14)
    .backgroundColor(AppColors.CARD_BG)
    .alignItems(VerticalAlign.Top)
  }
}
