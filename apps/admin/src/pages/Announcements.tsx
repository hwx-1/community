import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { api } from '../api'
import type { Announcement } from '../types'

interface AnnouncementForm {
  title: string
  summary: string
  body: string
  published: boolean
}

export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Announcement | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<AnnouncementForm>()

  const load = useCallback(() => {
    setLoading(true)
    api
      .announcements()
      .then((res) => setItems(res.items))
      .catch((err) => message.error(err.message ?? '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openEditor = (record: Announcement | 'new') => {
    setEditing(record)
    if (record === 'new') {
      form.setFieldsValue({
        title: '',
        summary: '',
        body: '',
        published: false,
      })
    } else {
      form.setFieldsValue({
        title: record.title,
        summary: record.summary,
        body: record.body,
        published: record.published,
      })
    }
  }

  const submit = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editing === 'new') {
        await api.createAnnouncement(values)
        message.success('公告已创建')
      } else if (editing) {
        await api.updateAnnouncement(editing.id, values)
        message.success('公告已更新')
      }
      setEditing(null)
      load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<Announcement> = [
    { title: '标题', dataIndex: 'title' },
    { title: '摘要', dataIndex: 'summary', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'published',
      render: (published: boolean) =>
        published ? <Tag color="green">已发布</Tag> : <Tag>草稿</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button size="small" onClick={() => openEditor(record)}>
          编辑
        </Button>
      ),
    },
  ]

  return (
    <div>
      <h2 className="page-title">公告管理</h2>
      <div className="page-toolbar">
        <Button type="primary" onClick={() => openEditor('new')}>
          新建公告
        </Button>
      </div>
      <Table<Announcement>
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={columns}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        open={!!editing}
        title={editing === 'new' ? '新建公告' : '编辑公告'}
        okText="保存"
        confirmLoading={saving}
        onOk={submit}
        onCancel={() => setEditing(null)}
        width={640}
        destroyOnClose
      >
        <Form<AnnouncementForm> form={form} layout="vertical">
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input maxLength={60} />
          </Form.Item>
          <Form.Item
            name="summary"
            label="摘要"
            rules={[{ required: true, message: '请输入摘要' }]}
          >
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item
            name="body"
            label="正文"
            rules={[{ required: true, message: '请输入正文' }]}
          >
            <Input.TextArea rows={6} />
          </Form.Item>
          <Form.Item
            name="published"
            label="是否发布"
            valuePropName="checked"
          >
            <Switch checkedChildren="发布" unCheckedChildren="草稿" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
