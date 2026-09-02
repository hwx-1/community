import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { api } from '../api'
import type { KBEntry } from '../types'

const categoryText: Record<KBEntry['category'], string> = {
  phone: '常用电话',
  notice: '通知公告',
  faq: '常见问题',
}

interface KBForm {
  title: string
  category: KBEntry['category']
  content: string
  source: string
  source_date: string
  enabled: boolean
}

export default function KB() {
  const [items, setItems] = useState<KBEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<KBEntry | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<KBForm>()

  const load = useCallback(() => {
    setLoading(true)
    api
      .kbEntries()
      .then((res) => setItems(res.items))
      .catch((err) => message.error(err.message ?? '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openEditor = (record: KBEntry | 'new') => {
    setEditing(record)
    if (record === 'new') {
      form.setFieldsValue({
        title: '',
        category: 'faq',
        content: '',
        source: '',
        source_date: '',
        enabled: true,
      })
    } else {
      form.setFieldsValue({
        title: record.title,
        category: record.category,
        content: record.content,
        source: record.source,
        source_date: record.source_date,
        enabled: record.enabled,
      })
    }
  }

  const submit = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editing === 'new') {
        await api.createKBEntry(values)
        message.success('知识条目已创建')
      } else if (editing) {
        await api.updateKBEntry(editing.id, values)
        message.success('知识条目已更新')
      }
      setEditing(null)
      load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (record: KBEntry) => {
    try {
      await api.deleteKBEntry(record.id)
      message.success('已删除')
      load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  const columns: ColumnsType<KBEntry> = [
    { title: '标题', dataIndex: 'title' },
    {
      title: '类别',
      dataIndex: 'category',
      width: 110,
      render: (c: KBEntry['category']) => (
        <Tag>{categoryText[c] ?? c}</Tag>
      ),
    },
    { title: '内容', dataIndex: 'content', ellipsis: true },
    { title: '来源', dataIndex: 'source', width: 180 },
    { title: '来源日期', dataIndex: 'source_date', width: 110 },
    {
      title: '用户评价',
      dataIndex: 'dislikes',
      width: 100,
      render: (v: number) =>
        v > 0 ? <Tag color="red">被否 {v} 次</Tag> : <Tag color="green">无差评</Tag>,
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (v: boolean) =>
        v ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 150,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEditor(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该知识条目？"
            okText="删除"
            okButtonProps={{ danger: true }}
            onConfirm={() => remove(record)}
          >
            <Button size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h2 className="page-title">知识库</h2>
      <div className="page-toolbar">
        <Button type="primary" onClick={() => openEditor('new')}>
          新建条目
        </Button>
      </div>
      <Table<KBEntry>
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={columns}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        open={!!editing}
        title={editing === 'new' ? '新建知识条目' : '编辑知识条目'}
        okText="保存"
        confirmLoading={saving}
        onOk={submit}
        onCancel={() => setEditing(null)}
        width={640}
        destroyOnClose
      >
        <Form<KBForm> form={form} layout="vertical">
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input maxLength={60} />
          </Form.Item>
          <Form.Item
            name="category"
            label="类别"
            rules={[{ required: true }]}
          >
            <Select
              options={(['phone', 'notice', 'faq'] as KBEntry['category'][]).map(
                (c) => ({ value: c, label: categoryText[c] }),
              )}
            />
          </Form.Item>
          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <Input.TextArea rows={5} />
          </Form.Item>
          <Form.Item
            name="source"
            label="来源"
            rules={[{ required: true, message: '请输入来源' }]}
          >
            <Input placeholder="例如：学校官网-教务处" />
          </Form.Item>
          <Form.Item
            name="source_date"
            label="来源日期"
            rules={[{ required: true, message: '请输入来源日期' }]}
          >
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
