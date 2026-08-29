import { FormEvent, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { api, ApiError, formatTime } from '../api/client'
import { useAuth } from '../store/auth'
import { useDmRead } from '../store/unread'
import styles from './ChatPage.module.css'

export default function ChatPage() {
  const { conversationId = '0' } = useParams()
  const id = Number(conversationId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { account } = useAuth()
  const [text, setText] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const { data } = useQuery({
    queryKey: ['direct-conversation', id],
    queryFn: () => api.getDirectConversation(id),
    enabled: Number.isFinite(id) && id > 0,
    refetchInterval: 5000, // 首版用轮询代替 WebSocket
  })
  const { data: settings } = useQuery({ queryKey: ['public-settings'], queryFn: api.publicSettings })

  const other = data?.other
  const messages = data?.conversation.messages ?? []
  const unlocked = data?.unlocked ?? false
  const greeting = settings?.greeting ?? '你好，我想和你聊聊'

  // 进入会话即视为已读;轮询拉到最后一条对方消息的时间也同步已读
  const markConversationRead = useDmRead((state) => state.markConversationRead)
  const lastMessageAt = messages[messages.length - 1]?.created_at
  useEffect(() => {
    if (Number.isFinite(id) && id > 0 && lastMessageAt) markConversationRead(id)
  }, [id, lastMessageAt, markConversationRead])

  const send = async (content: string, system: boolean) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await api.sendDirectMessage(id, content, system)
      await queryClient.invalidateQueries({ queryKey: ['direct-conversation', id] })
      setText('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '发送失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim() || !unlocked) return
    void send(text.trim(), false)
  }

  if (!other) return <section className={styles.chatShell}><header className={styles.chatHead}><button type="button" onClick={() => navigate('/messages')} aria-label="返回消息"><Icon name="arrowLeft" /></button><div><strong>会话不存在</strong></div></header></section>

  return (
    <section className={styles.chatShell}>
      <header className={styles.chatHead}>
        <button type="button" onClick={() => navigate('/messages')} aria-label="返回消息"><Icon name="arrowLeft" /></button>
        <span className={styles.avatar}>{other.avatar || other.nickname.slice(0, 1)}</span>
        <div><strong>{other.nickname}</strong><small>{unlocked ? '可以发送消息' : '等待双方回复内置消息'}</small></div>
        <button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label="会话设置"><Icon name="more" /></button>
      </header>

      {menuOpen && <div className={styles.chatMenu}><p>私信举报与拉黑功能将在后续版本开放；当前如遇骚扰请截图后联系管理员。</p></div>}

      <div className={styles.privacyNote}><Icon name="shield" />私信会经过内容安全检查；平台在必要时可按权限查看。</div>

      <div className={styles.messages} aria-live="polite">
        {messages.map((message) => {
          const mine = message.sender_id === account?.id
          return (
            <div key={message.id} className={mine ? `${styles.messageRow} ${styles.mine}` : styles.messageRow}>
              {!mine && <span className={styles.avatar}>{other.avatar || other.nickname.slice(0, 1)}</span>}
              <div>
                {message.system && <small>系统内置消息</small>}
                <p>{message.text}</p>
                <time>{formatTime(message.created_at)}</time>
                {message.status === 'blocked' && mine && <small style={{ color: 'var(--danger)' }}>未通过内容检查，未送达</small>}
              </div>
            </div>
          )
        })}
      </div>

      {error && <p role="alert" style={{ color: 'var(--danger)', padding: '0 16px' }}>{error}</p>}

      {!unlocked ? (
        <div className={styles.handshake}>
          <Icon name="lock" />
          <div><strong>回复后解锁自由聊天</strong><p>首次联系双方各回复一条内置消息后，才可发送自由文字。</p></div>
          <button type="button" disabled={busy} onClick={() => send(greeting, true)}>回复“{greeting}”</button>
        </div>
      ) : (
        <form className={styles.composer} onSubmit={submit}>
          <label className="srOnly" htmlFor="chat-message">输入消息</label>
          <textarea id="chat-message" maxLength={500} rows={1} value={text} onChange={(event) => setText(event.target.value)} placeholder="输入消息…" />
          <button type="submit" aria-label="发送消息" disabled={!text.trim() || busy}><Icon name="send" /></button>
        </form>
      )}
    </section>
  )
}
