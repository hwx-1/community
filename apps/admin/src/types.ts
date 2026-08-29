// 与 Go 后端约定一致的领域模型（JSON 字段均为 snake_case）

export interface Admin {
  username: string
  is_super: boolean
  permissions: string[]
}

export interface AuditLog {
  id: string
  operator: string
  action: string
  target: string
  result: string
  reason?: string
  category: 'security' | 'operational'
  created_at: string
}

export interface Dashboard {
  users: number
  public_posts: number
  pending_verifications: number
  ai_providers: number
  recent_audits: AuditLog[]
}

export type VerificationStatus = 'pending' | 'approved' | 'rejected'

export interface Verification {
  id: string
  account_id: string
  nickname: string
  real_name: string
  student_no: string
  material_url: string
  status: VerificationStatus
  reject_reason?: string
  created_at: string
}

export type ContentStatus =
  | 'public'
  | 'pending'
  | 'rejected'
  | 'reported_hidden'
  | 'removed'
  | 'deleted'

export interface Author {
  id: string
  nickname: string
  avatar: string
  gender?: string
  verified: boolean
}

export interface Post {
  id: string
  author: Author
  text: string
  images: string[] | null
  tags: string[] | null
  status: ContentStatus
  pinned: boolean
  likes: number
  comments: number
  created_at: string
  updated_at: string
}

export interface Comment {
  id: string
  post_id: string
  parent_id?: string
  author: Author
  text: string
  image?: string
  status: ContentStatus
  deleted: boolean
  created_at: string
}

export type ReportStatus = 'pending' | 'dismissed' | 'actioned'

export interface Report {
  id: string
  target_type: 'post' | 'comment' | 'dm' | 'user'
  target_id: string
  reason: string
  status: ReportStatus
  result?: string
  created_at: string
  resolved_at?: string
}

export interface ReportItem {
  report: Report
  reporter: string
}

export type AppealStatus = 'pending' | 'upheld' | 'lifted'

export interface Appeal {
  id: string
  punishment_id: string
  account_id: string
  kind: 'mute' | 'ban'
  reason: string
  status: AppealStatus
  result?: string
  created_at: string
  resolved_at?: string
}

export interface AppealItem {
  appeal: Appeal
  nickname: string
}

export type AccountStatus = 'active' | 'muted' | 'banned' | 'deactivated'

export interface Account {
  id: string
  phone?: string
  nickname: string
  avatar: string
  gender?: string
  real_name?: string
  student_no?: string
  class_name?: string
  profile_done: boolean
  verified: boolean
  status: AccountStatus
  created_at: string
}

export interface Announcement {
  id: string
  title: string
  summary: string
  body: string
  published: boolean
  created_at: string
}

export interface Tool {
  id: string
  name: string
  type: 'ai' | 'map' | 'links' | 'link'
  icon: string
  url?: string
  weight: number
  enabled: boolean
}

export interface AIProvider {
  id: string
  name: string
  protocol: string
  base_url: string
  api_key_masked: string
  model: string
  enabled: boolean
  public: boolean
  fallback_order: number
}

export interface KBEntry {
  id: string
  title: string
  category: 'phone' | 'notice' | 'faq'
  content: string
  source: string
  source_date: string
  enabled: boolean
  updated_at: string
}

export interface PendingQuestion {
  id: string
  account_id: string
  question: string
  status: 'open' | 'answered' | 'withdrawn'
  answer?: string
  ask_count: number
  created_at: string
  answered_at?: string
}

export interface Settings {
  greeting: string
  hot_topics: string[]
}

export interface Role {
  id: string
  name: string
  permissions: string[]
}
