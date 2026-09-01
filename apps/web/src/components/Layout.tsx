import { FormEvent, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Icon, { IconName } from './Icon'
import { api, formatTime } from '../api/client'
import { useAuth } from '../store/auth'
import styles from './Layout.module.css'

type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  const saved = localStorage.getItem('xsnbb-theme')
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const navItems: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: '首页', icon: 'home' },
  { to: '/tools', label: '百宝箱', icon: 'toolbox' },
  { to: '/messages', label: '消息', icon: 'message' },
  { to: '/me', label: '我的', icon: 'user' },
]

const toolPaths: Record<string, string> = { ai: '/tools/ai', map: '/tools/map', links: '/tools/links' }

export default function Layout() {
  const [keyword, setKeyword] = useState('')
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { account, loaded, refresh } = useAuth()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('xsnbb-theme', theme)
    // 清理旧版仅按会话 ID 保存的本地已读时间；已读状态现已由服务端统一维护。
    localStorage.removeItem('xsnbb-dm-read')
  }, [theme])

  useEffect(() => {
    if (!loaded) void refresh()
  }, [loaded, refresh])

  // 路由守卫：未登录回到登录页；资料未完善进入引导页
  useEffect(() => {
    if (!loaded) return
    if (!account) {
      navigate('/login', { replace: true, state: { from: location.pathname } })
    } else if (!account.profile_done && location.pathname !== '/onboarding') {
      navigate('/onboarding', { replace: true })
    }
  }, [loaded, account, location.pathname, navigate])

  // SSE 只传“数据已变化”信号，正文仍通过鉴权 REST 补拉；5 秒轮询保留为断线兜底。
  useEffect(() => {
    if (!account) return
    const accountId = account.id
    const events = new EventSource('/api/v1/events', { withCredentials: true })
    const refreshMessages = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', accountId] })
      void queryClient.invalidateQueries({ queryKey: ['direct-conversations', accountId] })
      void queryClient.invalidateQueries({ queryKey: ['direct-conversation', accountId] })
    }
    events.addEventListener('refresh', refreshMessages)
    return () => {
      events.removeEventListener('refresh', refreshMessages)
      events.close()
    }
  }, [account, queryClient])

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    navigate(`/search${keyword.trim() ? `?q=${encodeURIComponent(keyword.trim())}` : ''}`)
  }

  // 通知与私信未读数都以服务端返回值为准，所有端保持同一计数口径。
  const { data: noticeData } = useQuery({ queryKey: ['notifications', account?.id], queryFn: api.notifications, enabled: !!account, refetchInterval: 30_000 })
  const { data: convData } = useQuery({ queryKey: ['direct-conversations', account?.id], queryFn: api.listDirectConversations, enabled: !!account, refetchInterval: 5_000 })
  const unreadNotice = noticeData?.unread ?? 0
  const unreadDm = convData?.unread ?? 0
  const unreadTotal = unreadNotice + unreadDm

  if (!loaded || !account) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>正在加载…</div>
  }

  return (
    <div className={styles.shell}>
      <a href="#main-content" className="srOnly">跳到主要内容</a>
      <header className={styles.topbar}>
        <div className={styles.headerInner}>
          <div className={styles.topLeft}>
            <NavLink to="/" className={styles.brand} aria-label="xsnbb 首页">
              <span className={styles.brandMark}>x</span>
              <span>xsnbb</span>
            </NavLink>
          </div>

          <form className={styles.search} role="search" onSubmit={submitSearch}>
            <Icon name="search" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索帖子或标签"
              aria-label="搜索帖子或标签"
            />
            <button type="submit" className={styles.searchGo}>搜索</button>
          </form>

          <div className={styles.topright}>
            <button
              className={styles.iconButton}
              type="button"
              aria-label={theme === 'dark' ? '切换到日间模式' : '切换到夜间模式'}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
            <NavLink to="/search" className={`${styles.iconButton} ${styles.mobileSearch}`} aria-label="搜索">
              <Icon name="search" />
            </NavLink>
            <NavLink to="/messages" className={`${styles.iconButton} ${styles.desktopNotice}`} aria-label={unreadTotal > 0 ? `消息,${unreadTotal} 条未读` : '消息'}>
              <Icon name="bell" />
              {unreadTotal > 0 && <span className={styles.badgeDot}>{unreadTotal > 99 ? '99+' : unreadTotal}</span>}
            </NavLink>
            <NavLink to="/me" className={styles.avatarSm} aria-label="我的主页">{account.avatar || account.nickname.slice(0, 1)}</NavLink>
          </div>
        </div>
      </header>

      <div className={styles.cols}>
        <aside className={styles.left} aria-label="主导航">
          <ProfileCard />
          <NavList unread={unreadTotal} />
          <NavLink to="/compose" className={styles.sidePublish}>
            <Icon name="edit" />
            发布新帖
          </NavLink>
          <p className={styles.communityNote}>学生共建社区 · 非学校官方平台</p>
        </aside>

        <main className={styles.main} id="main-content">
          <Outlet />
        </main>

        <aside className={styles.right} aria-label="社区信息">
          <RightSidebar />
        </aside>
      </div>
      <MobileBottomNav unread={unreadTotal} />
    </div>
  )
}

