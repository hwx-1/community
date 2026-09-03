import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react'
import Icon from './Icon'
import styles from './Toast.module.css'

export type ToastKind = 'success' | 'error' | 'info'

type ToastItem = { id: number; kind: ToastKind; text: string }

const ToastContext = createContext<(text: string, kind?: ToastKind) => void>(() => {})

// 全局系统提示：页面内调用 useToast() 返回的函数即可弹出轻提示
export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const push = useCallback((text: string, kind: ToastKind = 'info') => {
    if (!text) return
    const id = ++nextId.current
    // 最多同时保留 3 条，避免堆叠过多
    setToasts((current) => [...current.slice(-2), { id, kind, text }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className={styles.stack} role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${toast.kind === 'success' ? styles.success : toast.kind === 'error' ? styles.error : styles.info}`}>
            <Icon name={toast.kind === 'success' ? 'check' : 'info'} />
            <span>{toast.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
