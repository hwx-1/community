import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DirectConversationItem } from '../api/client'

interface DmReadState {
  /** 每个私信会话的最后已读时间(ISO 字符串) */
  dmLastRead: Record<number, string>
  markConversationRead: (id: number) => void
}

export const useDmRead = create<DmReadState>()(
  persist(
    (set) => ({
      dmLastRead: {},
      markConversationRead: (id) =>
        set((state) => ({ dmLastRead: { ...state.dmLastRead, [id]: new Date().toISOString() } })),
    }),
    { name: 'xsnbb-dm-read' },
  ),
)

/** 会话是否未读:最后一条消息来自对方,且晚于本地已读时间 */
export function isConversationUnread(conv: DirectConversationItem, myId: number | undefined, lastRead: Record<number, string>): boolean {
  const last = conv.messages[conv.messages.length - 1]
  if (!last || last.sender_id === myId) return false
  const readAt = lastRead[conv.id]
  return !readAt || new Date(last.created_at).getTime() > new Date(readAt).getTime()
}

export function countUnreadConversations(conversations: DirectConversationItem[], myId: number | undefined, lastRead: Record<number, string>): number {
  return conversations.filter((conv) => isConversationUnread(conv, myId, lastRead)).length
}