function MobileBottomNav({ unread = 0 }: { unread?: number }) {
  const items: { to: string; label: string; icon: IconName }[] = [
    { to: '/', label: '首页', icon: 'home' },
    { to: '/tools', label: '工具', icon: 'toolbox' },
    { to: '/messages', label: '消息', icon: 'message' },
    { to: '/me', label: '个人页', icon: 'user' },
  ]

  return (
    <nav className={styles.mobileBottomNav} aria-label="手机主导航">
      {items.slice(0, 2).map((item) => (
        <MobileNavItem key={item.to} {...item} unread={0} />
      ))}
      <NavLink to="/compose" className={styles.mobilePublish} aria-label="发布新帖">
        <span><Icon name="plus" /></span>
        <small>发布</small>
      </NavLink>
      {items.slice(2).map((item) => (
        <MobileNavItem key={item.to} {...item} unread={item.to === '/messages' ? unread : 0} />
      ))}
    </nav>
  )
}

function MobileNavItem({ to, label, icon, unread }: { to: string; label: string; icon: IconName; unread: number }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => isActive ? `${styles.mobileNavItem} ${styles.mobileNavItemOn}` : styles.mobileNavItem}
    >
      <span>
        <Icon name={icon} />
        {unread > 0 && <i>{unread > 99 ? '99+' : unread}</i>}
      </span>
      <small>{label}</small>
    </NavLink>
  )
}

function NavList({ unread = 0 }: { unread?: number }) {
  return (
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
          <Icon name={item.icon} />
          <span>{item.label}</span>
          {item.to === '/messages' && unread > 0 && (
            <span className={styles.navBadge}>{unread > 99 ? '99+' : unread}</span>
          )}
          <Icon name="chevronRight" className={styles.navArrow} />
        </NavLink>
      ))}
    </nav>
  )
}

function ProfileCard() {
  const { account } = useAuth()
  if (!account) return null
  return (
    <NavLink to="/me" className={styles.usercard}>
      <div className={styles.avatarLg}>{account.avatar || account.nickname.slice(0, 1)}</div>
      <div className={styles.userInfo}>
        <div className={styles.name}>{account.nickname}</div>
        {account.verified && <span className={styles.badge}><Icon name="check" /> 沈大学生</span>}
      </div>
      <Icon name="chevronRight" className={styles.userArrow} />
    </NavLink>
  )
}

function RightSidebar() {
  const { data: tools } = useQuery({ queryKey: ['tools'], queryFn: api.listTools })
  const { data: announcements } = useQuery({ queryKey: ['announcements'], queryFn: api.listAnnouncements })
  const { data: settings } = useQuery({ queryKey: ['public-settings'], queryFn: api.publicSettings })

  return (
    <>
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>百宝箱</h2>
          <NavLink to="/tools">查看全部</NavLink>
        </div>
        {(tools?.items ?? []).slice(0, 3).map((tool) => (
          <NavLink key={tool.id} to={tool.url || toolPaths[tool.type] || '/tools'} className={styles.toolRow}>
            <span className={styles.toolIcon}><Icon name={(tool.icon || 'toolbox') as IconName} /></span>
            <span><strong>{tool.name}</strong><small>{tool.type === 'ai' ? '查部门电话与官方资讯' : tool.type === 'map' ? '快速找到教学楼' : '教务、图书馆'}</small></span>
            <Icon name="chevronRight" />
          </NavLink>
        ))}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><h2>平台公告</h2><NavLink to="/announcements">查看全部</NavLink></div>
        {(announcements?.items ?? []).slice(0, 3).map((item) => (
          <NavLink key={item.id} className={styles.announcement} to={`/announcements/${item.id}`}>
            <span>{item.title}</span><small>{formatTime(item.created_at)}</small>
          </NavLink>
        ))}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><h2>热门话题</h2><small>运营推荐</small></div>
        <div className={styles.topicList}>
          {(settings?.hot_topics ?? []).map((topic, index) => (
            <NavLink key={topic} to={`/search?q=${encodeURIComponent(topic)}`}>
              <span>{String(index + 1).padStart(2, '0')}</span><strong># {topic}</strong>
            </NavLink>
          ))}
        </div>
      </section>
    </>
  )
}
