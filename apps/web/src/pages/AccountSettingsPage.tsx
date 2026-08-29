import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { api, ApiError } from '../api/client'
import { useAuth } from '../store/auth'
import styles from './AccountPage.module.css'

export default function AccountSettingsPage() {
  const navigate = useNavigate()
  const { setAccount } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [changed, setChanged] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const changePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (passwordBusy) return
    setPasswordBusy(true)
    setPasswordError('')
    setChanged(false)
    try {
      await api.changePassword(currentPassword, newPassword)
      setChanged(true)
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : '密码修改失败，请稍后重试')
    } finally {
      setPasswordBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (deleteBusy) return
    setDeleteBusy(true)
    setDeleteError('')
    try {
      await api.deleteAccount()
      setAccount(null)
      navigate('/login', { replace: true })
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : '注销失败，请稍后重试')
      setDeleteBusy(false)
    }
  }

  return (
    <div className={styles.accountPage}>
      <header className={styles.pageHead}><button type="button" aria-label="返回" onClick={() => navigate('/me')}><Icon name="arrowLeft" /></button><div><h1>账号设置</h1><p>管理登录密码和账号状态。</p></div></header>

      <form className={styles.formCard} onSubmit={changePassword}>
        <h2>修改密码</h2>
        {changed && <div className={styles.inlineSuccess}><Icon name="check" />密码修改成功</div>}
        <label htmlFor="current-password">当前密码</label>
        <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
        <label htmlFor="new-password">新密码 <span>至少 8 位</span></label>
        <input id="new-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
        {passwordError && <p role="alert" style={{ color: 'var(--danger)', margin: '8px 0 0' }}>{passwordError}</p>}
        <button className={styles.primaryButton} type="submit" disabled={passwordBusy}>{passwordBusy ? '提交中…' : '更新密码'}</button>
      </form>

      <section className={`${styles.formCard} ${styles.dangerCard}`}>
        <h2>账号注销</h2>
        <p className={styles.sectionNote}>注销后内部资料会被删除，已发布内容将匿名化保留，且无法恢复账号。</p>
        <button type="button" onClick={() => setDeleteOpen(true)}>申请注销账号</button>
        {deleteOpen && (
          <div className={styles.deleteConfirm}>
            <Icon name="info" />
            <div>
              <strong>确认申请注销？</strong>
              <p>学号将被释放，私信历史会向对方保留并显示为“已注销用户”。</p>
              {deleteError && <p role="alert" style={{ color: 'var(--danger)' }}>{deleteError}</p>}
              <div>
                <button type="button" disabled={deleteBusy} onClick={() => setDeleteOpen(false)}>取消</button>
                <button type="button" disabled={deleteBusy} onClick={() => void confirmDelete()}>{deleteBusy ? '注销中…' : '确认注销'}</button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
