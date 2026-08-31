export interface PublicAccount {
  id: number;
  nickname: string;
  avatar: string;
  gender: string;
  verified: boolean;
}

export interface Account extends PublicAccount {
  phone?: string;
  real_name?: string;
  student_no?: string;
  class_name?: string;
  profile_done: boolean;
  status: string;
  created_at: string;
}

export interface Post {
  id: number;
  author: PublicAccount;
  text: string;
  images: string[] | null;
  tags: string[] | null;
  status: string;
  pinned: boolean;
  likes: number;
  comments: number;
  liked: boolean;
  bookmarked: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommentItem {
  id: number;
  post_id: number;
  parent_id?: number;
  author: PublicAccount;
  text: string;
  image?: string;
  status: string;
  deleted: boolean;
  created_at: string;
}

export interface Announcement {
  id: number;
  title: string;
  summary: string;
  body: string;
  image_url?: string;
  link_url?: string;
  link_text?: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

export interface CampusTool {
  id: number;
  name: string;
  type: string;
  icon: string;
  url?: string;
  weight: number;
  enabled: boolean;
}

export interface AppNotification {
  id: number;
  type: 'comment' | 'reply' | 'report_result' | 'official_answer' | 'punishment' | 'appeal_result';
  title: string;
  body: string;
  ref_type?: string;
  ref_id?: number;
  read: boolean;
  created_at: string;
}

export interface DirectMessage {
  id: number;
  sender_id: number;
  text: string;
  system: boolean;
  status: string;
  created_at: string;
}

export interface DirectConversationItem {
  id: number;
  other: PublicAccount;
  unlocked: boolean;
  messages: DirectMessage[];
  updated_at: string;
}

export interface PublicSettings {
  hot_topics: string[];
  greeting: string;
}

export interface ModerationInfo {
  pass: boolean;
  category?: string;
  reason?: string;
  dev_mode: boolean;
}

export interface AIModel {
  id: number;
  name: string;
  model: string;
  enabled: boolean;
  public: boolean;
}

export interface AIMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  model?: string;
  source?: string;
  created_at: string;
}

export interface AIConversation {
  id: number;
  title: string;
  model: string;
  messages: AIMessage[];
  created_at: string;
}

export interface MyVerification {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason?: string;
  real_name: string;
  student_no: string;
  created_at: string;
}
