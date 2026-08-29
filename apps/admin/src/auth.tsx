import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { api, ApiError } from './api'
import type { Admin } from './types'

interface AuthContextValue {
  admin: Admin | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 刷新后通过 /me 恢复会话；401 视为未登录
    api
      .me()
      .then((res) => setAdmin(res.admin))
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) {
          console.error('恢复会话失败', err)
        }
        setAdmin(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password)
    setAdmin(res.admin)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setAdmin(null)
    }
  }, [])

  const value = useMemo(
    () => ({ admin, loading, login, logout }),
    [admin, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return ctx
}
