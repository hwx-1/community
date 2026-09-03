import { FormEvent, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { Avatar } from '../components/Avatar'
import { api, ApiError } from '../api/client'
import { useAuth } from '../store/auth'
import { useToast } from '../components/Toast'
import styles from './AccountPage.module.css'

export default function EditProfilePage() {
  const navigate = useNavigate()
  const { account, setAccount } = useAuth()
  const toast = useToast()
  const [nickname, setNickname] = useState(account?.nickname ?? '')
  const [gender, setGender] = useState(account?.gender ?? '男')
  const [className, setClassName] = useState(account?.class_name ?? '')
  const [avatar, setAvatar] = useState(account?.avatar ?? '')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return
    try {
      const { url } = await api.upload(file)
      setAvatar(url)
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '头像上传失败', 'error')
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const { account: updated } = await api.updateProfile({
        nickname,
        avatar,
        gender,
        real_name: account?.real_name ?? '',
        student_no: account?.student_no ?? '',
        class_name: className,
      })
      setAccount(updated)
      toast('资料已保存', 'success')
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '保存失败，请稍后重试', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={styles.accountPage} onSubmit={submit}>
      <header className={styles.pageHead}><button type="button" onClick={() => navigate('/me')}><Icon name="arrowLeft" /></button><div><h1>编辑资料</h1><p>公开资料与内部认证资料分开管理。</p></div></header>
      <section className={styles.formCard}>
        <h2>公开资料</h2>
        <div className={styles.avatarEditor}>
          <span><Avatar value={avatar} fallback={nickname.slice(0, 1)} /></span>
          <div><strong>头像</strong><small>JPG / PNG / WEBP / HEIC，最大 5MB</small><button type="button" onClick={() => fileRef.current?.click()}>更换头像</button></div>
          <input className="srOnly" ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={(event) => uploadAvatar(event.target.files?.[0])} />
        </div>
        <label htmlFor="nickname">公开昵称 <span>全站唯一，2–16 字符</span></label>
        <input id="nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} minLength={2} maxLength={16} pattern="[A-Za-z0-9_一-龥]+" required />
        <div className={styles.twoCol}>
          <div><label htmlFor="gender">性别</label><select id="gender" value={gender} onChange={(event) => setGender(event.target.value)}><option>男</option><option>女</option></select></div>
          <div><label htmlFor="class-name">班级</label><input id="class-name" value={className} onChange={(event) => setClassName(event.target.value)} required /></div>
        </div>
      </section>
      <section className={styles.formCard}>
        <h2>认证资料</h2>
        <p className={styles.sectionNote}>认证通过后，真实姓名与学号仅能通过资料变更申请修改。</p>
        <label htmlFor="real-name">真实姓名 {account?.verified && <span className={styles.lockLabel}><Icon name="lock" />已锁定</span>}</label>
        <input id="real-name" value={account?.real_name ?? ''} disabled />
        <label htmlFor="student-id">学号 {account?.verified && <span className={styles.lockLabel}><Icon name="lock" />已锁定</span>}</label>
        <input id="student-id" value={account?.student_no ?? ''} disabled />
        <button className={styles.secondaryButton} type="button" onClick={() => navigate('/me/verification')}>申请变更认证资料</button>
      </section>
      <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? '保存中…' : '保存修改'}</button>
    </form>
  )
}
