import { create } from 'zustand'
import { Account, api } from '../api/client'

interface AuthState {
  account: Account | null
  loaded: boolean
  refresh: () => Promise<Account | null>
  setAccount: (account: Account | null) => void
  logout: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  account: null,
  loaded: false,
  refresh: async () => {
    try {
      const { account } = await api.me()
      set({ account, loaded: true })
      return account
    } catch {
      set({ account: null, loaded: true })
      return null
    }
  },
  setAccount: (account) => set({ account, loaded: true }),
  logout: async () => {
    try {
      await api.logout()
    } finally {
      set({ account: null, loaded: true })
    }
  },
}))
