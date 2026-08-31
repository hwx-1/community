import { Api } from '../../service/Api';
import { ApiError } from '../../service/Http';
import { Announcement, Post, PostDetailParam, PublicSettings, SearchParam } from '../../model/Types';
import { BasicDataSource } from '../../utils/BasicDataSource';
import { AppColors } from '../../constants/AppConfig';
import { PostCard } from '../business/PostCard';
import { LoadingView } from '../common/LoadingView';
import { EmptyState } from '../common/EmptyState';

class PostListDataSource extends BasicDataSource<Post> {}

/** 首页信息流：搜索入口、公告与热门话题、帖子列表。 */
@Component
export struct HomeTab {
  @Consume('navStack') navStack: NavPathStack;
  @State loading: boolean = true;
  @State refreshing: boolean = false;
  @State loadError: string = '';
  @State announcements: Announcement[] = [];
  @State settings: PublicSettings = { hot_topics: [], greeting: '' };
  private dataSource: PostListDataSource = new PostListDataSource();

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
    this.loadError = '';
    try {
      const resp = await Api.listPosts('', false);
      this.dataSource.setAll(resp.items);
    } catch (err) {
      this.loadError = err instanceof ApiError ? err.message : '加载失败';
    }
    // 公告与热门话题失败不阻塞信息流
    try {
      const annResp = await Api.listAnnouncements();
      this.announcements = annResp.items.filter((item: Announcement) => item.published);
    } catch {
    }
    try {
      this.settings = await Api.publicSettings();
    } catch {
    }
    this.loading = false;
    this.refreshing = false;
  }

  private handleRefresh(): void {
    this.refreshing = true;
    this.loadAll();
  }

  private async handleLike(post: Post): Promise<void> {
    try {
      const resp = await Api.likePost(post.id);
      this.dataSource.updateAt(this.findIndex(post.id), resp.post);
    } catch (err) {
      this.toast(err instanceof ApiError ? err.message : '操作失败');
    }
  }

  private async handleBookmark(post: Post): Promise<void> {
    try {
      const resp = await Api.bookmarkPost(post.id);
      this.dataSource.updateAt(this.findIndex(post.id), resp.post);
      this.toast(resp.post.bookmarked ? '已收藏' : '已取消收藏');
    } catch (err) {
      this.toast(err instanceof ApiError ? err.message : '操作失败');
    }
  }

  private findIndex(id: number): number {
    return this.dataSource.getAll().findIndex((post: Post) => post.id === id);
  }

  private openSearch(tag: string): void {
    const param: SearchParam = { keyword: tag };
    this.navStack.pushPath({ name: 'Search', param: param });
  }

  build() {
    Column() {
      // 顶部：问候 + 搜索入口
      Row({ space: 10 }) {
        Column({ space: 2 }) {
          Text(this.settings.greeting.length > 0 ? this.settings.greeting : '沈大社区')
            .fontSize(20)
            .fontWeight(FontWeight.Bold)
            .fontColor(AppColors.TEXT_PRIMARY)
          Text('沈阳大学校园社区')
            .fontSize(12)
            .fontColor(AppColors.TEXT_SECONDARY)
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)

        Row({ space: 6 }) {
          Text('🔍')
            .fontSize(14)
          Text('搜索帖子 / 话题')
            .fontSize(13)
            .fontColor(AppColors.TEXT_SECONDARY)
        }
        .height(36)
        .padding({ left: 12, right: 12 })
        .backgroundColor(AppColors.CARD_BG)
        .borderRadius(18)
        .onClick(() => {
          const param: SearchParam = { keyword: '' };
          this.navStack.pushPath({ name: 'Search', param: param });
        })
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 12, bottom: 8 })

      if (this.loading) {
        LoadingView()
      } else if (this.loadError.length > 0 && this.dataSource.totalCount() === 0) {
        EmptyState({
          title: '加载失败',
          desc: this.loadError,
          actionText: '重试',
          onAction: () => this.loadAll()
        })
      } else {
        Refresh({ refreshing: $$this.refreshing }) {
          List({ space: 12 }) {
            // 公告摘要
            if (this.announcements.length > 0) {
              ListItem() {
                Column({ space: 6 }) {
                  Row({ space: 6 }) {
                    Text('📢')
                      .fontSize(14)
                    Text(this.announcements[0].title)
                      .fontSize(14)
                      .fontWeight(FontWeight.Medium)
                      .fontColor(AppColors.TEXT_PRIMARY)
                      .maxLines(1)
                      .textOverflow({ overflow: TextOverflow.Ellipsis })
                      .layoutWeight(1)
                    Text(`共 ${this.announcements.length} 条 ›`)
                      .fontSize(12)
                      .fontColor(AppColors.PRIMARY)
                  }
                  if (this.announcements[0].summary.length > 0) {
                    Text(this.announcements[0].summary)
                      .fontSize(12)
                      .fontColor(AppColors.TEXT_SECONDARY)
                      .maxLines(1)
                      .textOverflow({ overflow: TextOverflow.Ellipsis })
                  }
                }
                .width('100%')
                .padding(12)
                .backgroundColor('#0F2E6BE6')
                .borderRadius(12)
                .alignItems(HorizontalAlign.Start)
                .onClick(() => {
                  this.navStack.pushPath({ name: 'Announcements' });
                })
              }
            }

            // 热门话题
            if (this.settings.hot_topics.length > 0) {
              ListItem() {
                Scroll() {
                  Row({ space: 8 }) {
                    ForEach(this.settings.hot_topics, (topic: string) => {
                      Text(`# ${topic}`)
                        .fontSize(12)
                        .fontColor(AppColors.PRIMARY)
                        .padding({ left: 12, right: 12, top: 6, bottom: 6 })
                        .backgroundColor(AppColors.CARD_BG)
                        .borderRadius(14)
                        .onClick(() => this.openSearch(topic))
                    }, (topic: string) => topic)
                  }
                }
                .scrollable(ScrollDirection.Horizontal)
                .scrollBar(BarState.Off)
                .width('100%')
              }
            }

            LazyForEach(this.dataSource, (post: Post) => {
              ListItem() {
                PostCard({
                  post: post,
                  onOpen: (target: Post) => {
                    const param: PostDetailParam = { id: target.id };
                    this.navStack.pushPath({ name: 'PostDetail', param: param });
                  },
                  onLike: (target: Post) => {
                    this.handleLike(target);
                  },
                  onBookmark: (target: Post) => {
                    this.handleBookmark(target);
                  },
                  onTag: (tag: string) => this.openSearch(tag)
                })
              }
            }, (post: Post) => `${post.id}`)

            if (this.dataSource.totalCount() === 0) {
              ListItem() {
                EmptyState({ title: '还没有帖子', desc: '来发第一条校园动态吧' })
              }
            }
          }
          .width('100%')
          .padding({ left: 12, right: 12, bottom: 90 })
        }
        .onRefreshing(() => this.handleRefresh())
        .layoutWeight(1)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(AppColors.PAGE_BG)
  }
}
