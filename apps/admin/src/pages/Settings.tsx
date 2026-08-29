import { useCallback, useEffect, useState } from 'react'
import { Button, Form, Input, Select, message } from 'antd'
import { api } from '../api'
import type { Settings as SettingsData } from '../types'

const TOPIC_MAX_LEN = 10

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<SettingsData>()

  const load = useCallback(() => {
    setLoading(true)
    api
      .settings()
      .then((res) => form.setFieldsValue(res.settings))
      .catch((err) => message.error(err.message ?? '加载失败'))
      .finally(() => setLoading(false))
  }, [form])

  useEffect(() => {
    load()
  }, [load])

  const submit = async () => {
    const values = await form.validateFields()
    const topics = (values.hot_topics ?? []).map((t) => t.trim()).filter(Boolean)
    const tooLong = topics.find((t) => t.length > TOPIC_MAX_LEN)
    if (tooLong) {
      message.warning(`话题「${tooLong}」超过 ${TOPIC_MAX_LEN} 字，请缩短`)
      return
    }
    setSaving(true)
    try {
      await api.updateSettings({
        greeting: values.greeting,
        hot_topics: topics,
      })
      message.success('运营配置已保存')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="page-title">运营配置</h2>
      <Form<SettingsData>
        form={form}
        layout="vertical"
        style={{ maxWidth: 560 }}
        disabled={loading}
      >
        <Form.Item
          name="greeting"
          label="私信内置招呼文案"
          rules={[{ required: true, message: '请输入招呼文案' }]}
          extra="用户首次发起私信时系统自动发送的招呼语"
        >
          <Input maxLength={100} />
        </Form.Item>
        <Form.Item
          name="hot_topics"
          label="热门话题"
          extra={`手动输入后回车添加，按顺序展示；每个话题不超过 ${TOPIC_MAX_LEN} 字`}
        >
          <Select
            mode="tags"
            open={false}
            placeholder="输入话题后回车添加"
            tokenSeparators={[',', '，']}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" onClick={submit} loading={saving}>
            保存
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}
