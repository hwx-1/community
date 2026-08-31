import CookieManager from '@react-native-cookies/cookies';
import { Platform } from 'react-native';
import type {
  Account,
  AIConversation,
  AIMessage,
  AIModel,
  Announcement,
  AppNotification,
  CampusTool,
  CommentItem,
  DirectConversationItem,
  DirectMessage,
  ModerationInfo,
  MyVerification,
  Post,
  PublicSettings,
} from './types';

// 模拟器开发地址。真机联调时改为局域网或线上 HTTPS 地址。
export const API_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:8080',
  ios: 'http://localhost:8080',
  default: 'http://localhost:8080',
}) as string;

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function csrfToken(): Promise<string> {
  const cookies = await CookieManager.get(API_BASE_URL);
  return cookies.xsnbb_csrf?.value ?? '';
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (reason) {
    if (reason instanceof Error && reason.name === 'AbortError') {
      throw new ApiError(
        408,
        'REQUEST_TIMEOUT',
        '网络响应较慢，请检查连接后重试',
      );
    }
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      '暂时无法连接服务器，请检查网络后重试',
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (method !== 'GET') {
    const csrf = await csrfToken();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }
  }

  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) {
    return undefined as T;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const payload = data as { error?: { code?: string; message?: string } };
    throw new ApiError(
      response.status,
      payload.error?.code ?? 'UNKNOWN',
      payload.error?.message ?? '请求失败，请稍后重试',
    );
  }
  return data as T;
}

export type UploadAsset = { uri: string; name: string; type: string };

