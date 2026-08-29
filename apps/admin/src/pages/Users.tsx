import { useCallback, useEffect, useState } from 'react'
import {
  Avatar,
  Button,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { api } from '../api'
import type { Account, AccountStatus } from '../types'

const statusText: Record<AccountStatus, string> = {
  active: '正常',
  muted: '禁言中',
  banned: '已封禁',
  deactivated: '已注销',
}

const statusColor: Record<AccountStatus, string> = {
  active: 'green',
  muted: 'orange',
  banned: 'red',
  deactivated: 'default',
}

interface PunishForm {
  status: 'active' | 'muted' | 'banned'
  mute_days?: number
  reason: string
}

export default function Users() {
  const [items, setItems] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState<Account | null>(null)
  const [acting, setActing] = useState(false)
  const [form] = Form.useForm<PunishForm>()
  const punishStatus = Form.useWatch('status', form)

  const load = useCallback(() => {
    setLoading(true)
    api
      .users()
      .then((res) => setItems(res.items))
      .catch((err) => message.error(err.message ?? '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openPunish = (account: Account) => {
    setTarget(account)
    form.resetFields()
    form.setFieldsValue({ status: 'active', mute_days: 1, reason: '' })
  }

  const submit = async () => {
    if (!target) return
    const values = await form.validateFields()
    setActing(true)
    try {
      await api.updateUser(target.id, {
        status: values.status,
        mute_days:
          values.status === 'muted' ? values.mute_days : undefined,
        reason: values.reason.trim(),
      })
      message.success('处罚已生效')
      setTarget(null)
      load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败')
    } finally {
      setActing(false)
    }
  }

  const columns: ColumnsType<Account> = [
    {
      title: '用户',
      key: 'user',
      render: (_, record) => (
        <Space>
          <Avatar src={record.avatar} size="small">
            {record.nickname?.[0]}
          </Avatar>
          {record.nickname}
          {record.verified && <Tag color="blue">已认证</Tag>}
        </Space>
      ),
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      render: (v?: string) => v || '—',
    },
    {
      title: '姓名',
      dataIndex: 'real_name',
      render: (v?: string) => v || '—',
    },
    {
      title: '学号',
      dataIndex: 'student_no',
      render: (v?: string) => v || '—',
    },
    {
      title: '班级',
      dataIndex: 'class_name',
      render: (v?: string) => v || '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: AccountStatus) => (
        <Tag color={statusColor[status]}>{statusText[status]}</Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Button size="small" onClick={() => openPunish(record)}>
          处罚管理
        </Button>
      ),
    },
  ]

  return (
    <div>
      <h2 className="page-title">用户管理</h2>
      <Table<Account>
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={columns}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        open={!!target}
        title={`处罚管理：${target?.nickname ?? ''}`}
        okText="确认执行"
        confirmLoading={acting}
        onOk={submit}
        onCancel={() => setTarget(null)}
        destroyOnClose
      >
        <Form<PunishForm> form={form} layout="vertical">
          <Form.Item
            name="status"
            label="处罚方式"
            rules={[{ required: true }]}
          >
            <Radio.Group>
              <Radio value="active">解除处罚（恢复正常）</Radio>
              <Radio value="muted">禁言</Radio>
              <Radio value="banned">永久封禁</Radio>
            </Radio.Group>
          </Form.Item>
          {punishStatus === 'muted' && (
            <Form.Item
              name="mute_days"
              label="禁言时长"
              rules={[{ required: true, message: '请选择禁言时长' }]}
            >
              <Select
                options={[
                  { value: 1, label: '1 天' },
                  { value: 3, label: '3 天' },
                  { value: 7, label: '7 天' },
                ]}
              />
            </Form.Item>
          )}
          <Form.Item
            name="reason"
            label="原因（必填）"
            rules={[{ required: true, message: '请填写原因' }]}
          >
            <Input.TextArea rows={3} placeholder="将记录到操作日志" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
