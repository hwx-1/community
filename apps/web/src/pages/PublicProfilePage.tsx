import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import PostCard from '../components/PostCard'
import { Avatar } from '../components/Avatar'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { api, ApiError } from '../api/client'
import { useAuth } from '../store/auth'
import { useToast } from '../components/Toast'
import styles from './AccountPage.module.css'

export default function PublicProfilePage() {
  const { userId } = useParams()
  const id = Number(userId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { account } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-profile', id],
    queryFn: () => api.getUser(id),
    enabled: Number.isFinite(id) && id > 0,
  })
  const user = data?.user
  const userPosts = (data?.posts ?? []).filter((post) => post.status === 'public')
  const isSelf = account?.id === user?.id

  const startChat = async () => {
    if (!user || busy) return
    setBusy(true)
    try {
      const { item } = await api.startDirectConversation(user.id)
      void queryClient.invalidateQueries({ queryKey: ['direct-conversations', account?.id] })
      navigate(`/messages/${item.id}`)
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '发起私信失败，请稍后重试', 'error')
      setBusy(false)
    }
  }

  const report = async () => {
    if (!user || busy) return
    const reason = window.prompt('请填写举报原因（必填）')
    if (!reason || !reason.trim()) return
    setBusy(true)
    try {
      const result = await api.reportUser(user.id, reason.trim())
      toast(result.message || '举报已提交，管理员会尽快处理', 'success')
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '举报提交失败，请稍后重试', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className={styles.publicHead}>
        <button type="button" aria-label="返回" onClick={() => navigate(-1)}><Icon name="arrowLeft" /></button>
        <span>公开主页</span>
        <span />
      </header>

      {isLoading && <div className={styles.publicEmpty}><Icon name="clock" />加载中…</div>}
      {(isError || (!isLoading && !user)) && (
        <div className={styles.publicEmpty}><Icon name="info" />没有找到这个用户</div>
      )}

      {user && (
        <>
          <section className={styles.publicProfile}>
            <div className={styles.publicAvatar}><Avatar value={user.avatar} fallback={user.nickname.slice(0, 1)} /></div>
            <div>
              <div>
                <h1>{user.nickname}</h1>
                <VerifiedBadge type={user.badge} showLabel />
              </div>
              <p>{user.gender || '未设置性别'}</p>
              <small>只展示公开资料与已公开帖子</small>
            </div>
            {!isSelf && (
              <div className={styles.publicActions}>
                <button type="button" disabled={busy} onClick={startChat}><Icon name="message" />发私信</button>
                <button className={styles.publicReport} type="button" disabled={busy} onClick={report}><Icon name="shield" />举报</button>
              </div>
            )}
          </section>

          <div className={styles.publicTitle}><h2>TA 的帖子</h2><span>{userPosts.length} 篇</span></div>
          {userPosts.length
            ? <div className={styles.userPosts}>{userPosts.map((post) => <PostCard key={post.id} post={post} />)}</div>
            : <div className={styles.publicEmpty}><Icon name="file" />暂无公开帖子</div>}
        </>
      )}
    </>
  )
}
