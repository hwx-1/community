import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { Avatar } from '../components/Avatar'
import { api, ApiError, DirectConversationResponse, DirectConversationsResponse, formatTime } from '../api/client'
import { useAuth } from '../store/auth'
import { useToast } from '../components/Toast'
import styles from './ChatPage.module.css'

export default function ChatPage() {
  const { conversationId = '0' } = useParams()
  const id = Number(conversationId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { account } = useAuth()
  const [text, setText] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const detailKey = ['direct-conversation', account?.id, id] as const
  const listKey = ['direct-conversations', account?.id] as const

  const { data, dataUpdatedAt } = useQuery({
    queryKey: detailKey,
    queryFn: () => api.getDirectConversation(id),
    enabled: !!account && Number.isFinite(id) && id > 0,
    refetchInterval: 5000, // 首版用轮询代替 WebSocket
  })
  const { data: settings } = useQuery({ queryKey: ['public-settings'], queryFn: api.publicSettings })

  const other = data?.other
  const messages = data?.conversation.messages ?? []
  const unlocked = data?.unlocked ?? false
  const greeting = settings?.greeting ?? '你好，我想和你聊聊'

  // 消息区内部滚动：新消息到达时，若用户本来就在底部附近（或刚发了消息），自动滚到底部
  const lastMessage = messages[messages.length - 1]
  useEffect(() => {
    const box = messagesRef.current
    if (!box) return
    if (nearBottomRef.current || lastMessage?.sender_id === account?.id) {
      box.scrollTop = box.scrollHeight
    }
  }, [lastMessage?.id, account?.id])

  // 服务端是已读状态的唯一来源；每次轮询发现新未读消息后立即持久化已读，
  // 并同步更新详情、会话列表和全局红点缓存。
  const unreadCount = data?.conversation.unread_count ?? 0
  useEffect(() => {
    if (!account || unreadCount <= 0) return
    let cancelled = false
    void api.markDirectConversationRead(id).then(({ unread }) => {
      if (cancelled) return
      queryClient.setQueryData<DirectConversationResponse>(detailKey, (current) => current ? {
        ...current,
        conversation: {
          ...current.conversation,
          unread_count: 0,
          messages: current.conversation.messages.map((message) =>
            message.sender_id !== account.id && message.status === 'delivered'
              ? { ...message, status: 'read' }
              : message),
        },
      } : current)
      queryClient.setQueryData<DirectConversationsResponse>(listKey, (current) => current ? {
        ...current,
        unread,
        items: current.items.map((item) => item.id === id ? {
          ...item,
          unread_count: 0,
          messages: item.messages.map((message) =>
            message.sender_id !== account.id && message.status === 'delivered'
              ? { ...message, status: 'read' }
              : message),
        } : item),
      } : current)
    }).catch(() => {
      // 保留服务端未读状态；下一次详情轮询会自动重试。
    })
    return () => { cancelled = true }
  }, [account?.id, dataUpdatedAt, id, queryClient, unreadCount])

  const send = async (content: string, system: boolean) => {
    if (busy) return
    setBusy(true)
    try {
      const result = await api.sendDirectMessage(id, content, system)
      queryClient.setQueryData<DirectConversationResponse>(detailKey, (current) => {
        if (!current || current.conversation.messages.some((message) => message.id === result.message.id)) return current
        return {
          ...current,
          unlocked: result.unlocked,
          conversation: {
            ...current.conversation,
            messages: [...current.conversation.messages, result.message],
            updated_at: result.message.created_at,
          },
        }
      })
      queryClient.setQueryData<DirectConversationsResponse>(listKey, (current) => {
        if (!current) return current
        const existing = current.items.find((item) => item.id === id)
        if (!existing) return current
        const messages = existing.messages.some((message) => message.id === result.message.id)
          ? existing.messages
          : [...existing.messages, result.message]
        const updated = { ...existing, messages, unlocked: result.unlocked, updated_at: result.message.created_at }
        return { ...current, items: [updated, ...current.items.filter((item) => item.id !== id)] }
      })
      void queryClient.invalidateQueries({ queryKey: listKey })
      setText('')
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '发送失败，请稍后重试', 'error')
    } finally {
      setBusy(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim() || !unlocked) return
    void send(text.trim(), false)
  }

  // 回车直接发送，Shift+回车换行；isComposing 防止中文输入法选词时误发
  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!text.trim() || !unlocked || busy) return
    void send(text.trim(), false)
  }

  // 记录用户是否停留在消息区底部附近，决定新消息是否自动跟随
  const onMessagesScroll = () => {
    const box = messagesRef.current
    if (!box) return
    nearBottomRef.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80
  }

  if (!other) return <section className={styles.chatShell}><header className={styles.chatHead}><button type="button" onClick={() => navigate('/messages')} aria-label="返回消息"><Icon name="arrowLeft" /></button><div><strong>会话不存在</strong></div></header></section>

  return (
    <section className={styles.chatShell}>
      <header className={styles.chatHead}>
        <button type="button" onClick={() => navigate('/messages')} aria-label="返回消息"><Icon name="arrowLeft" /></button>
        <span className={styles.avatar}><Avatar value={other.avatar} fallback={other.nickname.slice(0, 1)} /></span>
        <div><strong>{other.nickname}</strong><small>{unlocked ? '可以发送消息' : '等待双方回复内置消息'}</small></div>
        <button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label="会话设置"><Icon name="more" /></button>
      </header>

      {menuOpen && <div className={styles.chatMenu}><p>私信举报与拉黑功能将在后续版本开放；当前如遇骚扰请截图后联系管理员。</p></div>}

      <div className={styles.privacyNote}><Icon name="shield" />私信会经过内容安全检查；平台在必要时可按权限查看。</div>

      <div className={styles.messages} aria-live="polite" ref={messagesRef} onScroll={onMessagesScroll}>
        {messages.map((message) => {
          const mine = message.sender_id === account?.id
          return (
            <div key={message.id} className={mine ? `${styles.messageRow} ${styles.mine}` : styles.messageRow}>
              {!mine && <span className={styles.avatar}><Avatar value={other.avatar} fallback={other.nickname.slice(0, 1)} /></span>}
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

      {!unlocked ? (
        <div className={styles.handshake}>
          <Icon name="lock" />
          <div><strong>回复后解锁自由聊天</strong><p>首次联系双方各回复一条内置消息后，才可发送自由文字。</p></div>
          <button type="button" disabled={busy} onClick={() => send(greeting, true)}>回复“{greeting}”</button>
        </div>
      ) : (
        <form className={styles.composer} onSubmit={submit}>
          <label className="srOnly" htmlFor="chat-message">输入消息</label>
          <textarea id="chat-message" maxLength={500} rows={1} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={onComposerKeyDown} placeholder="输入消息，回车发送，Shift+回车换行" />
          <button type="submit" aria-label="发送消息" disabled={!text.trim() || busy}><Icon name="send" /></button>
        </form>
      )}
    </section>
  )
}
