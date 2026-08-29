import { useEffect, useMemo, useState } from 'react'
import { Alert, Input, Select, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { api } from '../api'
import type { AuditLog } from '../types'

export default function AuditLogs() {
  const [items, setItems] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string>()
  const [operator, setOperator] = useState('')
  const [action, setAction] = useState('')

  useEffect(() => {
    api
      .auditLogs()
      .then((res) => setItems(res.items))
      .catch((err) => message.error(err.message ?? '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  // 前端过滤：类别 / 操作人 / 动作关键词
  const filtered = useMemo(
    () =>
      items.filter((log) => {
        if (category && log.category !== category) return false
        if (
          operator &&
          !log.operator.toLowerCase().includes(operator.toLowerCase())
        )
          return false
        if (
          action &&
          !log.action.toLowerCase().includes(action.toLowerCase())
        )
          return false
        return true
      }),
    [items, category, operator, action],
  )

  const columns: ColumnsType<AuditLog> = [
    {
      title: '类别',
      dataIndex: 'category',
      width: 100,
      render: (c: AuditLog['category']) =>
        c === 'security' ? (
          <Tag color="red">安全</Tag>
        ) : (
          <Tag color="blue">操作</Tag>
        ),
    },
    { title: '操作人', dataIndex: 'operator', width: 140 },
    { title: '动作', dataIndex: 'action', width: 180 },
    { title: '对象', dataIndex: 'target', ellipsis: true },
    { title: '结果', dataIndex: 'result', width: 120 },
    {
      title: '原因',
      dataIndex: 'reason',
      ellipsis: true,
      render: (v?: string) => v || '—',
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
  ]

  return (
    <div>
      <h2 className="page-title">操作日志</h2>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="安全类日志归档至少保留 6 个月；操作类日志默认展示最近 15 天，90 天后物理删除。日志仅追加，不提供修改和删除。"
      />
      <div className="page-toolbar">
        <Select
          allowClear
          placeholder="按类别筛选"
          style={{ width: 140 }}
          value={category}
          onChange={setCategory}
          options={[
            { value: 'security', label: '安全' },
            { value: 'operational', label: '操作' },
          ]}
        />
        <Input
          allowClear
          placeholder="按操作人筛选"
          style={{ width: 180 }}
          value={operator}
          onChange={(e) => setOperator(e.target.value)}
        />
        <Input
          allowClear
          placeholder="按动作关键词筛选"
          style={{ width: 200 }}
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
      </div>
      <Table<AuditLog>
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        columns={columns}
        pagination={{ pageSize: 20 }}
      />
    </div>
  )
}