export const api = {
  login: (phone: string, password: string) =>
    request<{ account: Account }>('POST', '/api/v1/auth/login', {
      phone,
      password,
    }),
  smsCode: (phone: string) =>
    request<{
      sent: boolean;
      dev_mode: boolean;
      dev_code?: string;
      expires_in: number;
    }>('POST', '/api/v1/auth/sms-code', { phone, purpose: 'register' }),
  register: (input: {
    phone: string;
    code: string;
    password: string;
    nickname: string;
    invite_code: string;
  }) => request<{ account: Account }>('POST', '/api/v1/auth/register', input),
  me: () => request<{ account: Account }>('GET', '/api/v1/me'),
  logout: () => request<void>('POST', '/api/v1/auth/logout', {}),
  listPosts: (params?: { q?: string; mine?: boolean }) => {
    const query: string[] = [];
    if (params?.q) {
      query.push(`q=${encodeURIComponent(params.q)}`);
    }
    if (params?.mine) {
      query.push('mine=1');
    }
    return request<{ items: Post[] }>(
      'GET',
      `/api/v1/posts${query.length ? `?${query.join('&')}` : ''}`,
    );
  },
  myBookmarks: () => request<{ items: Post[] }>('GET', '/api/v1/me/bookmarks'),
  updateProfile: (input: {
    nickname: string;
    avatar: string;
    gender: string;
    real_name: string;
    student_no: string;
    class_name: string;
  }) => request<{ account: Account }>('PUT', '/api/v1/me/profile', input),
  myVerification: () =>
    request<{ verification: MyVerification | null }>(
      'GET',
      '/api/v1/me/verification',
    ),
  submitVerification: (input: {
    material_url: string;
    real_name: string;
    student_no: string;
  }) =>
    request<{ verification: MyVerification }>(
      'POST',
      '/api/v1/me/verification',
      input,
    ),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ changed: boolean }>('POST', '/api/v1/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    }),
  deleteAccount: () => request<void>('DELETE', '/api/v1/me'),
  getPost: (id: number) =>
    request<{ post: Post }>('GET', `/api/v1/posts/${id}`),
  createPost: (input: { text: string; images: string[]; tags: string[] }) =>
    request<{ post: Post; moderation: ModerationInfo; message: string }>(
      'POST',
      '/api/v1/posts',
      input,
    ),
  likePost: (id: number) =>
    request<{ post: Post }>('POST', `/api/v1/posts/${id}/like`, {}),
  bookmarkPost: (id: number) =>
    request<{ post: Post }>('POST', `/api/v1/posts/${id}/bookmark`, {}),
  listComments: (postId: number) =>
    request<{ items: CommentItem[] }>(
      'GET',
      `/api/v1/posts/${postId}/comments`,
    ),
  createComment: (postId: number, text: string) =>
    request<{
      comment: CommentItem;
      moderation: ModerationInfo;
      message: string;
    }>('POST', `/api/v1/posts/${postId}/comments`, { text }),
  listAnnouncements: () =>
    request<{ items: Announcement[] }>('GET', '/api/v1/announcements'),
  publicSettings: () =>
    request<PublicSettings>('GET', '/api/v1/settings/public'),
  listTools: () => request<{ items: CampusTool[] }>('GET', '/api/v1/tools'),
  notifications: () =>
    request<{ items: AppNotification[]; unread: number }>(
      'GET',
      '/api/v1/me/notifications',
    ),
  markNotificationsRead: (ids?: number[]) =>
    request<{ unread: number }>('POST', '/api/v1/me/notifications/read', {
      ids: ids ?? [],
    }),
  listDirectConversations: () =>
    request<{ items: DirectConversationItem[] }>(
      'GET',
      '/api/v1/direct-conversations',
    ),
  getDirectConversation: (id: number) =>
    request<{
      conversation: { id: number; messages: DirectMessage[] };
      other: Account;
      unlocked: boolean;
    }>('GET', `/api/v1/direct-conversations/${id}`),
  sendDirectMessage: (id: number, text: string) =>
    request<{ message: DirectMessage; unlocked: boolean }>(
      'POST',
      `/api/v1/direct-conversations/${id}/messages`,
      { text, system: false },
    ),
  sendSystemGreeting: (id: number) =>
    request<{ message: DirectMessage; unlocked: boolean }>(
      'POST',
      `/api/v1/direct-conversations/${id}/messages`,
      { text: '', system: true },
    ),
  aiModels: () => request<{ items: AIModel[] }>('GET', '/api/v1/ai/models'),
  aiConversations: () =>
    request<{ items: AIConversation[]; remaining: number }>(
      'GET',
      '/api/v1/ai/conversations',
    ),
  createAIConversation: (title?: string, model?: string) =>
    request<{ conversation: AIConversation }>(
      'POST',
      '/api/v1/ai/conversations',
      { title, model },
    ),
  askAI: (id: number, text: string, model?: string) =>
    request<{ user_message: AIMessage; answer: AIMessage; remaining: number }>(
      'POST',
      `/api/v1/ai/conversations/${id}/messages`,
      { text, model },
    ),
  upload: async (
    asset: UploadAsset,
  ): Promise<{ url: string; dev_mode: boolean }> => {
    const form = new FormData();
    form.append('file', asset as unknown as Blob);
    const csrf = await csrfToken();
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/uploads`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': csrf },
      body: form,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const payload = data as { error?: { code?: string; message?: string } };
      throw new ApiError(
        response.status,
        payload.error?.code ?? 'UPLOAD_FAILED',
        payload.error?.message ?? '图片上传失败',
      );
    }
    return data as { url: string; dev_mode: boolean };
  },
};

export function absoluteMediaUrl(path?: string): string | undefined {
  if (!path) {
    return undefined;
  }
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function formatTime(iso: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) {
    return '';
  }
  const diff = Date.now() - time;
  const minute = 60_000;
  if (diff < minute) return '刚刚';
  if (diff < 60 * minute) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < 24 * 60 * minute)
    return `${Math.floor(diff / (60 * minute))} 小时前`;
  if (diff < 7 * 24 * 60 * minute)
    return `${Math.floor(diff / (24 * 60 * minute))} 天前`;
  const date = new Date(time);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
