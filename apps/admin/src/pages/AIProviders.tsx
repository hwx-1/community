import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
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
import type { AIProvider } from '../types'

interface ProviderForm {
  name: string
  protocol: string
  base_url: string
  api_key?: string
  model: string
  enabled: boolean
  public: boolean
  fallback_order: number
}

export default function AIProviders() {
  const [items, setItems] = useState<AIProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AIProvider | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<ProviderForm>()

  const load = useCallback(() => {
    setLoading(true)
    api
      .aiProviders()
      .then((res) => setItems(res.items))
      .catch((err) => message.error(err.message ?? '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openEditor = (record: AIProvider | 'new') => {
    setEditing(record)
    if (record === 'new') {
      form.setFieldsValue({
        name: '',
        protocol: 'openai-compatible',
        base_url: '',
        api_key: '',
        model: '',
        enabled: true,
        public: false,
        fallback_order: 1,
      })
    } else {
      form.setFieldsValue({
        name: record.name,
        protocol: record.protocol || 'openai-compatible',
        base_url: record.base_url,
        api_key: '',
        model: record.model,
        enabled: record.enabled,
        public: record.public,
        fallback_order: record.fallback_order,
      })
    }
  }

  const submit = async () => {
    const values = await form.validateFields()
    const body: Record<string, unknown> = {
      name: values.name,
      protocol: values.protocol,
      base_url: values.base_url,
      model: values.model,
      enabled: values.enabled,
      public: values.public,
      fallback_order: values.fallback_order,
    }
    // API Key 仅创建时必传；编辑时留空表示不修改
    if (editing === 'new' || (values.api_key && values.api_key.trim())) {
      body.api_key = values.api_key?.trim()
    }
    setSaving(true)
    try {
      if (editing === 'new') {
        await api.createAIProvider(body)
        message.success('AI 服务已创建')
      } else if (editing) {
        await api.updateAIProvider(editing.id, body)
        message.success('AI 服务已更新')
      }
      setEditing(null)
      load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<AIProvider> = [
    { title: '名称', dataIndex: 'name' },
    { title: '接口类型', dataIndex: 'protocol' },
    { title: 'Base URL', dataIndex: 'base_url', ellipsis: true },
    {
      title: 'API Key',
      dataIndex: 'api_key_masked',
      render: (v: string) => <code>{v || '—'}</code>,
    },
    { title: '模型', dataIndex: 'model' },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (v: boolean) =>
        v ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>,
    },
    {
      title: '对用户开放',
      dataIndex: 'public',
      width: 110,
      render: (v: boolean) =>
        v ? <Tag color="blue">开放</Tag> : <Tag>不开放</Tag>,
    },
    { title: '备用顺序', dataIndex: 'fallback_order', width: 100 },
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
      <h2 className="page-title">AI 服务</h2>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="凭证仅保存在服务端，界面一律脱敏展示；缺少真实凭证时，问答功能将走本地开发模式。"
      />
      <div className="page-toolbar">
        <Button type="primary" onClick={() => openEditor('new')}>
          新建 AI 服务
        </Button>
      </div>
      <Table<AIProvider>
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={columns}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        open={!!editing}
        title={editing === 'new' ? '新建 AI 服务' : '编辑 AI 服务'}
        okText="保存"
        confirmLoading={saving}
        onOk={submit}
        onCancel={() => setEditing(null)}
        destroyOnClose
      >
        <Form<ProviderForm> form={form} layout="vertical">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input maxLength={40} />
          </Form.Item>
          <Form.Item name="protocol" label="接口类型" rules={[{ required: true }]}>
            <Select
              options={[
                {
                  value: 'openai-compatible',
                  label: 'OpenAI 兼容接口（openai-compatible）',
                },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="base_url"
            label="Base URL"
            rules={[{ required: true, message: '请输入 Base URL' }]}
          >
            <Input placeholder="https://api.example.com/v1" />
          </Form.Item>
          <Form.Item
            name="api_key"
            label="API Key"
            rules={
              editing === 'new'
                ? [{ required: true, message: '创建时必须输入 API Key' }]
                : []
            }
            extra={
              editing === 'new'
                ? '仅保存在服务端，创建后界面只显示脱敏结果'
                : '编辑时不回填；留空表示不修改'
            }
          >
            <Input.Password
              autoComplete="new-password"
              placeholder={editing === 'new' ? '请输入 API Key' : '留空表示不修改'}
            />
          </Form.Item>
          <Form.Item
            name="model"
            label="模型标识"
            rules={[{ required: true, message: '请输入模型标识' }]}
          >
            <Input placeholder="例如 gpt-4o-mini" />
          </Form.Item>
          <Form.Item
            name="fallback_order"
            label="备用顺序（数字小优先）"
            rules={[{ required: true, message: '请输入备用顺序' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
          <Form.Item
            name="public"
            label="对用户开放"
            valuePropName="checked"
          >
            <Switch checkedChildren="开放" unCheckedChildren="不开放" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
