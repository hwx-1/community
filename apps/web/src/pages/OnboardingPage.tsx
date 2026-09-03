import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { api, ApiError } from '../api/client'
import { useAuth } from '../store/auth'
import { useToast } from '../components/Toast'
import styles from './OnboardingPage.module.css'

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [avatar, setAvatar] = useState('')
  const [realName, setRealName] = useState('')
  const [nickname, setNickname] = useState('')
  const [gender, setGender] = useState('')
  const [studentNo, setStudentNo] = useState('')
  const [className, setClassName] = useState('')
  const [proofUrl, setProofUrl] = useState('')
  const [proofName, setProofName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()
  const { account, setAccount } = useAuth()

  const next = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const { account: updated } = await api.updateProfile({
        nickname: nickname || account?.nickname || '',
        avatar: avatar || nickname.slice(0, 1) || '新',
        gender,
        real_name: realName,
        student_no: studentNo,
        class_name: className,
      })
      setAccount(updated)
      setStep(2)
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '保存失败，请稍后重试', 'error')
    } finally {
      setBusy(false)
    }
  }

  const uploadProof = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const { url } = await api.upload(file)
      setProofUrl(url)
      setProofName(file.name)
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '材料上传失败', 'error')
    } finally {
      setUploading(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!proofUrl || busy) {
      if (!proofUrl) toast('请先上传证明材料', 'error')
      return
    }
    setBusy(true)
    try {
      await api.submitVerification({ material_url: proofUrl, real_name: realName, student_no: studentNo, type: 'college' })
      setStep(3)
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '提交失败，请稍后重试', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={styles.shell}>
      <header><span className={styles.brandMark}>x</span><strong>xsnbb</strong><small>完善资料</small></header>
      <div className={styles.progress} aria-label={`第 ${Math.min(step, 2)} 步，共 2 步`}><span className={styles.done}>1</span><i className={step >= 2 ? styles.lineDone : ''} /><span className={step >= 2 ? styles.done : ''}>2</span></div>
      {step === 1 && (
        <form className={styles.card} onSubmit={next}>
          <div className={styles.title}><span>01</span><div><h1>完善个人资料</h1><p>这些信息用于学生身份核验，公开主页只展示昵称、头像与性别。</p></div></div>
          <label htmlFor="setup-avatar">头像 <span>选填</span></label>
          <label className={styles.avatarUpload} htmlFor="setup-avatar"><Icon name="image" />{avatar ? '已上传头像' : uploading ? '上传中…' : '选择头像'}</label>
          <input className="srOnly" id="setup-avatar" type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={(event) => { const f = event.target.files?.[0]; if (f) { setUploading(true); api.upload(f).then(({ url }) => setAvatar(url)).catch(() => toast('头像上传失败', 'error')).finally(() => setUploading(false)) } }} />
          <div className={styles.twoCol}><div><label htmlFor="setup-name">真实姓名 <span>认证后锁定</span></label><input id="setup-name" value={realName} onChange={(event) => setRealName(event.target.value)} required /></div><div><label htmlFor="setup-nickname">公开昵称 <span>2–16 字符</span></label><input id="setup-nickname" minLength={2} maxLength={16} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder={account?.nickname} required /></div></div>
          <div className={styles.twoCol}><div><label htmlFor="setup-gender">性别</label><select id="setup-gender" value={gender} onChange={(event) => setGender(event.target.value)} required><option value="">请选择</option><option>男</option><option>女</option></select></div><div><label htmlFor="setup-student-id">学号 <span>认证后锁定</span></label><input id="setup-student-id" value={studentNo} onChange={(event) => setStudentNo(event.target.value)} required /></div></div>
          <label htmlFor="setup-class">班级</label><input id="setup-class" placeholder="例如：计算机 2301 班" value={className} onChange={(event) => setClassName(event.target.value)} required />
          <button type="submit" disabled={busy || uploading}>{busy ? '保存中…' : '下一步：学生认证'}<Icon name="chevronRight" /></button>
        </form>
      )}
      {step === 2 && (
        <form className={styles.card} onSubmit={submit}>
          <div className={styles.title}><span>02</span><div><h1>提交学生认证</h1><p>学生证或学信网信息截图二选一，每次提交 1 张。</p></div></div>
          <label htmlFor="proof-type">材料类型</label><select id="proof-type"><option>学生证</option><option>学信网信息截图</option></select>
          <label htmlFor="setup-proof">证明材料</label>
          <label className={styles.proofUpload} htmlFor="setup-proof"><Icon name="image" /><strong>{proofName || (uploading ? '上传中…' : '选择一张证明图片')}</strong><small>需清晰显示姓名、学号和沈阳大学信息</small></label>
          <input className="srOnly" id="setup-proof" type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={(event) => uploadProof(event.target.files?.[0])} />
          <div className={styles.privacy}><Icon name="shield" /><p><strong>隐私保护说明</strong><span>可遮挡身份证号等无关信息；材料仅在人工审核时可见，审核结束 30 天后自动删除。</span></p></div>
          <div className={styles.actions}><button type="button" onClick={() => setStep(1)}><Icon name="arrowLeft" />上一步</button><button type="submit" disabled={busy || uploading}>{busy ? '提交中…' : '提交认证'}</button></div>
        </form>
      )}
      {step === 3 && (
        <section className={`${styles.card} ${styles.success}`}><span><Icon name="clock" /></span><h1>认证申请已提交</h1><p>审核期间可以浏览社区、修改资料和举报内容；发帖、互动、私信与 AI 问答将在认证通过后开放。</p><button type="button" onClick={() => navigate('/')}>先浏览社区</button></section>
      )}
      <footer>学生共建社区 · 非学校官方平台</footer>
    </main>
  )
}
