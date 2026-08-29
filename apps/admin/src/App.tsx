import { Navigate, Route, Routes } from 'react-router-dom'
import { Spin } from 'antd'
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
        <Route path="verifications" element={<Verifications />} />
        <Route path="posts" element={<Posts />} />
        <Route path="comments" element={<Comments />} />
        <Route path="reports" element={<Reports />} />
        <Route path="appeals" element={<Appeals />} />
        <Route path="users" element={<Users />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="tools" element={<Tools />} />
        <Route path="ai-providers" element={<AIProviders />} />
        <Route path="kb" element={<KB />} />
        <Route path="pending-questions" element={<PendingQuestions />} />
        <Route path="settings" element={<Settings />} />
        <Route path="roles" element={<Roles />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
