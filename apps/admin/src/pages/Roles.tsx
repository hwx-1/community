import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  EditOutlined,
  KeyOutlined,
  LockOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { api } from '../api'
import { useAuth } from '../auth'
import type { AdminAccount, Role } from '../types'

const { Text, Paragraph } = Typography

const permissionDescriptions: Record<string, string> = {
  'verification.review': '学生认证审核',
  'profile.private.read': '查看身份资料',
  'post.moderate': '帖子审核与置顶',
  'comment.moderate': '评论审核',
  'report.review': '举报处理',
  'appeal.review': '申诉处理',
  'user.manage': '用户状态与处罚',
  'tool.manage': '百宝箱配置',
  'ai_provider.manage': 'AI 服务配置',
  'kb.manage': '知识库维护',
  'pending_question.answer': '待补充问题答复',
  'settings.manage': '运营配置',
  'dm.read': '举报场景私信查看',
  'audit.security.read': '安全审计归档查看',
}

type AdminFormValue = {
  username: string
  password: string
  confirm_password: string
  role_ids: number[]
  enabled?: boolean
}

type RoleFormValue = { name: string; permissions: string[] }

export default function Roles() {
  const { admin: currentAdmin } = useAuth()
  const [roles, setRoles] = useState<Role[]>([])
  const [admins, setAdmins] = useState<AdminAccount[]>([])
  const [catalog, setCatalog] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [adminModal, setAdminModal] = useState<'create' | 'edit' | null>(null)
  const [roleModal, setRoleModal] = useState<'create' | 'edit' | null>(null)
  const [passwordModal, setPasswordModal] = useState(false)
  const [selectedAdmin, setSelectedAdmin] = useState<AdminAccount | null>(null)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [adminForm] = Form.useForm<AdminFormValue>()
  const [roleForm] = Form.useForm<RoleFormValue>()
  const [passwordForm] = Form.useForm<{ password: string; confirm: string }>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [roleResult, adminResult] = await Promise.all([
        api.roles(),
        api.admins(),
      ])
      setRoles(roleResult.items)
      setCatalog(roleResult.permission_catalog)
      setAdmins(adminResult.items)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '管理员配置加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (currentAdmin?.is_super) void load()
    else setLoading(false)
  }, [currentAdmin?.is_super, load])

  const assignableRoles = useMemo(
    () => roles.filter((role) => !role.protected),
    [roles],
  )

  if (!currentAdmin?.is_super) {
    return (
      <Alert
        type="warning"
        showIcon
        message="仅超级管理员可进入管理员与角色配置"
        description="普通管理员的操作范围由已分配角色决定。如需调整，请联系超级管理员。"
      />
    )
  }

  const openCreateAdmin = () => {
    setSelectedAdmin(null)
    adminForm.resetFields()
    adminForm.setFieldsValue({ role_ids: [] })
    setAdminModal('create')
  }

  const openEditAdmin = (item: AdminAccount) => {
    setSelectedAdmin(item)
    adminForm.setFieldsValue({ role_ids: item.role_ids, enabled: item.enabled })
    setAdminModal('edit')
  }

  const saveAdmin = async () => {
    const values = await adminForm.validateFields()
    setSaving(true)
    try {
      if (adminModal === 'create') {
        await api.createAdmin({
          username: values.username.trim(),
          password: values.password,
          role_ids: values.role_ids ?? [],
        })
        message.success('管理员账号已创建')
      } else if (selectedAdmin) {
        await api.updateAdmin(selectedAdmin.username, {
          role_ids: values.role_ids ?? [],
          enabled: values.enabled,
        })
        message.success('管理员授权已更新')
      }
      setAdminModal(null)
      await load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const toggleAdmin = async (item: AdminAccount, enabled: boolean) => {
    try {
      await api.updateAdmin(item.username, {
        role_ids: item.role_ids,
        enabled,
      })
      message.success(enabled ? '管理员已启用' : '管理员已停用，现有会话已失效')
      await load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '状态更新失败')
    }
  }

  const resetPassword = async () => {
    if (!selectedAdmin) return
    const values = await passwordForm.validateFields()
    setSaving(true)
    try {
      await api.resetAdminPassword(selectedAdmin.username, values.password)
      message.success('密码已重置，该管理员原有会话已失效')
      setPasswordModal(false)
      passwordForm.resetFields()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '密码重置失败')
    } finally {
      setSaving(false)
    }
  }

  const openRole = (mode: 'create' | 'edit', role?: Role) => {
    setSelectedRole(role ?? null)
    roleForm.resetFields()
    roleForm.setFieldsValue(
      role
        ? { name: role.name, permissions: role.permissions }
        : { name: '', permissions: [] },
    )
    setRoleModal(mode)
  }

  const saveRole = async () => {
    const values = await roleForm.validateFields()
    setSaving(true)
    try {
      if (roleModal === 'create') {
        await api.createRole(values)
        message.success('角色已创建')
      } else if (selectedRole) {
        await api.updateRole(selectedRole.id, values)
        message.success('角色权限已更新，并立即应用到关联管理员')
      }
      setRoleModal(null)
      await load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '角色保存失败')
    } finally {
      setSaving(false)
    }
  }

  const deleteRole = async (role: Role) => {
    try {
      await api.deleteRole(role.id)
      message.success('角色已删除')
      await load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '角色删除失败')
    }
  }

  const adminColumns = [
    {
      title: '管理员',
      key: 'admin',
      render: (_: unknown, item: AdminAccount) => (
        <Space direction="vertical" size={2}>
          <Space>
            <Text strong>{item.username}</Text>
            {item.is_super && <Tag color="red">超级管理员</Tag>}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            创建于 {new Date(item.created_at).toLocaleDateString('zh-CN')}
          </Text>
        </Space>
      ),
    },
    {
      title: '角色',
      key: 'roles',
      render: (_: unknown, item: AdminAccount) =>
        item.role_names.length ? (
          item.role_names.map((name) => <Tag key={name}>{name}</Tag>)
        ) : (
          <Text type="secondary">未分配角色</Text>
        ),
    },
    {
      title: '有效权限',
      key: 'permissions',
      responsive: ['lg' as const],
      render: (_: unknown, item: AdminAccount) =>
        item.permissions.includes('*') ? (
          <Tag color="red">全部权限</Tag>
        ) : (
          <Tooltip
            title={item.permissions
              .map((permission) => permissionDescriptions[permission] ?? permission)
              .join('、')}
          >
            <Tag color={item.permissions.length ? 'blue' : 'default'}>
              {item.permissions.length} 项权限
            </Tag>
          </Tooltip>
        ),
    },
    {
      title: '状态',
      key: 'enabled',
      render: (_: unknown, item: AdminAccount) => (
        <Badge
          status={item.enabled ? 'success' : 'default'}
          text={item.enabled ? '已启用' : '已停用'}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 250,
      render: (_: unknown, item: AdminAccount) =>
        item.is_super ? (
          <Text type="secondary">受保护账号</Text>
        ) : (
          <Space wrap>
            <Button size="small" icon={<EditOutlined />} onClick={() => openEditAdmin(item)}>
              授权
            </Button>
            <Button
              size="small"
              icon={<LockOutlined />}
              onClick={() => {
                setSelectedAdmin(item)
                passwordForm.resetFields()
                setPasswordModal(true)
              }}
            >
              重置密码
            </Button>
            <Popconfirm
              title={item.enabled ? '确认停用该管理员？' : '确认重新启用？'}
              description={item.enabled ? '停用后，其所有已登录会话会立即失效。' : undefined}
              okText="确认"
              cancelText="取消"
              okButtonProps={item.enabled ? { danger: true } : undefined}
              onConfirm={() => toggleAdmin(item, !item.enabled)}
            >
              <Button size="small" danger={item.enabled} icon={<StopOutlined />}>
                {item.enabled ? '停用' : '启用'}
              </Button>
            </Popconfirm>
          </Space>
        ),
    },
  ]

  const roleColumns = [
    {
      title: '角色',
      key: 'role',
      render: (_: unknown, role: Role) => (
        <Space direction="vertical" size={2}>
          <Space>
            <Text strong>{role.name}</Text>
            {role.protected && <Tag color="red">系统保护</Tag>}
          </Space>
          <Text type="secondary">{role.assigned_admins} 名管理员使用</Text>
        </Space>
      ),
    },
    {
      title: '权限范围',
      key: 'permissions',
      render: (_: unknown, role: Role) => (
        <Space size={[4, 6]} wrap>
          {role.permissions.includes('*') ? (
            <Tag color="red">全部权限（*）</Tag>
          ) : (
            role.permissions.map((permission) => (
              <Tag key={permission} color="blue">
                {permissionDescriptions[permission] ?? permission}
              </Tag>
            ))
          )}
          {!role.permissions.length && <Text type="secondary">无权限</Text>}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 170,
      render: (_: unknown, role: Role) =>
        role.protected ? (
          <Text type="secondary">不可修改</Text>
        ) : (
          <Space>
            <Button size="small" onClick={() => openRole('edit', role)}>编辑</Button>
            <Popconfirm
              title="确认删除角色？"
              description={role.assigned_admins ? '请先从所有管理员账号中移除此角色。' : '删除后不可恢复。'}
              disabled={role.assigned_admins > 0}
              onConfirm={() => deleteRole(role)}
            >
              <Button size="small" danger disabled={role.assigned_admins > 0}>删除</Button>
            </Popconfirm>
          </Space>
        ),
    },
  ]

  return (
    <div>
      <div className="page-heading-row">
        <div>
          <h2 className="page-title" style={{ marginBottom: 4 }}>管理员与权限</h2>
          <Text type="secondary">创建独立运营账号，通过角色授予最小必要权限。</Text>
        </div>
        <Space>
          <Button icon={<SafetyCertificateOutlined />} onClick={() => openRole('create')}>新建角色</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateAdmin}>添加管理员</Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="管理员账号与学生账号相互独立"
        description="普通管理员只能访问其角色授权的模块。角色调整立即生效；停用账号或重置密码会使该管理员的现有会话失效。"
      />

      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={8}>
            <Card><Statistic title="管理员账号" value={admins.length} prefix={<TeamOutlined />} suffix="个" /></Card>
          </Col>
          <Col xs={24} md={8}>
            <Card><Statistic title="启用中" value={admins.filter((item) => item.enabled).length} prefix={<Badge status="success" />} suffix="个" /></Card>
          </Col>
          <Col xs={24} md={8}>
            <Card><Statistic title="可分配角色" value={assignableRoles.length} prefix={<KeyOutlined />} suffix="个" /></Card>
          </Col>
        </Row>

        <Card>
          <Tabs
            items={[
              {
                key: 'admins',
                label: `管理员账号（${admins.length}）`,
                children: <Table rowKey="username" columns={adminColumns} dataSource={admins} pagination={false} scroll={{ x: 900 }} />,
              },
              {
                key: 'roles',
                label: `角色权限（${roles.length}）`,
                children: <Table rowKey="id" columns={roleColumns} dataSource={roles} pagination={false} scroll={{ x: 760 }} />,
              },
            ]}
          />
        </Card>
      </Spin>

      <Modal
        open={adminModal !== null}
        title={adminModal === 'create' ? '添加管理员' : `配置 ${selectedAdmin?.username}`}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        onOk={() => void saveAdmin()}
        onCancel={() => setAdminModal(null)}
        destroyOnClose
      >
        <Form form={adminForm} layout="vertical" preserve={false}>
          {adminModal === 'create' && (
            <>
              <Form.Item
                name="username"
                label="后台登录名"
                extra="以字母开头，3–32 位，仅支持字母、数字和下划线。"
                rules={[
                  { required: true, message: '请输入登录名' },
                  { pattern: /^[A-Za-z][A-Za-z0-9_]{2,31}$/, message: '登录名格式不正确' },
                ]}
              >
                <Input autoComplete="off" placeholder="例如 content_reviewer" />
              </Form.Item>
              <Form.Item name="password" label="初始密码" rules={[{ required: true }, { min: 8, message: '密码至少 8 位' }]}>
                <Input.Password autoComplete="new-password" placeholder="至少 8 位" />
              </Form.Item>
              <Form.Item
                name="confirm_password"
                label="确认初始密码"
                dependencies={['password']}
                rules={[
                  { required: true },
                  ({ getFieldValue }) => ({ validator: (_, value) => !value || getFieldValue('password') === value ? Promise.resolve() : Promise.reject(new Error('两次密码不一致')) }),
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
            </>
          )}
          <Form.Item name="role_ids" label="分配角色" extra="可分配多个角色，最终权限为各角色权限的并集。">
            <Select
              mode="multiple"
              allowClear
              placeholder="选择角色"
              options={assignableRoles.map((role) => ({ label: role.name, value: role.id }))}
              optionRender={(option) => {
                const role = assignableRoles.find((item) => item.id === option.value)
                return <div><Text>{option.label}</Text><div><Text type="secondary" style={{ fontSize: 12 }}>{role?.permissions.length ?? 0} 项权限</Text></div></div>
              }}
            />
          </Form.Item>
          {adminModal === 'edit' && (
            <Form.Item name="enabled" label="允许登录" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="停用" />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        open={passwordModal}
        title={`重置 ${selectedAdmin?.username ?? ''} 的密码`}
        okText="确认重置"
        cancelText="取消"
        confirmLoading={saving}
        onOk={() => void resetPassword()}
        onCancel={() => setPasswordModal(false)}
        destroyOnClose
      >
        <Alert type="warning" showIcon message="重置后，该管理员所有已登录会话会立即失效。" style={{ marginBottom: 16 }} />
        <Form form={passwordForm} layout="vertical" preserve={false}>
          <Form.Item name="password" label="新密码" rules={[{ required: true }, { min: 8, message: '密码至少 8 位' }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="确认新密码"
            dependencies={['password']}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({ validator: (_, value) => !value || getFieldValue('password') === value ? Promise.resolve() : Promise.reject(new Error('两次密码不一致')) }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={roleModal !== null}
        title={roleModal === 'create' ? '新建角色' : `编辑 ${selectedRole?.name ?? ''}`}
        width={720}
        okText="保存角色"
        cancelText="取消"
        confirmLoading={saving}
        onOk={() => void saveRole()}
        onCancel={() => setRoleModal(null)}
        destroyOnClose
      >
        <Form form={roleForm} layout="vertical" preserve={false}>
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }, { max: 30 }]}>
            <Input placeholder="例如：校园资料维护" />
          </Form.Item>
          <Form.Item name="permissions" label="权限点" extra="建议只勾选完成该职责必需的权限。">
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[12, 12]}>
                {catalog.map((permission) => (
                  <Col xs={24} md={12} key={permission}>
                    <Card size="small" styles={{ body: { padding: 12 } }}>
                      <Checkbox value={permission}>
                        <Text strong>{permissionDescriptions[permission] ?? permission}</Text>
                      </Checkbox>
                      <Paragraph copyable={{ text: permission }} type="secondary" style={{ margin: '5px 0 0 24px', fontSize: 12 }}>
                        {permission}
                      </Paragraph>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
