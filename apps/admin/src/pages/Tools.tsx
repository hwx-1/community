import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch,
  Table,
  Tag,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { api } from '../api'
import type { Tool } from '../types'

const typeText: Record<Tool['type'], string> = {
  ai: 'AI 问答',
  map: '校园地图',
  links: '常用链接',
  link: '外链',
}

interface ToolForm {
  name: string
  type: Tool['type']
  icon: string
  url?: string
  weight: number
  enabled: boolean
}

export default function Tools() {
  const [items, setItems] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Tool | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<ToolForm>()
  const toolType = Form.useWatch('type', form)

  const load = useCallback(() => {
    setLoading(true)
    api
      .tools()
      .then((res) => setItems(res.items))
      .catch((err) => message.error(err.message ?? '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openEditor = (record: Tool | 'new') => {
    setEditing(record)
    if (record === 'new') {
      form.setFieldsValue({
        name: '',
        type: 'link',
        icon: '',
        url: '',
        weight: 0,
        enabled: true,
      })
    } else {
      form.setFieldsValue({
        name: record.name,
        type: record.type,
        icon: record.icon,
        url: record.url ?? '',
        weight: record.weight,
        enabled: record.enabled,
      })
    }
  }

  const submit = async () => {
    const values = await form.validateFields()
    const body: Partial<Tool> = {
      ...values,
      url: values.type === 'link' ? values.url : undefined,
    }
    setSaving(true)
    try {
      if (editing === 'new') {
        await api.createTool(body)
        message.success('工具已创建')
      } else if (editing) {
        await api.updateTool(editing.id, body)
        message.success('工具已更新')
      }
      setEditing(null)
      load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<Tool> = [
    {
      title: '图标',
      dataIndex: 'icon',
      width: 70,
      render: (icon: string) => <span style={{ fontSize: 20 }}>{icon}</span>,
    },
    { title: '名称', dataIndex: 'name' },
    {
      title: '类型',
      dataIndex: 'type',
      render: (type: Tool['type']) => <Tag>{typeText[type] ?? type}</Tag>,
    },
    {
      title: '链接',
      dataIndex: 'url',
      ellipsis: true,
      render: (v?: string) => v || '—',
    },
    { title: '排序权重', dataIndex: 'weight', width: 100 },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 90,
      render: (enabled: boolean) =>
        enabled ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>,
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
      <h2 className="page-title">百宝箱工具</h2>
      <div className="page-toolbar">
        <Button type="primary" onClick={() => openEditor('new')}>
          新建工具
        </Button>
      </div>
      <Table<Tool>
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={columns}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        open={!!editing}
        title={editing === 'new' ? '新建工具' : '编辑工具'}
        okText="保存"
        confirmLoading={saving}
        onOk={submit}
        onCancel={() => setEditing(null)}
        destroyOnClose
      >
        <Form<ToolForm> form={form} layout="vertical">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input maxLength={20} />
          </Form.Item>
          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true }]}
            extra="ai / map / links 为内置类型；link 为外链，需填写链接地址"
          >
            <Select
              options={(['ai', 'map', 'links', 'link'] as Tool['type'][]).map(
                (t) => ({ value: t, label: `${typeText[t]}（${t}）` }),
              )}
            />
          </Form.Item>
          <Form.Item
            name="icon"
            label="图标（emoji 或图标名）"
            rules={[{ required: true, message: '请输入图标' }]}
          >
            <Input maxLength={20} placeholder="例如 🗺️" />
          </Form.Item>
          {toolType === 'link' && (
            <Form.Item
              name="url"
              label="链接地址"
              rules={[{ required: true, message: '外链类型必须填写链接' }]}
            >
              <Input placeholder="https://…" />
            </Form.Item>
          )}
          <Form.Item
            name="weight"
            label="排序权重（数字越大越靠前）"
            rules={[{ required: true, message: '请输入排序权重' }]}
          >
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
