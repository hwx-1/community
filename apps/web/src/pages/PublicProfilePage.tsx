import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import PostCard from '../components/PostCard'
import { api, ApiError } from '../api/client'
import { useAuth } from '../store/auth'
import styles from './AccountPage.module.css'

export default function PublicProfilePage() {
  const { userId } = useParams()
  const id = Number(userId)
  const navigate = useNavigate()
  const { account } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

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
    setError('')
    try {
      const { item } = await api.startDirectConversation(user.id)
      navigate(`/messages/${item.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '发起私信失败，请稍后重试')
      setBusy(false)
    }
  }

  const report = async () => {
    if (!user || busy) return
    const reason = window.prompt('请填写举报原因（必填）')
    if (!reason || !reason.trim()) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await api.reportUser(user.id, reason.trim())
      setNotice(result.message || '举报已提交，管理员会尽快处理')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '举报提交失败，请稍后重试')
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
            <div className={styles.publicAvatar}>{user.avatar || user.nickname.slice(0, 1)}</div>
            <div>
              <div>
                <h1>{user.nickname}</h1>
                {user.verified && <span><Icon name="check" />沈大学生</span>}
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

          {error && <p role="alert" style={{ color: 'var(--danger)', margin: '4px 2px', fontSize: 11 }}>{error}</p>}
          {notice && <p role="status" className={styles.inlineSuccess}><Icon name="check" />{notice}</p>}

          <div className={styles.publicTitle}><h2>TA 的帖子</h2><span>{userPosts.length} 篇</span></div>
          {userPosts.length
            ? <div className={styles.userPosts}>{userPosts.map((post) => <PostCard key={post.id} post={post} />)}</div>
            : <div className={styles.publicEmpty}><Icon name="file" />暂无公开帖子</div>}
        </>
      )}
    </>
  )
}
