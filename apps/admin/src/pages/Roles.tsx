import { useEffect, useState } from 'react'
import { Alert, Card, Col, Row, Spin, Tag, message } from 'antd'
import { api } from '../api'
import type { Role } from '../types'

const permissionDescriptions: Record<string, string> = {
  'verification.review': '认证审核',
  'post.moderate': '内容审核',
  'report.review': '举报处理',
  'profile.private.read': '身份资料查看',
  'dm.read': '私信查看',
  'tool.manage': '百宝箱配置',
  'ai_provider.manage': 'AI 服务配置',
  'audit.security.read': '安全审计归档查看',
}

export default function Roles() {
  const [roles, setRoles] = useState<Role[]>([])
  const [catalog, setCatalog] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .roles()
      .then((res) => {
        setRoles(res.items)
        setCatalog(res.permission_catalog)
      })
      .catch((err) => message.error(err.message ?? '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <h2 className="page-title">角色权限</h2>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="首版授权由超级管理员直接管理，以下角色为预置示例，仅供查看。"
      />
      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          {roles.map((role) => (
            <Col xs={24} md={12} lg={8} key={role.id}>
              <Card title={role.name} size="small">
                {role.permissions.includes('*') ? (
                  <Tag color="red">全部权限（*）</Tag>
                ) : (
                  role.permissions.map((p) => (
                    <Tag key={p} style={{ marginBottom: 8 }}>
                      {permissionDescriptions[p] ?? p}
                      {permissionDescriptions[p] ? `（${p}）` : ''}
                    </Tag>
                  ))
                )}
              </Card>
            </Col>
          ))}
        </Row>

        <Card title="权限点目录" size="small" style={{ marginTop: 16 }}>
          {catalog.length === 0 ? (
            <span style={{ color: '#94a3b8' }}>暂无权限点</span>
          ) : (
            catalog.map((p) => (
              <div key={p} style={{ padding: '6px 0' }}>
                <code>{p}</code>
                <span style={{ marginLeft: 12, color: '#475569' }}>
                  {permissionDescriptions[p] ?? '（暂无说明）'}
                </span>
              </div>
            ))
          )}
        </Card>
      </Spin>
    </div>
  )
}
