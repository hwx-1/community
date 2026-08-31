// API 客户端：Cookie 会话 + CSRF 头，统一错误结构。
// 所有密钥只存在服务端；本客户端不持有任何凭证。

export interface PublicAccount {
  id: number
  nickname: string
  avatar: string
  gender: string
  verified: boolean
}

export interface Account extends PublicAccount {
  phone?: string
  real_name?: string
  student_no?: string
  class_name?: string
  profile_done: boolean
  status: string
  created_at: string
}

export interface Post {
  id: number
  author: PublicAccount
  text: string
  images: string[] | null
  tags: string[] | null
  status: string // public / pending / rejected / reported_hidden / removed / deleted
  pinned: boolean
  likes: number
  comments: number
  liked: boolean
  bookmarked: boolean
  created_at: string
  updated_at: string
}

export interface CommentItem {
  id: number
  post_id: number
  parent_id?: number
  author: PublicAccount
  text: string
  image?: string
  status: string
  deleted: boolean
  created_at: string
}

export interface Announcement {
  id: number
  title: string
  summary: string
  body: string
  image_url?: string
  link_url?: string
  link_text?: string
  published: boolean
  created_at: string
  updated_at: string
  published_at?: string
}

export interface Tool {
  id: number
  name: string
  type: string
  icon: string
  url?: string
  weight: number
  enabled: boolean
}

export interface AIModel {
  id: number
  name: string
  model: string
  enabled: boolean
  public: boolean
}

export interface AIMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  model?: string
  source?: string
  created_at: string
}

export interface AIConversation {
  id: number
  title: string
  model: string
  messages: AIMessage[]
  created_at: string
}

export interface DirectMessage {
  id: number
  sender_id: number
  text: string
  system: boolean
  status: string
  created_at: string
}

export interface DirectConversationItem {
  id: number
  other: PublicAccount
  unlocked: boolean
  messages: DirectMessage[]
  updated_at: string
}

export interface PublicSettings {
  hot_topics: string[]
  greeting: string
}

export type VerificationStatus = 'pending' | 'approved' | 'rejected'

export interface MyVerification {
  id: number
  status: VerificationStatus
  reject_reason?: string
  real_name: string
  student_no: string
  created_at: string
}

export interface AppNotification {
  id: number
  type: 'comment' | 'reply' | 'report_result' | 'official_answer' | 'punishment' | 'appeal_result'
  title: string
  body: string
  ref_type?: string
  ref_id?: number
  read: boolean
  created_at: string
}

export class ApiError extends Error {
  code: string
  status: number
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)xsnbb_csrf=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') headers['X-CSRF-Token'] = csrfToken()
  const resp = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (resp.status === 204) return undefined as T
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const err = (data as { error?: { code?: string; message?: string } }).error
    throw new ApiError(resp.status, err?.code ?? 'UNKNOWN', err?.message ?? '请求失败，请稍后重试')
  }
  return data as T
}

export interface ModerationInfo {
  pass: boolean
  category?: string
  reason?: string
  dev_mode: boolean
}

