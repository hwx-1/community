import { AppColors } from '../constants/AppConfig';
import { HomeTab } from '../components/tabs/HomeTab';
import { MessagesTab } from '../components/tabs/MessagesTab';
import { AITab } from '../components/tabs/AITab';
import { MineTab } from '../components/tabs/MineTab';

/** 主界面：四个 Tab + 发布入口，作为 NavDestination 由 Main 调度。 */
@Component
export struct TabsPage {
  @Consume('navStack') navStack: NavPathStack;
  @State currentTab: number = 0;
  private tabsController: TabsController = new TabsController();

  build() {
    Stack({ alignContent: Alignment.BottomEnd }) {
      Tabs({ barPosition: BarPosition.End, controller: this.tabsController, index: $$this.currentTab }) {
        TabContent() {
          HomeTab()
        }
        .tabBar(this.TabItem('🏠', '首页', 0))

        TabContent() {
          MessagesTab()
        }
        .tabBar(this.TabItem('🔔', '消息', 1))

        TabContent() {
          AITab()
        }
        .tabBar(this.TabItem('✨', 'AI 助手', 2))

        TabContent() {
          MineTab()
        }
        .tabBar(this.TabItem('👤', '我的', 3))
      }
      .barMode(BarMode.Fixed)
      .scrollable(false)
      .width('100%')
      .height('100%')

      // 发布按钮
      Text('＋')
        .fontSize(28)
        .fontColor(Color.White)
        .textAlign(TextAlign.Center)
        .width(56)
        .height(56)
        .borderRadius(28)
        .backgroundColor(AppColors.PRIMARY)
        .shadow({ radius: 12, color: '#552E6BE6', offsetY: 4 })
        .margin({ right: 20, bottom: 84 })
        .onClick(() => {
          this.navStack.pushPath({ name: 'Compose' });
        })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(AppColors.PAGE_BG)
  }

  @Builder
  private TabItem(icon: string, label: string, index: number) {
    Column({ space: 2 }) {
      Text(icon)
        .fontSize(20)
      Text(label)
        .fontSize(11)
        .fontColor(this.currentTab === index ? AppColors.PRIMARY : AppColors.TEXT_SECONDARY)
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
  }
}
