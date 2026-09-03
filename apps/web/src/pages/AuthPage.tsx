import { FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { api, ApiError } from '../api/client'
import { useAuth } from '../store/auth'
import { useToast } from '../components/Toast'
import styles from './AuthPage.module.css'

type AuthMode = 'login' | 'register' | 'forgot'

const copy = {
  login: { eyebrow: '欢迎回来', title: '登录校园社区', description: '使用已绑定的手机号进入社区。', submit: '登录' },
  register: { eyebrow: '加入内测', title: '创建社区账号', description: '首版仅面向沈阳大学学生开放。', submit: '注册账号' },
  forgot: { eyebrow: '找回账号', title: '重置登录密码', description: '验证码将发送至已绑定手机号。', submit: '确认重置' },
}

export default function AuthPage({ mode }: { mode: AuthMode }) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [sent, setSent] = useState(false)
  const [devCode, setDevCode] = useState('')
  const [accepted, setAccepted] = useState(mode !== 'register')
  const [finished, setFinished] = useState(false)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { setAccount } = useAuth()
  const content = copy[mode]

  const sendCode = async () => {
    if (phone.length !== 11) {
      toast('请先填写 11 位手机号', 'error')
      return
    }
    try {
      const result = await api.smsCode(phone, mode === 'forgot' ? 'reset' : 'register')
      setSent(true)
      // 开发模式：验证码直接展示，正式环境不会返回 dev_code
      if (result.dev_code) setDevCode(result.dev_code)
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '验证码发送失败', 'error')
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!accepted || busy) return
    setBusy(true)
    try {
      if (mode === 'login') {
        const { account } = await api.login(phone, password)
        setAccount(account)
        const from = (location.state as { from?: string } | null)?.from
        navigate(account.profile_done ? from ?? '/' : '/onboarding', { replace: true })
      } else if (mode === 'register') {
        const { account } = await api.register({ phone, code, password, nickname: nickname || undefined, invite_code: inviteCode })
        setAccount(account)
        navigate('/onboarding', { replace: true })
      } else {
        await api.resetPassword(phone, code, password)
        setFinished(true)
      }
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '操作失败，请稍后重试', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (finished) {
    return (
      <main className={styles.authShell}>
        <section className={styles.successCard}>
          <span><Icon name="check" /></span>
          <h1>密码重置成功</h1>
          <p>请使用新密码重新登录社区。</p>
          <Link to="/login">返回登录</Link>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.authShell}>
      <section className={styles.brandPanel}>
        <Link to="/" className={styles.brand}><span>x</span>xsnbb</Link>
        <div className={styles.brandCopy}>
          <small>SHENYANG UNIVERSITY COMMUNITY</small>
          <h1>认识同学，分享校园生活。</h1>
          <p>一个由学生共同建设的校园社区。</p>
        </div>
        <div className={styles.brandNote}><Icon name="shield" />学生共建社区 · 非学校官方平台</div>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.mobileBrand}><Link to="/"><span>x</span>xsnbb</Link></div>
        <form className={styles.authCard} onSubmit={submit}>
          <header><span>{content.eyebrow}</span><h2>{content.title}</h2><p>{content.description}</p></header>

          <label htmlFor={`${mode}-phone`}>手机号</label>
          <div className={styles.inputWrap}><Icon name="phone" /><input id={`${mode}-phone`} type="tel" inputMode="numeric" maxLength={11} placeholder="请输入 11 位手机号" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ''))} required /></div>

          {mode !== 'login' && (
            <>
              <label htmlFor={`${mode}-code`}>短信验证码</label>
              <div className={styles.codeRow}>
                <div className={styles.inputWrap}><Icon name="key" /><input id={`${mode}-code`} inputMode="numeric" maxLength={6} placeholder="6 位验证码" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} required /></div>
                <button type="button" disabled={sent} onClick={sendCode}>{sent ? '已发送' : '获取验证码'}</button>
              </div>
              {devCode && <p role="status" style={{ color: 'var(--text-muted)', margin: '4px 0' }}>开发模式验证码：{devCode}（正式环境将通过短信下发）</p>}
            </>
          )}

          <label htmlFor={`${mode}-password`}>{mode === 'forgot' ? '新密码' : '密码'}</label>
          <div className={styles.inputWrap}><Icon name="lock" /><input id={`${mode}-password`} type="password" minLength={8} placeholder="至少 8 位字符" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>

          {mode === 'register' && (
            <>
              <label htmlFor="nickname">公开昵称 <span style={{ color: 'var(--text-soft)' }}>选填，2–16 字符</span></label>
              <div className={styles.inputWrap}><Icon name="user" /><input id="nickname" minLength={2} maxLength={16} placeholder="其他用户看到的名字" value={nickname} onChange={(event) => setNickname(event.target.value)} /></div>
              <label htmlFor="invite-code">内测邀请码</label>
              <div className={styles.inputWrap}><Icon name="key" /><input id="invite-code" placeholder="请输入有效邀请码" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} required /></div>
              <label className={styles.checkRow}><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>我已阅读并同意《服务协议》和《隐私政策》</span></label>
            </>
          )}

          {mode === 'login' && <div className={styles.formMeta}><span /> <Link to="/forgot-password">忘记密码？</Link></div>}

          <button className={styles.submit} type="submit" disabled={!accepted || busy}>{busy ? '处理中…' : content.submit}</button>
          <footer>
            {mode === 'login' && <>还没有账号？<Link to="/register">使用邀请码注册</Link></>}
            {mode === 'register' && <>已有账号？<Link to="/login">直接登录</Link></>}
            {mode === 'forgot' && <Link to="/login"><Icon name="arrowLeft" />返回登录</Link>}
          </footer>
        </form>
      </section>
    </main>
  )
}
