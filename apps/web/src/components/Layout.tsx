import { NavLink, Outlet } from 'react-router-dom'
import styles from './Layout.module.css'

const navItems = [
  { to: '/', label: '首页', icon: '🏠' },
  { to: '/tools', label: '校园工具', icon: '🧰' },
  { to: '/messages', label: '消息', icon: '✉' },
  { to: '/me', label: '我的', icon: '👤' },
]

export default function Layout() {
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.logo}>xsnbb</div>
        <div className={styles.search}>
          <span>🔍</span>
          <span className={styles.searchPlaceholder}>搜索帖子、标签</span>
        </div>
        <div className={styles.topright}>
          <NavLink to="/messages" className={styles.toplink}>✉ 消息</NavLink>
          <div className={styles.avatarSm}>李</div>
        </div>
      </header>
      <div className={styles.cols}>
        <aside className={styles.left}>
          <div className={styles.usercard}>
            <div className={styles.avatarLg}>李</div>
            <div className={styles.name}>李大壮</div>
            <span className={styles.badge}>已认证学生</span>
          </div>
          <nav className={styles.navlist}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  isActive ? `${styles.navitem} ${styles.navitemOn}` : styles.navitem
                }
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className={styles.main}>
          <Outlet />
        </main>
        <aside className={styles.right}>
          <RightSidebar />
        </aside>
      </div>
    </div>
  )
}

function RightSidebar() {
  return (
    <>
      <div className={styles.panel}>
        <div className={styles.panelTitle}>校园工具</div>
        <div className={styles.toolRow}><span className={styles.toolIcon}>🗺</span>校园地图</div>
        <div className={styles.toolRow}><span className={styles.toolIcon}>✦</span>AI 问答</div>
        <div className={styles.toolRow}><span className={styles.toolIcon}>🔗</span>常用网址</div>
      </div>
      <div className={styles.panel}>
        <div className={styles.panelTitle}>公告</div>
        <div className={styles.ann}>图书馆开放时间调整 <span className={styles.annDate}>· 2 小时前</span></div>
        <div className={styles.ann}>期末考场安排公布 <span className={styles.annDate}>· 昨天</span></div>
      </div>
      <div className={styles.panel}>
        <div className={styles.panelTitle}>热门话题</div>
        <div className={styles.hotRow}><span className={styles.hotNo}>1</span># 期末复习</div>
        <div className={styles.hotRow}><span className={styles.hotNo}>2</span># 羽毛球</div>
        <div className={styles.hotRow}><span className={styles.hotNo}>3</span># 食堂新品</div>
      </div>
    </>
  )
}
