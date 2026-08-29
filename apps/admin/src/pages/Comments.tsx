import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Image,
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
import type { Comment, ContentStatus } from '../types'
import { contentStatusColor, contentStatusText } from './Posts'

const statusOptions = (
  Object.keys(contentStatusText) as ContentStatus[]
).map((s) => ({ value: s, label: contentStatusText[s] }))

export default function Comments() {
  const [items, setItems] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>()
  const [actionTarget, setActionTarget] = useState<{
    comment: Comment
    status: ContentStatus
  } | null>(null)
  const [reason, setReason] = useState('')
  const [acting, setActing] = useState(false)

  const load = useCallback((status?: string) => {
    setLoading(true)
    api
      .comments(status)
      .then((res) => setItems(res.items))
      .catch((err) => message.error(err.message ?? '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submit = async () => {
    if (!actionTarget) return
    if (!reason.trim()) {
      message.warning('请填写处理原因')
      return
    }
    setActing(true)
    try {
      await api.updateComment(
        actionTarget.comment.id,
        actionTarget.status,
        reason.trim(),
      )
      message.success('已更新评论状态')
      setActionTarget(null)
      setReason('')
      load(statusFilter)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败')
    } finally {
      setActing(false)
    }
  }

  const columns: ColumnsType<Comment> = [
    {
      title: '作者',
      dataIndex: ['author', 'nickname'],
    },
    {
      title: '内容',
      dataIndex: 'text',
      ellipsis: true,
      render: (text: string, record) => (
        <Space>
          {record.image && (
            <Image src={record.image} width={32} height={32} />
          )}
          {text}
        </Space>
      ),
    },
    { title: '帖子 ID', dataIndex: 'post_id', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: ContentStatus, record) => (
        <Space>
          <Tag color={contentStatusColor[status]}>
            {contentStatusText[status]}
          </Tag>
          {record.deleted && <Tag>用户已删除</Tag>}
        </Space>
      ),
    },
    {
      title: '发布时间',
      dataIndex: 'created_at',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_, record) => (
        <Space>
          {record.status !== 'public' && (
            <Button
              size="small"
              type="primary"
              onClick={() => {
                setActionTarget({ comment: record, status: 'public' })
                setReason('')
              }}
            >
              恢复公开
            </Button>
          )}
          {record.status !== 'removed' && (
            <Button
              size="small"
              danger
              onClick={() => {
                setActionTarget({ comment: record, status: 'removed' })
                setReason('')
              }}
            >
              下架
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h2 className="page-title">评论管理</h2>
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
          options={statusOptions}
        />
      </div>
      <Table<Comment>
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={columns}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        open={!!actionTarget}
        title={
          actionTarget?.status === 'removed' ? '下架评论' : '恢复评论公开'
        }
        okText="确认"
        okButtonProps={{
          danger: actionTarget?.status === 'removed',
          disabled: !reason.trim(),
        }}
        confirmLoading={acting}
        onOk={submit}
        onCancel={() => setActionTarget(null)}
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
