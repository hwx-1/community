import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Icon, { IconName } from '../components/Icon'
import PostCard from '../components/PostCard'
import { Avatar } from '../components/Avatar'
import { api, formatTime } from '../api/client'
import { useAuth } from '../store/auth'
import styles from './ProfilePage.module.css'

export default function ProfilePage() {
  const [tab, setTab] = useState<'posts' | 'saved'>('posts')
  const navigate = useNavigate()
  const { account, logout } = useAuth()
  const { data } = useQuery({ queryKey: ['my-posts'], queryFn: () => api.listPosts({ mine: true }) })
  const { data: bookmarkData } = useQuery({ queryKey: ['my-bookmarks'], queryFn: api.myBookmarks })
  const myPosts = data?.items ?? []
  const savedPosts = bookmarkData?.items ?? []

  const menuItems: { icon: IconName; label: string; note?: string; action: () => void }[] = [
    { icon: 'edit', label: '编辑资料', note: '头像、昵称、性别与班级', action: () => navigate('/me/edit') },
    { icon: 'shield', label: '学生认证与资料变更', note: account?.verified ? '认证已通过' : '未认证或审核中', action: () => navigate('/me/verification') },
    { icon: 'settings', label: '账号设置', note: '密码、会话与注销', action: () => navigate('/me/settings') },
    { icon: 'logout', label: '退出登录', action: () => { void logout().then(() => navigate('/login', { replace: true })) } },
  ]

  const joinedDays = account?.created_at ? Math.max(1, Math.floor((Date.now() - new Date(account.created_at).getTime()) / 86_400_000)) : 1

  return (
    <>
      <section className={styles.profileCard}>
        <div className={styles.profileTop}>
          <div className={styles.avatar}><Avatar value={account?.avatar} fallback={account?.nickname.slice(0, 1)} /></div>
          <div className={styles.profileMain}>
            <div className={styles.nameLine}><h1>{account?.nickname}</h1>{account?.verified && <span><Icon name="check" />沈大学生</span>}</div>
            <p>{account?.gender || '未设置'} · {account?.class_name || '未设置班级'}</p>
            <small>加入社区 {joinedDays} 天</small>
          </div>
          <button type="button" onClick={() => navigate('/me/edit')}><Icon name="edit" />编辑资料</button>
        </div>
        <div className={styles.stats} aria-label="个人统计">
          <div><strong>{myPosts.length}</strong><span>帖子</span></div>
          <div><strong>{savedPosts.length}</strong><span>收藏</span></div>
          <div><strong>{myPosts.reduce((sum, post) => sum + post.likes, 0)}</strong><span>获赞</span></div>
        </div>
      </section>

      <section className={styles.contentCard}>
        <div className={styles.tabs} role="tablist" aria-label="个人内容">
          <button role="tab" aria-selected={tab === 'posts'} className={tab === 'posts' ? styles.active : ''} onClick={() => setTab('posts')}>我的帖子<span>{myPosts.length}</span></button>
          <button role="tab" aria-selected={tab === 'saved'} className={tab === 'saved' ? styles.active : ''} onClick={() => setTab('saved')}>我的收藏<span>{savedPosts.length}</span></button>
        </div>
        {tab === 'posts' ? (
          myPosts.length === 0 ? (
            <div className={styles.empty}><Icon name="file" /><p>还没有发布过帖子</p></div>
          ) : (
            <div className={styles.feed}>
              {myPosts.map((post) => <PostCard key={post.id} post={post} />)}
            </div>
          )
        ) : (
          savedPosts.length === 0 ? (
            <div className={styles.empty}><Icon name="bookmark" /><p>还没有收藏内容</p></div>
          ) : savedPosts.map((post) => (
            <button key={post.id} className={styles.contentItem} type="button" onClick={() => navigate(`/posts/${post.id}`)}>
              <span className={styles.savedIcon}><Icon name="bookmark" /></span>
              <div><strong>{post.text.slice(0, 24)}{post.text.length > 24 ? '…' : ''}</strong><small>{formatTime(post.created_at)}</small></div>
              <Icon name="chevronRight" />
            </button>
          ))
        )}
      </section>

      <section className={styles.settingsCard}>
        <h2>更多设置</h2>
        {menuItems.map((item) => (
          <button key={item.label} type="button" onClick={item.action}>
            <Icon name={item.icon} /><span><strong>{item.label}</strong>{item.note && <small>{item.note}</small>}</span><Icon name="chevronRight" />
          </button>
        ))}
      </section>
    </>
  )
}
