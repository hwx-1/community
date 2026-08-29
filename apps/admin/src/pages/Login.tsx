import { useState } from 'react'
import { Button, Form, Input } from 'antd'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'

interface LoginForm {
  username: string
  password: string
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const onFinish = async (values: LoginForm) => {
    setSubmitting(true)
    setError('')
    try {
      await login(values.username, values.password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('登录名或密码错误')
      } else {
        setError(err instanceof Error ? err.message : '登录失败，请稍后重试')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">xsnbb 运营后台</h1>
        <p className="login-subtitle">沈阳大学校园社区 · 管理端</p>
        <Form<LoginForm> layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="username"
            label="登录名"
            rules={[{ required: true, message: '请输入登录名' }]}
          >
            <Input autoComplete="username" placeholder="请输入登录名" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              autoComplete="current-password"
              placeholder="请输入密码"
            />
          </Form.Item>
          {error && (
            <Form.Item>
              <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>
            </Form.Item>
          )}
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              登录
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}
