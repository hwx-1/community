import { Layout, Menu, Button, message } from 'antd'
import {
  DashboardOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  CommentOutlined,
  FlagOutlined,
  AlertOutlined,
  TeamOutlined,
  NotificationOutlined,
  AppstoreOutlined,
  RobotOutlined,
  BookOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
  KeyOutlined,
  HistoryOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

const { Sider, Header, Content } = Layout

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  {
    key: '/verifications',
    icon: <SafetyCertificateOutlined />,
    label: '认证审核',
  },
  { key: '/posts', icon: <FileTextOutlined />, label: '帖子管理' },
  { key: '/comments', icon: <CommentOutlined />, label: '评论管理' },
  { key: '/reports', icon: <FlagOutlined />, label: '举报处理' },
  { key: '/appeals', icon: <AlertOutlined />, label: '申诉处理' },
  { key: '/users', icon: <TeamOutlined />, label: '用户管理' },
  { key: '/announcements', icon: <NotificationOutlined />, label: '公告管理' },
  { key: '/tools', icon: <AppstoreOutlined />, label: '百宝箱工具' },
  { key: '/ai-providers', icon: <RobotOutlined />, label: 'AI 服务' },
  { key: '/kb', icon: <BookOutlined />, label: '知识库' },
  {
    key: '/pending-questions',
    icon: <QuestionCircleOutlined />,
    label: '待补充问题',
  },
  { key: '/settings', icon: <SettingOutlined />, label: '运营配置' },
  { key: '/roles', icon: <KeyOutlined />, label: '角色权限' },
  { key: '/audit-logs', icon: <HistoryOutlined />, label: '操作日志' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { admin, logout } = useAuth()

  const selectedKey =
    menuItems.find((item) => location.pathname.startsWith(item.key))?.key ??
    '/dashboard'

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch {
      message.error('退出失败，请重试')
    }
  }

  return (
    <Layout className="admin-layout">
      <Sider theme="light" width={208}>
        <div className="admin-sider-logo">xsnbb 运营后台</div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 'none' }}
        />
      </Sider>
      <Layout>
        <Header className="admin-header">
          <span className="admin-header-username">
            {admin?.username}
            {admin?.is_super ? '（超级管理员）' : ''}
          </span>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
          >
            退出
          </Button>
        </Header>
        <Content className="admin-content">
          <div className="admin-content-inner">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
