import { useQuery } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import Icon from '../components/Icon'
import PostCard from '../components/PostCard'
import { api, formatTime } from '../api/client'
import { useAuth } from '../store/auth'
import styles from './HomePage.module.css'

export default function HomePage() {
  const { account } = useAuth()
  const { data, isLoading } = useQuery({ queryKey: ['posts'], queryFn: () => api.listPosts() })
  const { data: announcements } = useQuery({ queryKey: ['announcements'], queryFn: api.listAnnouncements })
  const { data: settings } = useQuery({ queryKey: ['public-settings'], queryFn: api.publicSettings })
  const posts = data?.items ?? []

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 6) return '夜深了'
    if (hour < 12) return '早上好'
    if (hour < 18) return '下午好'
    return '晚上好'
  }

  return (
    <>
      <section className={styles.welcome}>
        <div>
          <span className={styles.eyebrow}>SHENYANG UNIVERSITY COMMUNITY</span>
          <h1>{greeting()}，{account?.nickname ?? '同学'}</h1>
          <p>看看校园里正在发生什么。</p>
        </div>
        <NavLink to="/compose"><Icon name="edit" /> 发布新帖</NavLink>
      </section>

      <section className={styles.mobileInfo} aria-label="校园信息">
        <details>
          <summary><span><Icon name="bell" />平台公告</span><small>{announcements?.items.length ?? 0} 条</small></summary>
          {(announcements?.items ?? []).slice(0, 3).map((item) => (
            <NavLink key={item.id} to={`/announcements/${item.id}`}><p>{item.title}</p><span>{formatTime(item.created_at)}</span></NavLink>
          ))}
        </details>
        <details>
          <summary><span><Icon name="sparkles" />热门话题</span><small>运营推荐</small></summary>
          <div className={styles.mobileTopics}>
            {(settings?.hot_topics ?? []).map((topic) => (
              <NavLink key={topic} to={`/search?q=${encodeURIComponent(topic)}`}># {topic}</NavLink>
            ))}
          </div>
        </details>
      </section>

      <div className={styles.feedHead}>
        <div>
          <h2>最新动态</h2>
          <span>按发布时间倒序</span>
        </div>
      </div>

      {isLoading && <div className={styles.end}>正在加载…</div>}
      <div className={styles.feed}>
        {posts.map((post) => <PostCard key={post.id} post={post} />)}
      </div>
      {!isLoading && posts.length === 0 && <div className={styles.end}>还没有帖子，来发第一条吧</div>}

      {posts.length > 0 && <div className={styles.end}>已经看到这里了</div>}
    </>
  )
}
