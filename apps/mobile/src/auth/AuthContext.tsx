import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ApiError, api } from '../api/client';
import type { Account } from '../api/types';

type AuthContextValue = {
  account: Account | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (input: {
    phone: string;
    code: string;
    password: string;
    nickname: string;
    invite_code: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const result = await api.me();
      setAccount(result.account);
    } catch (reason) {
      // 网络波动不应把已登录用户直接踢回登录页；只有明确的 401 才清空会话。
      if (
        !initialized.current ||
        (reason instanceof ApiError && reason.status === 401)
      ) {
        setAccount(null);
      }
    } finally {
      initialized.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      account,
      loading,
      login: async (phone, password) => {
        const result = await api.login(phone, password);
        setAccount(result.account);
      },
      register: async input => {
        const result = await api.register(input);
        setAccount(result.account);
      },
      logout: async () => {
        try {
          await api.logout();
        } finally {
          setAccount(null);
        }
      },
      refresh,
    }),
    [account, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