export const api = {
  // 认证
  smsCode: (phone: string, purpose: 'register' | 'reset') =>
    request<{ sent: boolean; dev_mode: boolean; dev_code?: string; expires_in: number }>('POST', '/api/v1/auth/sms-code', { phone, purpose }),
  register: (input: { phone: string; code: string; password: string; nickname?: string; invite_code: string }) =>
    request<{ account: Account }>('POST', '/api/v1/auth/register', input),
  login: (phone: string, password: string) =>
    request<{ account: Account }>('POST', '/api/v1/auth/login', { phone, password }),
  logout: () => request<void>('POST', '/api/v1/auth/logout', {}),
  resetPassword: (phone: string, code: string, password: string) =>
    request<{ reset: boolean }>('POST', '/api/v1/auth/reset-password', { phone, code, password }),
  me: () => request<{ account: Account }>('GET', '/api/v1/me'),
  updateProfile: (input: { nickname: string; avatar: string; gender: string; real_name: string; student_no: string; class_name: string }) =>
    request<{ account: Account }>('PUT', '/api/v1/me/profile', input),
  submitVerification: (input: { material_url: string; real_name: string; student_no: string }) =>
    request<{ verification: unknown }>('POST', '/api/v1/me/verification', input),
  myVerification: () => request<{ verification: MyVerification | null }>('GET', '/api/v1/me/verification'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ changed: boolean }>('POST', '/api/v1/me/password', { current_password: currentPassword, new_password: newPassword }),
  deleteAccount: () => request<void>('DELETE', '/api/v1/me'),
  myBookmarks: () => request<{ items: Post[] }>('GET', '/api/v1/me/bookmarks'),
  notifications: () => request<{ items: AppNotification[]; unread: number }>('GET', '/api/v1/me/notifications'),
  markNotificationsRead: (ids?: number[]) =>
    request<{ unread: number }>('POST', '/api/v1/me/notifications/read', { ids: ids ?? [] }),

  // 帖子与互动
  listPosts: (params?: { q?: string; mine?: boolean }) => {
    const search = new URLSearchParams()
    if (params?.q) search.set('q', params.q)
    if (params?.mine) search.set('mine', '1')
    const suffix = search.toString() ? `?${search}` : ''
    return request<{ items: Post[] }>('GET', `/api/v1/posts${suffix}`)
  },
  getPost: (id: number) => request<{ post: Post }>('GET', `/api/v1/posts/${id}`),
  createPost: (input: { text: string; images: string[]; tags: string[] }) =>
    request<{ post: Post; moderation: ModerationInfo; message: string }>('POST', '/api/v1/posts', input),
  updatePost: (id: number, input: { text: string; images: string[]; tags: string[] }) =>
    request<{ post: Post; message: string }>('PUT', `/api/v1/posts/${id}`, input),
  deletePost: (id: number) => request<void>('DELETE', `/api/v1/posts/${id}`),
  likePost: (id: number) => request<{ post: Post }>('POST', `/api/v1/posts/${id}/like`, {}),
  bookmarkPost: (id: number) => request<{ post: Post }>('POST', `/api/v1/posts/${id}/bookmark`, {}),
  listComments: (postId: number) => request<{ items: CommentItem[] }>('GET', `/api/v1/posts/${postId}/comments`),
  createComment: (postId: number, input: { text: string; image?: string; parent_id?: number }) =>
    request<{ comment: CommentItem; moderation: ModerationInfo; message: string }>('POST', `/api/v1/posts/${postId}/comments`, input),
  reportPost: (id: number, reason: string) => request<{ message: string }>('POST', `/api/v1/posts/${id}/reports`, { reason }),
  reportComment: (id: number, reason: string) => request<{ message: string }>('POST', `/api/v1/comments/${id}/reports`, { reason }),
  getUser: (id: number) => request<{ user: PublicAccount; posts: Post[] }>('GET', `/api/v1/users/${id}`),
  reportUser: (id: number, reason: string) => request<{ message: string }>('POST', `/api/v1/users/${id}/reports`, { reason }),
  listTags: () => request<{ items: string[] }>('GET', '/api/v1/tags'),

  // 公告、工具与公开配置
  listAnnouncements: () => request<{ items: Announcement[] }>('GET', '/api/v1/announcements'),
  getAnnouncement: (id: number) => request<{ announcement: Announcement }>('GET', `/api/v1/announcements/${id}`),
  listTools: () => request<{ items: Tool[] }>('GET', '/api/v1/tools'),
  publicSettings: () => request<PublicSettings>('GET', '/api/v1/settings/public'),

  // 私信
  listDirectConversations: () => request<{ items: DirectConversationItem[] }>('GET', '/api/v1/direct-conversations'),
  startDirectConversation: (userId: number) =>
    request<{ item: DirectConversationItem }>('POST', '/api/v1/direct-conversations', { user_id: userId }),
  getDirectConversation: (id: number) =>
    request<{ conversation: { id: number; messages: DirectMessage[] }; other: PublicAccount; unlocked: boolean }>('GET', `/api/v1/direct-conversations/${id}`),
  sendDirectMessage: (id: number, text: string, system: boolean) =>
    request<{ message: DirectMessage; unlocked: boolean }>('POST', `/api/v1/direct-conversations/${id}/messages`, { text, system }),

  // AI 问答
  aiModels: () => request<{ items: AIModel[] }>('GET', '/api/v1/ai/models'),
  aiConversations: () => request<{ items: AIConversation[]; remaining: number }>('GET', '/api/v1/ai/conversations'),
  createAIConversation: (title?: string, model?: string) =>
    request<{ conversation: AIConversation }>('POST', '/api/v1/ai/conversations', { title, model }),
  deleteAIConversation: (id: number) => request<void>('DELETE', `/api/v1/ai/conversations/${id}`),
  askAI: (id: number, text: string, model?: string) =>
    request<{ user_message: AIMessage; answer: AIMessage; remaining: number }>('POST', `/api/v1/ai/conversations/${id}/messages`, { text, model }),

  // 上传
  upload: async (file: File): Promise<{ url: string; dev_mode: boolean }> => {
    const form = new FormData()
    form.append('file', file)
    const resp = await fetch('/api/v1/uploads', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRF-Token': csrfToken() },
      body: form,
    })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      const err = (data as { error?: { code?: string; message?: string } }).error
      throw new ApiError(resp.status, err?.code ?? 'UNKNOWN', err?.message ?? '上传失败')
    }
    return data as { url: string; dev_mode: boolean }
  },
}

// 相对时间展示
export function formatTime(iso: string): string {
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return ''
  const diff = Date.now() - time
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`
  const d = new Date(time)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
