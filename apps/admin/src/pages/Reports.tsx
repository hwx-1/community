import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { api } from '../api'
import type { ReportItem, ReportStatus } from '../types'

const statusText: Record<ReportStatus, string> = {
  pending: '待处理',
  dismissed: '已驳回',
  actioned: '已处理',
}

const statusColor: Record<ReportStatus, string> = {
  pending: 'gold',
  dismissed: 'default',
  actioned: 'green',
}

const targetTypeText: Record<string, string> = {
  post: '帖子',
  comment: '评论',
  dm: '私信',
  user: '用户',
}

type ReportAction = 'restore' | 'takedown' | 'dismiss'

const actionText: Record<ReportAction, string> = {
  restore: '恢复展示',
  takedown: '下架内容',
  dismiss: '驳回举报',
}

export default function Reports() {
  const [items, setItems] = useState<ReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [target, setTarget] = useState<{
    item: ReportItem
    action: ReportAction
  } | null>(null)
  const [reason, setReason] = useState('')
  const [acting, setActing] = useState(false)

  const load = useCallback((status?: string) => {
    setLoading(true)
    api
      .reports(status)
      .then((res) => setItems(res.items))
      .catch((err) => message.error(err.message ?? '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load('pending')
  }, [load])

  const submit = async () => {
    if (!target) return
    if (!reason.trim()) {
      message.warning('请填写处理原因')
      return
    }
    setActing(true)
    try {
      await api.resolveReport(
        target.item.report.id,
        target.action,
        reason.trim(),
      )
      message.success(`${actionText[target.action]}成功`)
      setTarget(null)
      setReason('')
      load(statusFilter)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败')
    } finally {
      setActing(false)
    }
  }

  const openAction = (item: ReportItem, action: ReportAction) => {
    setTarget({ item, action })
    setReason('')
  }

  const columns: ColumnsType<ReportItem> = [
    { title: '举报人', dataIndex: 'reporter' },
    {
      title: '举报对象',
      key: 'target',
      render: (_, record) => (
        <span>
          <Tag>{targetTypeText[record.report.target_type] ?? record.report.target_type}</Tag>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>
            {record.report.target_id}
          </span>
        </span>
      ),
    },
    { title: '举报原因', dataIndex: ['report', 'reason'], ellipsis: true },
    {
      title: '状态',
      dataIndex: ['report', 'status'],
      render: (status: ReportStatus) => (
        <Tag color={statusColor[status]}>{statusText[status]}</Tag>
      ),
    },
    {
      title: '处理结果',
      dataIndex: ['report', 'result'],
      render: (v?: string) => v || '—',
    },
    {
      title: '举报时间',
      dataIndex: ['report', 'created_at'],
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 260,
      render: (_, record) =>
        record.report.status === 'pending' ? (
          <Space>
            <Button size="small" onClick={() => openAction(record, 'restore')}>
              恢复展示
            </Button>
            <Button
              size="small"
              danger
              onClick={() => openAction(record, 'takedown')}
            >
              下架
            </Button>
            <Button
              size="small"
              onClick={() => openAction(record, 'dismiss')}
            >
              驳回举报
            </Button>
          </Space>
        ) : (
          <span style={{ color: '#94a3b8' }}>已办结</span>
        ),
    },
  ]

  return (
    <div>
      <h2 className="page-title">举报处理</h2>
      <div className="page-toolbar">
        <Select
          allowClear
          placeholder="按状态筛选"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value)
            load(value)
          }}
          options={(['pending', 'dismissed', 'actioned'] as ReportStatus[]).map(
            (s) => ({ value: s, label: statusText[s] }),
          )}
        />
      </div>
      <Table<ReportItem>
        rowKey={(record) => record.report.id}
        loading={loading}
        dataSource={items}
        columns={columns}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        open={!!target}
        title={target ? actionText[target.action] : ''}
        okText="确认"
        okButtonProps={{
          danger: target?.action === 'takedown',
          disabled: !reason.trim(),
        }}
        confirmLoading={acting}
        onOk={submit}
        onCancel={() => setTarget(null)}
      >
        <Input.TextArea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="处理原因（必填）"
        />
      </Modal>
    </div>
  )
}
