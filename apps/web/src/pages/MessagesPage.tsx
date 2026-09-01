import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Icon, { IconName } from '../components/Icon'
import { api, AppNotification, formatTime } from '../api/client'
import { useAuth } from '../store/auth'
import styles from './MessagesPage.module.css'

const notificationIcons: Record<AppNotification['type'], IconName> = {
  comment: 'message',
  reply: 'message',
  report_result: 'shield',
  official_answer: 'sparkles',
  punishment: 'info',
  appeal_result: 'bell',
}

export default function MessagesPage() {
  const [tab, setTab] = useState<'notice' | 'chat'>('chat')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { account } = useAuth()
  const { data } = useQuery({ queryKey: ['direct-conversations', account?.id], queryFn: api.listDirectConversations, refetchInterval: 5_000 })
  const conversations = data?.items ?? []

  const { data: noticeData } = useQuery({ queryKey: ['notifications', account?.id], queryFn: api.notifications })
  const notifications = noticeData?.items ?? []
  const unread = noticeData?.unread ?? 0

  const markRead = useMutation({
    mutationFn: (ids: number[]) => api.markNotificationsRead(ids),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications', account?.id] }),
  })

  const unreadDm = data?.unread ?? 0

  const openNotification = (item: AppNotification) => {
    if (!item.read) markRead.mutate([item.id])
    if (item.ref_type === 'post' && item.ref_id) navigate(`/posts/${item.ref_id}`)
  }

  const openConversation = (id: number) => {
    navigate(`/messages/${id}`)
  }

  return (
    <>
      <header className={styles.pageHead}><div><h1>消息</h1><p>通知和私信都在这里。</p></div></header>
      <div className={styles.tabs} role="tablist" aria-label="消息分类">
        <button role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? styles.active : ''} onClick={() => setTab('chat')}>私信 {unreadDm > 0 && <span>{unreadDm}</span>}</button>
        <button role="tab" aria-selected={tab === 'notice'} className={tab === 'notice' ? styles.active : ''} onClick={() => setTab('notice')}>通知 {unread > 0 && <span>{unread}</span>}</button>
      </div>

      <section className={styles.list} role="tabpanel">
        {tab === 'notice' ? (
          notifications.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}><Icon name="bell" /></span>
              <strong>暂无通知</strong>
              <span>评论、官方回答和举报处理结果会展示在这里。</span>
            </div>
          ) : notifications.map((item) => (
            <button key={item.id} className={styles.item} type="button" onClick={() => openNotification(item)}>
              <span className={styles.icon}><Icon name={notificationIcons[item.type] ?? 'bell'} /></span>
              <span className={styles.itemBody}>
                <strong className={item.read ? '' : styles.unreadTitle}>{item.title}</strong>
                <span>{item.body}</span>
                <small>{formatTime(item.created_at)}</small>
              </span>
              {!item.read && <span className={styles.unread} aria-label="未读" />}
              <Icon name="chevronRight" className={styles.arrow} />
            </button>
          ))
        ) : conversations.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}><Icon name="message" /></span>
            <strong>暂无私信</strong>
            <span>到同学的公开主页可以发起私信。</span>
          </div>
        ) : conversations.map((item) => {
          const last = item.messages[item.messages.length - 1]
          const convUnread = item.unread_count > 0
          return (
            <button key={item.id} className={styles.item} type="button" onClick={() => openConversation(item.id)}>
              <span className={styles.avatar}>{item.other.avatar || item.other.nickname.slice(0, 1)}</span>
              <span className={styles.itemBody}>
                <strong className={convUnread ? styles.unreadTitle : ''}>{item.other.nickname}</strong>
                <span className={item.unlocked ? '' : styles.locked}>
                  {!item.unlocked && <Icon name="lock" />}
                  {last ? (last.sender_id === account?.id ? `我：${last.text}` : last.text) : '开始聊天'}
                </span>
              </span>
              <time className={styles.itemTime}>{formatTime(item.updated_at)}</time>
              {convUnread && <span className={styles.unread} aria-label="未读" />}
            </button>
          )
        })}
      </section>
    </>
  )
}
