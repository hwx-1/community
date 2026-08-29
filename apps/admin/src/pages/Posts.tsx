import { useCallback, useEffect, useMemo, useState } from 'react'
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
import type { ContentStatus, Post } from '../types'

export const contentStatusText: Record<ContentStatus, string> = {
  public: '公开',
  pending: '待审核',
  rejected: '已拒绝',
  reported_hidden: '举报隐藏',
  removed: '已下架',
  deleted: '已删除',
}

export const contentStatusColor: Record<ContentStatus, string> = {
  public: 'green',
  pending: 'gold',
  rejected: 'red',
  reported_hidden: 'orange',
  removed: 'volcano',
  deleted: 'default',
}

const statusOptions = (
  Object.keys(contentStatusText) as ContentStatus[]
).map((s) => ({ value: s, label: contentStatusText[s] }))

export default function Posts() {
  const [items, setItems] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>()
  const [keyword, setKeyword] = useState('')
  const [removeTarget, setRemoveTarget] = useState<Post | null>(null)
  const [removeReason, setRemoveReason] = useState('')
  const [acting, setActing] = useState(false)

  const load = useCallback((q?: string) => {
    setLoading(true)
    api
      .posts(q)
      .then((res) => setItems(res.items))
      .catch((err) => message.error(err.message ?? '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(
    () =>
      statusFilter ? items.filter((p) => p.status === statusFilter) : items,
    [items, statusFilter],
  )

  const patch = async (
    post: Post,
    body: { status?: string; pinned?: boolean; reason?: string },
    okText: string,
  ) => {
    setActing(true)
    try {
      await api.updatePost(post.id, body)
      message.success(okText)
      load(keyword || undefined)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败')
    } finally {
      setActing(false)
    }
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    if (!removeReason.trim()) {
      message.warning('下架必须填写原因')
      return
    }
    await patch(
      removeTarget,
      { status: 'removed', reason: removeReason.trim() },
      '已下架',
    )
    setRemoveTarget(null)
    setRemoveReason('')
  }

  const columns: ColumnsType<Post> = [
    {
      title: '作者',
      dataIndex: ['author', 'nickname'],
      render: (_, record) => (
        <Space>
          {record.author.nickname}
          {record.author.verified && <Tag color="blue">已认证</Tag>}
        </Space>
      ),
    },
    {
      title: '内容',
      dataIndex: 'text',
      ellipsis: true,
      render: (text: string, record) => (
        <span>
          {record.pinned && <Tag color="red">置顶</Tag>}
          {text}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: ContentStatus) => (
        <Tag color={contentStatusColor[status]}>
          {contentStatusText[status]}
        </Tag>
      ),
    },
    { title: '点赞', dataIndex: 'likes', width: 80 },
    { title: '评论', dataIndex: 'comments', width: 80 },
    {
      title: '发布时间',
      dataIndex: 'created_at',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 260,
      render: (_, record) => (
        <Space wrap>
          {record.status !== 'removed' && record.status !== 'deleted' && (
            <Button
              size="small"
              danger
              onClick={() => {
                setRemoveTarget(record)
                setRemoveReason('')
              }}
            >
              下架
            </Button>
          )}
          {record.status === 'removed' && (
            <Button
              size="small"
              type="primary"
              loading={acting}
              onClick={() =>
                patch(record, { status: 'public' }, '已恢复公开')
              }
            >
              恢复公开
            </Button>
          )}
          <Button
            size="small"
            loading={acting}
            onClick={() =>
              patch(
                record,
                { pinned: !record.pinned },
                record.pinned ? '已取消置顶' : '已置顶',
              )
            }
          >
            {record.pinned ? '取消置顶' : '置顶'}
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h2 className="page-title">帖子管理</h2>
      <div className="page-toolbar">
        <Select
          allowClear
          placeholder="按状态筛选"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
        />
        <Input.Search
          placeholder="搜索帖子关键词"
          style={{ width: 280 }}
          allowClear
          onSearch={(value) => {
            setKeyword(value)
            load(value || undefined)
          }}
        />
      </div>
      <Table<Post>
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        columns={columns}
        pagination={{ pageSize: 20 }}
        expandable={{
          expandedRowRender: (record) => (
            <div>
              <p className="post-detail-text">{record.text}</p>
              {record.tags && record.tags.length > 0 && (
                <Space style={{ marginBottom: 12 }}>
                  {record.tags.map((tag) => (
                    <Tag key={tag}>#{tag}</Tag>
                  ))}
                </Space>
              )}
              {record.images && record.images.length > 0 && (
                <div className="post-detail-images">
                  <Image.PreviewGroup>
                    {record.images.map((src) => (
                      <Image
                        key={src}
                        src={src}
                        width={96}
                        height={96}
                        style={{
                          objectFit: 'cover',
                          borderRadius: 6,
                          border: '1px solid #e2e8f0',
                        }}
                      />
                    ))}
                  </Image.PreviewGroup>
                </div>
              )}
            </div>
          ),
        }}
      />

      <Modal
        open={!!removeTarget}
        title="下架帖子"
        okText="确认下架"
        okButtonProps={{ danger: true, disabled: !removeReason.trim() }}
        confirmLoading={acting}
        onOk={handleRemove}
        onCancel={() => setRemoveTarget(null)}
      >
        <p style={{ color: '#64748b' }}>
          下架后帖子将对用户不可见，请填写下架原因：
        </p>
        <Input.TextArea
          rows={3}
          value={removeReason}
          onChange={(e) => setRemoveReason(e.target.value)}
          placeholder="下架原因（必填）"
        />
      </Modal>
    </div>
  )
}
