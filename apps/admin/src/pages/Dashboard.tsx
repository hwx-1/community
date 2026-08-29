import { useEffect, useState } from 'react'
import { Card, Col, List, Row, Statistic, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { api } from '../api'
import type { Dashboard as DashboardData } from '../types'

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .dashboard()
      .then(setData)
      .catch((err) => message.error(err.message ?? '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  const stats = [
    { title: '注册用户', value: data?.users },
    { title: '公开帖子', value: data?.public_posts },
    { title: '待审核认证', value: data?.pending_verifications },
    { title: 'AI 服务', value: data?.ai_providers },
  ]

  return (
    <div>
      <h2 className="page-title">仪表盘</h2>
      <Row gutter={[16, 16]}>
        {stats.map((s) => (
          <Col xs={12} md={6} key={s.title}>
            <Card loading={loading}>
              <Statistic title={s.title} value={s.value ?? 0} />
            </Card>
          </Col>
        ))}
      </Row>
      <Card title="最近操作日志" style={{ marginTop: 16 }} loading={loading}>
        <List
          dataSource={data?.recent_audits ?? []}
          locale={{ emptyText: '暂无操作日志' }}
          renderItem={(log) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <span>
                    <Tag
                      color={
                        log.category === 'security' ? 'red' : 'blue'
                      }
                    >
                      {log.category === 'security' ? '安全' : '操作'}
                    </Tag>
                    {log.operator} · {log.action} · {log.target}
                  </span>
                }
                description={
                  <span>
                    结果：{log.result}
                    {log.reason ? ` · 原因：${log.reason}` : ''}
                  </span>
                }
              />
              <span style={{ color: '#94a3b8', fontSize: 12 }}>
                {dayjs(log.created_at).format('YYYY-MM-DD HH:mm')}
              </span>
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}
