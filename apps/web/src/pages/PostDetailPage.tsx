import { FormEvent, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import PostCard from '../components/PostCard'
import { api, CommentItem, formatTime } from '../api/client'
import { useAuth } from '../store/auth'
import styles from './PostDetailPage.module.css'

// 知乎式举报原因分类
const REPORT_REASONS = ['垃圾广告信息', '辱骂、歧视或恶意攻击', '淫秽色情或令人不适内容', '谣言或虚假信息', '违法犯罪或违规内容', '涉嫌侵权', '其他']

type ReportTarget = { kind: 'post' | 'comment'; id: number }

export default function PostDetailPage() {
  const { postId } = useParams()
  const id = Number(postId)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const { account } = useAuth()
  const [content, setContent] = useState('')
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null)
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(params.get('report') === '1' ? { kind: 'post', id: Number(postId) } : null)
  const [notice, setNotice] = useState('')
  const composerRef = useRef<HTMLTextAreaElement>(null)

  const { data, isLoading, isError } = useQuery({ queryKey: ['post', id], queryFn: () => api.getPost(id), enabled: Number.isFinite(id), retry: false })
  const { data: commentsData, refetch: refetchComments } = useQuery({ queryKey: ['comments', id], queryFn: () => api.listComments(id), enabled: Number.isFinite(id) })
  const comments = commentsData?.items ?? []
  const topLevel = comments.filter((item) => !item.parent_id)

  // 回复可以挂在任意层级上，前端按“根评论”归组，呈现为抖音式两级列表
  const byId = new Map(comments.map((item) => [item.id, item]))
  const rootIdOf = (item: CommentItem): number => {
    let current = item
    while (current.parent_id) {
      const parent = byId.get(current.parent_id)
      if (!parent) break
      current = parent
    }
    return current.id
  }
  const repliesOf = (root: CommentItem) => comments.filter((item) => item.parent_id && rootIdOf(item) === root.id)

  const commentMutation = useMutation({
    mutationFn: () => api.createComment(id, { text: content.trim(), parent_id: replyTo?.id }),
    onSuccess: ({ message }) => {
      setContent('')
      setReplyTo(null)
      setNotice(message)
      void refetchComments()
      void queryClient.invalidateQueries({ queryKey: ['post', id] })
    },
    onError: (err) => setNotice(err instanceof Error ? err.message : '评论失败'),
  })

  // 点击评论（或“回复”按钮）唤起回复：聚焦输入框并带上回复目标
  const startReply = (comment: CommentItem) => {
    if (comment.deleted) return
    setReplyTo(comment)
    setNotice('')
    requestAnimationFrame(() => {
      composerRef.current?.focus()
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
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
        <button type="button" onClick={() => setReportTarget({ kind: 'post', id })}>举报</button>
      </header>

      <PostCard post={data.post} variant="detail" />

      <section className={styles.commentComposer}>
        <div className={styles.avatar}>{account?.avatar || account?.nickname.slice(0, 1)}</div>
        <form onSubmit={submitComment}>
          <label htmlFor="comment-content">{replyTo ? '发表回复' : '发表评论'}</label>
          {replyTo && (
            <div className={styles.replyBar}>
              <span>回复 <strong>@{replyTo.author.nickname}</strong>：{replyTo.text.length > 30 ? `${replyTo.text.slice(0, 30)}…` : replyTo.text}</span>
              <button type="button" aria-label="取消回复" onClick={() => setReplyTo(null)}><Icon name="close" /></button>
            </div>
          )}
          <textarea id="comment-content" ref={composerRef} maxLength={500} value={content} onChange={(event) => setContent(event.target.value)} placeholder={replyTo ? `回复 @${replyTo.author.nickname}…` : '友善交流，分享你的想法…'} />
          <div className={styles.composerFoot}>
            <span>{content.length} / 500</span>
            <button type="submit" disabled={!content.trim() || commentMutation.isPending}>{replyTo ? '发表回复' : '发表评论'}</button>
          </div>
          {notice && <p role="status" style={{ color: 'var(--text-muted)' }}>{notice}</p>}
        </form>
      </section>

      <section className={styles.comments}>
        <header><h2>全部评论</h2><span>{topLevel.length} 条主评论</span></header>
        {topLevel.map((comment) => {
          const replies = repliesOf(comment)
          return (
            <article key={comment.id} className={styles.comment}>
              <div className={styles.avatar}>{comment.author.avatar || comment.author.nickname.slice(0, 1)}</div>
              <div className={styles.commentBody}>
                <div className={styles.commentMeta}>
                  {comment.deleted ? <strong>{comment.author.nickname}</strong> : <Link to={`/users/${comment.author.id}`}>{comment.author.nickname}</Link>}
                  <span>{formatTime(comment.created_at)}</span>
                  {comment.status !== 'public' && !comment.deleted && <em>审核中或未通过，仅你可见</em>}
                </div>
                {comment.deleted ? <p className={styles.deleted}>该评论已删除</p> : (
                  <p className={styles.commentText} onClick={() => startReply(comment)} title="点击回复">{comment.text}</p>
                )}
                {!comment.deleted && (
                  <div className={styles.commentActions}>
                    <button type="button" onClick={() => startReply(comment)}>回复</button>
                    <button type="button" onClick={() => setReportTarget({ kind: 'comment', id: comment.id })}>举报</button>
                  </div>
                )}
                {replies.length > 0 && (
                  <div className={styles.replies}>
                    {replies.map((reply) => {
                      const parent = reply.parent_id ? byId.get(reply.parent_id) : undefined
                      const replyToName = parent && parent.id !== comment.id ? parent.author.nickname : ''
                      return (
                        <div key={reply.id} className={styles.reply}>
                          <div className={`${styles.avatar} ${styles.avatarSm}`}>{reply.author.avatar || reply.author.nickname.slice(0, 1)}</div>
                          <div className={styles.replyBody}>
                            <div className={styles.commentMeta}>
                              {reply.deleted ? <strong>{reply.author.nickname}</strong> : <Link to={`/users/${reply.author.id}`}>{reply.author.nickname}</Link>}
                              {replyToName && <span className={styles.replyToTag}>回复 @{replyToName}</span>}
                              <span>{formatTime(reply.created_at)}</span>
                              {reply.status !== 'public' && !reply.deleted && <em>审核中或未通过，仅你可见</em>}
                            </div>
                            {reply.deleted ? <p className={styles.deleted}>该评论已删除</p> : (
                              <p className={styles.commentText} onClick={() => startReply(reply)} title="点击回复">{reply.text}</p>
                            )}
                            {!reply.deleted && (
                              <div className={styles.commentActions}>
                                <button type="button" onClick={() => startReply(reply)}>回复</button>
                                <button type="button" onClick={() => setReportTarget({ kind: 'comment', id: reply.id })}>举报</button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {comment.deleted && <span className={styles.replyClosed}><Icon name="lock" />主评论已删除，不能继续回复</span>}
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </section>

      {reportTarget && <ReportDialog target={reportTarget} onClose={() => setReportTarget(null)} />}
    </div>
  )
}

// 知乎式举报弹窗：遮罩 + 居中卡片，单选原因 + 补充说明
function ReportDialog({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const [reason, setReason] = useState(REPORT_REASONS[0])
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const fullReason = detail.trim() ? `${reason}：${detail.trim()}` : reason
      if (target.kind === 'post') await api.reportPost(target.id, fullReason)
      else await api.reportComment(target.id, fullReason)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '举报失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.reportMask} onClick={onClose}>
      <div className={styles.reportDialog} role="dialog" aria-modal="true" aria-label="举报" onClick={(event) => event.stopPropagation()}>
        <header className={styles.reportHead}>
          <strong>{done ? '举报已提交' : `举报${target.kind === 'post' ? '帖子' : '评论'}`}</strong>
          <button type="button" aria-label="关闭" onClick={onClose}><Icon name="close" /></button>
        </header>
        {done ? (
          <div className={styles.reportDone}>
            <Icon name="check" />
            <p>感谢反馈，内容将暂时隐藏并进入复核流程，处理结果会通过通知告知你。</p>
            <button type="button" onClick={onClose}>完成</button>
          </div>
        ) : (
          <>
            <div className={styles.reportBody}>
              <p className={styles.reportTip}>请选择最符合的原因，管理员不会向对方透露你的身份。</p>
              <div className={styles.reasonList} role="radiogroup" aria-label="举报原因">
                {REPORT_REASONS.map((item) => (
                  <label key={item} className={item === reason ? styles.reasonOn : ''}>
                    <input type="radio" name="report-reason" checked={item === reason} onChange={() => setReason(item)} />
                    {item}
                  </label>
                ))}
              </div>
              <textarea maxLength={200} value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="补充说明（选填，200 字以内）" />
              {error && <p role="alert" className={styles.reportError}>{error}</p>}
            </div>
            <footer className={styles.reportFoot}>
              <button type="button" onClick={onClose}>取消</button>
              <button type="button" disabled={busy} onClick={() => void submit()}>提交举报</button>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
