import type {
  Account,
  Admin,
  AdminAccount,
  AIProvider,
  Announcement,
  AppealItem,
  AuditLog,
  Comment,
  Dashboard,
  KBEntry,
  PendingQuestion,
  Post,
  ReportItem,
  Role,
  Settings,
  Tool,
  Verification,
} from './types'

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)xsnbb_admin_csrf=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method.toUpperCase() !== 'GET') headers['X-CSRF-Token'] = csrfToken()

  const res = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return undefined as T

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)
      ?.error
    throw new ApiError(
      res.status,
      err?.code ?? 'unknown',
      err?.message ?? `请求失败（HTTP ${res.status}）`,
    )
  }

  return data as T
}

const BASE = '/api/v1/admin'

export const api = {
  // 认证
  login: (username: string, password: string) =>
    request<{ admin: Admin }>('POST', `${BASE}/auth/login`, {
      username,
      password,
    }),
  logout: () => request<void>('POST', `${BASE}/auth/logout`),
  me: () => request<{ admin: Admin }>('GET', `${BASE}/me`),

  // 仪表盘
  dashboard: () => request<Dashboard>('GET', `${BASE}/dashboard`),

  // 认证审核
  verifications: () =>
    request<{ items: Verification[] }>('GET', `${BASE}/verifications`),
  reviewVerification: (
    id: string,
    status: 'approved' | 'rejected',
    reason: string,
  ) =>
    request<{ verification: Verification }>(
      'PATCH',
      `${BASE}/verifications/${id}`,
      { status, reason },
    ),

  // 帖子
  posts: (q?: string) =>
    request<{ items: Post[] }>(
      'GET',
      `${BASE}/posts${q ? `?q=${encodeURIComponent(q)}` : ''}`,
    ),
  updatePost: (
    id: string,
    patch: { status?: string; pinned?: boolean; reason?: string },
  ) => request<{ post: Post }>('PATCH', `${BASE}/posts/${id}`, patch),

  // 评论
  comments: (status?: string) =>
    request<{ items: Comment[] }>(
      'GET',
      `${BASE}/comments${status ? `?status=${status}` : ''}`,
    ),
  updateComment: (id: string, status: string, reason: string) =>
    request<{ comment: Comment }>('PATCH', `${BASE}/comments/${id}`, {
      status,
      reason,
    }),

  // 举报
  reports: (status?: string) =>
    request<{ items: ReportItem[] }>(
      'GET',
      `${BASE}/reports${status ? `?status=${status}` : ''}`,
    ),
  resolveReport: (
    id: string,
    action: 'restore' | 'takedown' | 'dismiss',
    reason: string,
  ) =>
    request<{ report: ReportItem['report'] }>(
      'PATCH',
      `${BASE}/reports/${id}`,
      { action, reason },
    ),

  // 申诉
  appeals: (status?: string) =>
    request<{ items: AppealItem[] }>(
      'GET',
      `${BASE}/appeals${status ? `?status=${status}` : ''}`,
    ),
  resolveAppeal: (id: string, action: 'uphold' | 'lift', reason: string) =>
    request<{ appeal: AppealItem['appeal'] }>(
      'PATCH',
      `${BASE}/appeals/${id}`,
      { action, reason },
    ),

  // 用户
  users: () => request<{ items: Account[] }>('GET', `${BASE}/users`),
  updateUser: (
    id: string,
    patch: { status: string; mute_days?: number; reason: string },
  ) => request<{ account: Account }>('PATCH', `${BASE}/users/${id}`, patch),

  // 公告
  announcements: () =>
    request<{ items: Announcement[] }>('GET', `${BASE}/announcements`),
  createAnnouncement: (body: Partial<Announcement>) =>
    request<{ announcement: Announcement }>(
      'POST',
      `${BASE}/announcements`,
      body,
    ),
  updateAnnouncement: (id: string, body: Partial<Announcement>) =>
    request<{ announcement: Announcement }>(
      'PATCH',
      `${BASE}/announcements/${id}`,
      body,
    ),
  uploadAnnouncementImage: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE}/announcements/upload`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRF-Token': csrfToken() },
      body: form,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = (data as { error?: { code?: string; message?: string } }).error
      throw new ApiError(
        res.status,
        err?.code ?? 'UPLOAD_FAILED',
        err?.message ?? '图片上传失败',
      )
    }
    return data as { url: string; dev_mode: boolean }
  },

  // 百宝箱工具
  tools: () => request<{ items: Tool[] }>('GET', `${BASE}/tools`),
  createTool: (body: Partial<Tool>) =>
    request<{ tool: Tool }>('POST', `${BASE}/tools`, body),
  updateTool: (id: string, body: Partial<Tool>) =>
    request<{ tool: Tool }>('PATCH', `${BASE}/tools/${id}`, body),

  // AI 服务
  aiProviders: () =>
    request<{ items: AIProvider[] }>('GET', `${BASE}/ai-providers`),
  createAIProvider: (body: Record<string, unknown>) =>
    request<{ provider: AIProvider }>('POST', `${BASE}/ai-providers`, body),
  updateAIProvider: (id: string, body: Record<string, unknown>) =>
    request<{ provider: AIProvider }>(
      'PATCH',
      `${BASE}/ai-providers/${id}`,
      body,
    ),

  // 知识库
  kbEntries: () => request<{ items: KBEntry[] }>('GET', `${BASE}/kb`),
  createKBEntry: (body: Partial<KBEntry>) =>
    request<{ entry: KBEntry }>('POST', `${BASE}/kb`, body),
  updateKBEntry: (id: string, body: Partial<KBEntry>) =>
    request<{ entry: KBEntry }>('PATCH', `${BASE}/kb/${id}`, body),
  deleteKBEntry: (id: string) => request<void>('DELETE', `${BASE}/kb/${id}`),

  // 待补充问题
  pendingQuestions: () =>
    request<{ items: PendingQuestion[] }>('GET', `${BASE}/pending-questions`),
  answerPendingQuestion: (id: string, answer: string) =>
    request<{ question: PendingQuestion }>(
      'POST',
      `${BASE}/pending-questions/${id}/answer`,
      { answer },
    ),

  // 运营配置
  settings: () => request<{ settings: Settings }>('GET', `${BASE}/settings`),
  updateSettings: (settings: Settings) =>
    request<{ settings: Settings }>('PUT', `${BASE}/settings`, settings),

  // 角色权限
  roles: () =>
    request<{ items: Role[]; permission_catalog: string[] }>(
      'GET',
      `${BASE}/roles`,
    ),
  createRole: (body: { name: string; permissions: string[] }) =>
    request<{ role: Role }>('POST', `${BASE}/roles`, body),
  updateRole: (
    id: number,
    body: { name: string; permissions: string[] },
  ) => request<{ role: Role }>('PATCH', `${BASE}/roles/${id}`, body),
  deleteRole: (id: number) => request<void>('DELETE', `${BASE}/roles/${id}`),

  // 管理员账号（仅超级管理员）
  admins: () => request<{ items: AdminAccount[] }>('GET', `${BASE}/admins`),
  createAdmin: (body: {
    username: string
    password: string
    role_ids: number[]
  }) => request<{ admin: Admin }>('POST', `${BASE}/admins`, body),
  updateAdmin: (
    username: string,
    body: { role_ids: number[]; enabled?: boolean },
  ) =>
    request<{ admin: Admin }>(
      'PATCH',
      `${BASE}/admins/${encodeURIComponent(username)}`,
      body,
    ),
  resetAdminPassword: (username: string, password: string) =>
    request<{ reset: boolean }>(
      'POST',
      `${BASE}/admins/${encodeURIComponent(username)}/reset-password`,
      { password },
    ),

  // 操作日志
  auditLogs: () => request<{ items: AuditLog[] }>('GET', `${BASE}/audit-logs`),
}
