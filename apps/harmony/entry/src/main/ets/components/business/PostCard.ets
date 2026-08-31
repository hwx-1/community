import { Post } from '../../model/Types';
import { TimeUtil } from '../../utils/TimeUtil';
import { absoluteMediaUrl } from '../../service/Http';
import { AppColors } from '../../constants/AppConfig';
import { AvatarView } from '../common/AvatarView';
import { TagChip } from '../common/TagChip';

/**
 * 信息流帖子卡片：头像+昵称+时间、正文、九宫格图片、
 * 标签、点赞/评论/收藏操作栏。
 */
@Component
export struct PostCard {
  @Prop post: Post;
  onOpen: (post: Post) => void = () => {};
  onLike: (post: Post) => void = () => {};
  onBookmark: (post: Post) => void = () => {};
  onTag: (tag: string) => void = () => {};

  private get imageUrls(): string[] {
    if (!this.post.images) {
      return [];
    }
    return this.post.images.map((path: string) => absoluteMediaUrl(path));
  }

  private imageSpan(): number {
    const count = this.imageUrls.length;
    if (count === 1) {
      return 1;
    }
    return count === 2 || count === 4 ? 2 : 3;
  }

  build() {
    Column({ space: 10 }) {
      Row({ space: 10 }) {
        AvatarView({ avatar: this.post.author.avatar, nickname: this.post.author.nickname, diameter: 40 })
        Column({ space: 2 }) {
          Row({ space: 6 }) {
            Text(this.post.author.nickname)
              .fontSize(15)
              .fontWeight(FontWeight.Medium)
              .fontColor(AppColors.TEXT_PRIMARY)
            if (this.post.author.verified) {
              Text('已认证')
                .fontSize(10)
                .fontColor(AppColors.PRIMARY)
                .padding({ left: 6, right: 6, top: 1, bottom: 1 })
                .border({ width: 1, color: AppColors.PRIMARY, radius: 4 })
            }
            if (this.post.pinned) {
              Text('置顶')
                .fontSize(10)
                .fontColor(AppColors.ORANGE)
                .padding({ left: 6, right: 6, top: 1, bottom: 1 })
                .border({ width: 1, color: AppColors.ORANGE, radius: 4 })
            }
          }
          Text(TimeUtil.format(this.post.created_at))
            .fontSize(12)
            .fontColor(AppColors.TEXT_SECONDARY)
        }
        .alignItems(HorizontalAlign.Start)
      }

      Text(this.post.text)
        .fontSize(15)
        .fontColor(AppColors.TEXT_PRIMARY)
        .maxLines(6)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      if (this.imageUrls.length > 0) {
        Grid() {
          ForEach(this.imageUrls, (url: string) => {
            GridItem() {
              Image(url)
                .width('100%')
                .aspectRatio(1)
                .objectFit(ImageFit.Cover)
                .borderRadius(8)
            }
          }, (url: string) => url)
        }
        .columnsTemplate(`1fr `.repeat(this.imageSpan()).trim())
        .columnsGap(6)
        .rowsGap(6)
      }

      if (this.post.tags && this.post.tags.length > 0) {
        Flex({ wrap: FlexWrap.Wrap }) {
          ForEach(this.post.tags, (tag: string) => {
            TagChip({ text: tag, onTap: this.onTag })
              .margin({ right: 8, bottom: 4 })
          }, (tag: string) => tag)
        }
      }

      Row() {
        this.ActionItem(this.post.liked ? '❤️' : '🤍', `${this.post.likes}`,
          () => this.onLike(this.post))
        this.ActionItem('💬', `${this.post.comments}`, () => this.onOpen(this.post))
        this.ActionItem(this.post.bookmarked ? '⭐' : '☆', this.post.bookmarked ? '已收藏' : '收藏',
          () => this.onBookmark(this.post))
      }
      .width('100%')
      .justifyContent(FlexAlign.SpaceAround)
    }
    .width('100%')
    .padding(14)
    .backgroundColor(AppColors.CARD_BG)
    .borderRadius(12)
    .alignItems(HorizontalAlign.Start)
    .onClick(() => this.onOpen(this.post))
  }

  @Builder
  private ActionItem(icon: string, label: string, action: () => void) {
    Row({ space: 4 }) {
      Text(icon)
        .fontSize(14)
      Text(label)
        .fontSize(13)
        .fontColor(AppColors.TEXT_SECONDARY)
    }
    .padding(6)
    .onClick((event?: ClickEvent) => {
      action();
    })
  }
}
