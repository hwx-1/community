import { FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { api, ApiError, MyVerification } from '../api/client'
import { useToast } from '../components/Toast'
import styles from './AccountPage.module.css'

// 学号脱敏：保留前 4 位和后 2 位，如 2023****42
function maskStudentNo(studentNo: string): string {
  if (studentNo.length <= 6) return studentNo
  return `${studentNo.slice(0, 4)}****${studentNo.slice(-2)}`
}

// 姓名脱敏：仅保留首字
function maskName(name: string): string {
  if (name.length <= 1) return name
  return `${name.slice(0, 1)}${'*'.repeat(Math.min(name.length - 1, 2))}`
}

export default function VerificationPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data, isLoading } = useQuery({ queryKey: ['my-verification'], queryFn: api.myVerification })
  const verification = data?.verification ?? null

  const [editing, setEditing] = useState(false)
  const [realName, setRealName] = useState('')
  const [studentNo, setStudentNo] = useState('')
  const [fileName, setFileName] = useState('')
  const [materialUrl, setMaterialUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const uploadProof = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast('材料图片不能超过 10MB', 'error')
      return
    }
    setUploading(true)
    try {
      const { url } = await api.upload(file)
      setMaterialUrl(url)
      setFileName(file.name)
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '材料上传失败', 'error')
    } finally {
      setUploading(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || uploading) return
    if (!materialUrl) {
      toast('请先上传证明材料', 'error')
      return
    }
    setBusy(true)
    try {
      await api.submitVerification({ material_url: materialUrl, real_name: realName.trim(), student_no: studentNo.trim() })
      setSubmitted(true)
      setEditing(false)
      void queryClient.invalidateQueries({ queryKey: ['my-verification'] })
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '提交失败，请稍后重试', 'error')
    } finally {
      setBusy(false)
    }
  }

  const status: MyVerification['status'] | 'none' = verification?.status ?? 'none'
  // 无记录或被驳回时直接展示表单；已通过时需要点击“申请变更”才展开
  const showForm = status === 'none' || status === 'rejected' || editing

  return (
    <div className={styles.accountPage}>
      <header className={styles.pageHead}>
        <button type="button" aria-label="返回" onClick={() => navigate('/me')}><Icon name="arrowLeft" /></button>
        <div><h1>学生认证</h1><p>由获得授权的管理员人工审核。</p></div>
      </header>

      {isLoading && <section className={styles.statusCard}><span><Icon name="clock" /></span><div><small>当前状态</small><h2>加载中…</h2></div></section>}

      {!isLoading && status === 'pending' && (
        <section className={styles.statusCard}><span><Icon name="clock" /></span><div><small>当前状态</small><h2>审核中</h2><p>认证申请由管理员人工审核；超过 7 天未处理的申请会在管理后台高亮提醒，请耐心等待。</p></div></section>
      )}

      {!isLoading && status === 'approved' && verification && (
        <>
          <section className={`${styles.statusCard} ${styles.statusApproved}`}><span><Icon name="check" /></span><div><small>当前状态</small><h2>认证已通过</h2><p>{maskName(verification.real_name)} · {maskStudentNo(verification.student_no)}，你可以正常使用发帖、互动、私信和 AI 问答。</p></div></section>
          <div className={styles.privacyBox}><Icon name="lock" /><p><strong>姓名与学号已锁定</strong><span>如需变更，请在下方重新提交证明材料，由管理员人工处理。</span></p></div>
          {!editing && <button className={styles.secondaryButton} type="button" onClick={() => setEditing(true)}>申请变更姓名或学号</button>}
        </>
      )}

      {!isLoading && status === 'rejected' && verification && (
        <section className={`${styles.statusCard} ${styles.statusRejected}`}><span><Icon name="info" /></span><div><small>当前状态</small><h2>认证被驳回</h2><p>{verification.reject_reason || '材料未通过审核，请修改后重新提交。'}</p></div></section>
      )}

      {!isLoading && !submitted && showForm && (
        <form className={styles.formCard} onSubmit={submit}>
          <h2>{status === 'approved' ? '提交资料变更申请' : '提交学生认证申请'}</h2>
          {status !== 'approved' && (
            <div className={styles.privacyBox}><Icon name="info" /><p><strong>认证通过前</strong><span>你可以浏览社区和举报违规内容，暂不能发帖、评论、私信和使用 AI 问答。</span></p></div>
          )}
          <label htmlFor="verify-name">真实姓名 <span>必填</span></label>
          <input id="verify-name" value={realName} onChange={(event) => setRealName(event.target.value)} placeholder="与证明材料一致" required />
          <label htmlFor="verify-student-id">学号 <span>必填</span></label>
          <input id="verify-student-id" value={studentNo} onChange={(event) => setStudentNo(event.target.value)} placeholder="与证明材料一致" required />
          <label htmlFor="proof-file">证明材料 <span>每次仅 1 张</span></label>
          <label className={styles.uploadBox} htmlFor="proof-file"><Icon name="image" /><strong>{uploading ? '上传中…' : fileName || '选择学生证或学信网截图'}</strong><small>需包含姓名、学号与学校信息；jpg / png / webp / heic，单张不超过 10MB</small></label>
          <input className="srOnly" id="proof-file" type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={(event) => void uploadProof(event.target.files?.[0])} required={!materialUrl} />
          <div className={styles.privacyBox}><Icon name="shield" /><p><strong>材料仅用于身份核验</strong><span>仅获授权审核员在处理申请时可见，审核结束 30 天后自动删除。</span></p></div>
          <button className={styles.primaryButton} type="submit" disabled={busy || uploading}>{busy ? '提交中…' : '提交人工审核'}</button>
        </form>
      )}

      {submitted && (
        <section className={styles.submitted}><Icon name="clock" /><h2>申请已提交</h2><p>审核期间原认证信息继续有效，处理结果会发送到消息页。</p><button type="button" onClick={() => navigate('/me')}>返回我的</button></section>
      )}

      <section className={styles.ruleCard}><h2>认证说明</h2><ul><li>证明材料可遮挡身份证号等无关信息。</li><li>管理员仅核对姓名、学号和学校信息，不要求学信网账号密码。</li><li>申请被驳回后可修改材料重新提交，不限制补交次数。</li></ul></section>
    </div>
  )
}
