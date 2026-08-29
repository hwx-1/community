import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import PostCard from '../components/PostCard'
import { api, formatTime } from '../api/client'
import { useAuth } from '../store/auth'
import styles from './PostDetailPage.module.css'

export default function PostDetailPage() {
  const { postId } = useParams()
  const id = Number(postId)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const { account } = useAuth()
  const [content, setContent] = useState('')
  const [reportOpen, setReportOpen] = useState(params.get('report') === '1')
  const [reported, setReported] = useState(false)
  const [notice, setNotice] = useState('')

  const { data, isLoading, isError } = useQuery({ queryKey: ['post', id], queryFn: () => api.getPost(id), enabled: Number.isFinite(id), retry: false })
  const { data: commentsData, refetch: refetchComments } = useQuery({ queryKey: ['comments', id], queryFn: () => api.listComments(id), enabled: Number.isFinite(id) })
  const comments = commentsData?.items ?? []
  const topLevel = comments.filter((item) => !item.parent_id)

  const commentMutation = useMutation({
    mutationFn: () => api.createComment(id, { text: content.trim() }),
    onSuccess: ({ message }) => {
      setContent('')
      setNotice(message)
      void refetchComments()
      void queryClient.invalidateQueries({ queryKey: ['post', id] })
    },
    onError: (err) => setNotice(err instanceof Error ? err.message : '评论失败'),
  })

  const report = async (reason: string) => {
    try {
      await api.reportPost(id, reason)
      setReported(true)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '举报失败')
    }
  }

  const submitComment = (event: FormEvent) => {
    event.preventDefault()
    if (!content.trim()) return
    commentMutation.mutate()
  }

  if (isLoading) return <section className={styles.notFound}><h1>正在加载…</h1></section>
  if (isError || !data) return <section className={styles.notFound}><Icon name="file" /><h1>帖子不存在或已删除</h1><button type="button" onClick={() => navigate('/')}>返回首页</button></section>

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <button type="button" onClick={() => navigate(-1)}><Icon name="arrowLeft" />返回</button>
        <span>帖子详情</span>
        <button type="button" onClick={() => setReportOpen(!reportOpen)}>举报</button>
      </header>

      {reportOpen && (
        <section className={styles.reportBox} aria-live="polite">
          {reported ? <><Icon name="check" /><div><strong>举报已提交</strong><p>内容将暂时隐藏并进入复核流程。</p></div></> : <><Icon name="info" /><div><strong>举报此帖子</strong><p>请选择最符合的原因，管理员不会向对方透露你的身份。</p><div className={styles.reportActions}><button type="button" onClick={() => report('不友善或骚扰')}>不友善或骚扰</button><button type="button" onClick={() => report('虚假信息')}>虚假信息</button><button type="button" onClick={() => report('其他')}>其他</button></div></div></>}
        </section>
      )}

      <PostCard post={data.post} variant="detail" />

      <section className={styles.commentComposer}>
        <div className={styles.avatar}>{account?.avatar || account?.nickname.slice(0, 1)}</div>
        <form onSubmit={submitComment}>
          <label htmlFor="comment-content">发表评论</label>
          <textarea id="comment-content" maxLength={500} value={content} onChange={(event) => setContent(event.target.value)} placeholder="友善交流，分享你的想法…" />
          <div className={styles.composerFoot}>
            <span>{content.length} / 500</span>
            <button type="submit" disabled={!content.trim() || commentMutation.isPending}>发表评论</button>
          </div>
          {notice && <p role="status" style={{ color: 'var(--text-muted)' }}>{notice}</p>}
        </form>
      </section>

      <section className={styles.comments}>
        <header><h2>全部评论</h2><span>{topLevel.length} 条主评论</span></header>
        {topLevel.map((comment) => {
          const replies = comments.filter((item) => item.parent_id === comment.id)
          return (
            <article key={comment.id} className={styles.comment}>
              <div className={styles.avatar}>{comment.author.avatar || comment.author.nickname.slice(0, 1)}</div>
              <div className={styles.commentBody}>
                <div className={styles.commentMeta}>
                  {comment.deleted ? <strong>{comment.author.nickname}</strong> : <Link to={`/users/${comment.author.id}`}>{comment.author.nickname}</Link>}
                  <span>{formatTime(comment.created_at)}</span>
                  {comment.status !== 'public' && !comment.deleted && <em>审核中或未通过，仅你可见</em>}
                </div>
                {comment.deleted ? <p className={styles.deleted}>该评论已删除</p> : <p>{comment.text}</p>}
                {!comment.deleted && (
                  <div className={styles.commentActions}>
                    <button type="button" onClick={async () => { try { await api.reportComment(comment.id, '不友善或违规内容'); setNotice('举报已提交') } catch { /* 忽略重复举报 */ } }}>举报</button>
                  </div>
                )}
                {replies.length > 0 && (
                  <div className={styles.replies}>
                    {replies.map((reply) => <p key={reply.id}><strong>{reply.author.nickname}</strong>：{reply.text}<small>{formatTime(reply.created_at)}</small></p>)}
                    {comment.deleted && <span className={styles.replyClosed}><Icon name="lock" />主评论已删除，不能继续回复</span>}
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}
