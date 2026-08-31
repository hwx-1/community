import { Navigate, Route, Routes } from 'react-router-dom'
import { Result, Spin } from 'antd'
import type { ReactNode } from 'react'
import { useAuth } from './auth'
import AdminLayout from './layouts/AdminLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Verifications from './pages/Verifications'
import Posts from './pages/Posts'
import Comments from './pages/Comments'
import Reports from './pages/Reports'
import Appeals from './pages/Appeals'
import Users from './pages/Users'
import Announcements from './pages/Announcements'
import Tools from './pages/Tools'
import AIProviders from './pages/AIProviders'
import KB from './pages/KB'
import PendingQuestions from './pages/PendingQuestions'
import Settings from './pages/Settings'
import Roles from './pages/Roles'
import AuditLogs from './pages/AuditLogs'

function RequireAuth({ children }: { children: ReactNode }) {
  const { admin, loading } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin size="large" tip="正在恢复会话…">
          <div style={{ width: 200, height: 60 }} />
        </Spin>
      </div>
    )
  }

  if (!admin) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PermissionGate({
  children,
  permission,
  superOnly = false,
}: {
  children: ReactNode
  permission?: string
  superOnly?: boolean
}) {
  const { admin } = useAuth()
  const allowed =
    !!admin &&
    (!superOnly || admin.is_super) &&
    (!permission ||
      admin.is_super ||
      admin.permissions.includes('*') ||
      admin.permissions.includes(permission))

  if (!allowed) {
    return (
      <Result
        status="403"
        title="没有访问权限"
        subTitle="当前管理员角色未获得此模块权限，请联系超级管理员调整授权。"
      />
    )
  }
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="verifications" element={<PermissionGate permission="verification.review"><Verifications /></PermissionGate>} />
        <Route path="posts" element={<PermissionGate permission="post.moderate"><Posts /></PermissionGate>} />
        <Route path="comments" element={<PermissionGate permission="comment.moderate"><Comments /></PermissionGate>} />
        <Route path="reports" element={<PermissionGate permission="report.review"><Reports /></PermissionGate>} />
        <Route path="appeals" element={<PermissionGate permission="appeal.review"><Appeals /></PermissionGate>} />
        <Route path="users" element={<PermissionGate permission="user.manage"><Users /></PermissionGate>} />
        <Route path="announcements" element={<PermissionGate superOnly><Announcements /></PermissionGate>} />
        <Route path="tools" element={<PermissionGate permission="tool.manage"><Tools /></PermissionGate>} />
        <Route path="ai-providers" element={<PermissionGate permission="ai_provider.manage"><AIProviders /></PermissionGate>} />
        <Route path="kb" element={<PermissionGate permission="kb.manage"><KB /></PermissionGate>} />
        <Route path="pending-questions" element={<PermissionGate permission="pending_question.answer"><PendingQuestions /></PermissionGate>} />
        <Route path="settings" element={<PermissionGate permission="settings.manage"><Settings /></PermissionGate>} />
        <Route path="roles" element={<PermissionGate superOnly><Roles /></PermissionGate>} />
        <Route path="audit-logs" element={<PermissionGate permission="audit.security.read"><AuditLogs /></PermissionGate>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
