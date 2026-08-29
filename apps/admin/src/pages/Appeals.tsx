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
import type { AppealItem, AppealStatus } from '../types'

const statusText: Record<AppealStatus, string> = {
  pending: '待处理',
  upheld: '已维持',
  lifted: '已解除',
}

const statusColor: Record<AppealStatus, string> = {
  pending: 'gold',
  upheld: 'red',
  lifted: 'green',
}

type AppealAction = 'uphold' | 'lift'

const actionText: Record<AppealAction, string> = {
  uphold: '维持处罚',
  lift: '解除处罚',
}

export default function Appeals() {
  const [items, setItems] = useState<AppealItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [target, setTarget] = useState<{
    item: AppealItem
    action: AppealAction
  } | null>(null)
  const [reason, setReason] = useState('')
  const [acting, setActing] = useState(false)

  const load = useCallback((status?: string) => {
    setLoading(true)
    api
      .appeals(status)
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
      await api.resolveAppeal(
        target.item.appeal.id,
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

  const columns: ColumnsType<AppealItem> = [
    { title: '申诉人', dataIndex: 'nickname' },
    {
      title: '处罚类型',
      dataIndex: ['appeal', 'kind'],
      render: (kind: string) => (
        <Tag color={kind === 'ban' ? 'red' : 'orange'}>
          {kind === 'ban' ? '封禁' : '禁言'}
        </Tag>
      ),
    },
    { title: '申诉理由', dataIndex: ['appeal', 'reason'], ellipsis: true },
    {
      title: '状态',
      dataIndex: ['appeal', 'status'],
      render: (status: AppealStatus) => (
        <Tag color={statusColor[status]}>{statusText[status]}</Tag>
      ),
    },
    {
      title: '处理结果',
      dataIndex: ['appeal', 'result'],
      render: (v?: string) => v || '—',
    },
    {
      title: '申诉时间',
      dataIndex: ['appeal', 'created_at'],
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) =>
        record.appeal.status === 'pending' ? (
          <Space>
            <Button
              size="small"
              danger
              onClick={() => {
                setTarget({ item: record, action: 'uphold' })
                setReason('')
              }}
            >
              维持处罚
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={() => {
                setTarget({ item: record, action: 'lift' })
                setReason('')
              }}
            >
              解除处罚
            </Button>
          </Space>
        ) : (
          <span style={{ color: '#94a3b8' }}>已办结</span>
        ),
    },
  ]

  return (
    <div>
      <h2 className="page-title">申诉处理</h2>
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
          options={(['pending', 'upheld', 'lifted'] as AppealStatus[]).map(
            (s) => ({ value: s, label: statusText[s] }),
          )}
        />
      </div>
      <Table<AppealItem>
        rowKey={(record) => record.appeal.id}
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
          danger: target?.action === 'uphold',
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
          placeholder="处理原因（必填，将展示给申诉用户）"
        />
      </Modal>
    </div>
  )
}
