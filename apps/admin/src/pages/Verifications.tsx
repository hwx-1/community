import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Form,
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
import type { Verification, VerificationStatus } from '../types'

const statusText: Record<VerificationStatus, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
}

const statusColor: Record<VerificationStatus, string> = {
  pending: 'gold',
  approved: 'green',
  rejected: 'red',
}

const OVERDUE_DAYS = 7

function isOverdue(v: Verification): boolean {
  return (
    v.status === 'pending' &&
    dayjs().diff(dayjs(v.created_at), 'day') >= OVERDUE_DAYS
  )
}

export default function Verifications() {
  const [items, setItems] = useState<Verification[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>()
  const [material, setMaterial] = useState<Verification | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Verification | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [acting, setActing] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(() => {
    setLoading(true)
    api
      .verifications()
      .then((res) => setItems(res.items))
      .catch((err) => message.error(err.message ?? '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(
    () =>
      statusFilter
        ? items.filter((v) => v.status === statusFilter)
        : items,
    [items, statusFilter],
  )

  const review = async (
    v: Verification,
    status: 'approved' | 'rejected',
    reason: string,
  ) => {
    setActing(true)
    try {
      await api.reviewVerification(v.id, status, reason)
      message.success(status === 'approved' ? '已通过' : '已驳回')
      load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败')
    } finally {
      setActing(false)
    }
  }

  const handleApprove = (v: Verification) => {
    Modal.confirm({
      title: '确认通过该认证申请？',
      content: `${v.nickname}（${v.real_name} / ${v.student_no}）`,
      onOk: () => review(v, 'approved', ''),
    })
  }

  const handleRejectSubmit = async () => {
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      message.warning('驳回必须填写原因')
      return
    }
    await review(rejectTarget, 'rejected', rejectReason.trim())
    setRejectTarget(null)
    setRejectReason('')
    form.resetFields()
  }

  const columns: ColumnsType<Verification> = [
    { title: '昵称', dataIndex: 'nickname' },
    { title: '姓名', dataIndex: 'real_name' },
    { title: '学号', dataIndex: 'student_no' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: VerificationStatus, record) => (
        <Space>
          <Tag color={statusColor[status]}>{statusText[status]}</Tag>
          {isOverdue(record) && <Tag color="red">待审超 7 天</Tag>}
        </Space>
      ),
    },
    {
      title: '驳回原因',
      dataIndex: 'reject_reason',
      render: (v?: string) => v || '—',
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => setMaterial(record)}>
            查看材料
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                size="small"
                type="primary"
                loading={acting}
                onClick={() => handleApprove(record)}
              >
                通过
              </Button>
              <Button
                size="small"
                danger
                onClick={() => {
                  setRejectTarget(record)
                  setRejectReason('')
                }}
              >
                驳回
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ]

  const materialUrl = material?.material_url ?? ''
  const isPrivateMaterial = materialUrl.startsWith('/private/')

  return (
    <div>
      <h2 className="page-title">认证审核</h2>
      <div className="page-toolbar">
        <Select
          allowClear
          placeholder="按状态筛选"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={(
            ['pending', 'approved', 'rejected'] as VerificationStatus[]
          ).map((s) => ({ value: s, label: statusText[s] }))}
        />
      </div>
      <Table<Verification>
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        columns={columns}
        rowClassName={(record) => (isOverdue(record) ? 'row-overdue' : '')}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        open={!!material}
        title="证明材料"
        footer={null}
        onCancel={() => setMaterial(null)}
      >
        {material &&
          (isPrivateMaterial ? (
            <p>
              该材料为隐私文件，界面不直接展示。文件路径：
              <code>{materialUrl}</code>
            </p>
          ) : (
            <img
              className="verification-material-img"
              src={materialUrl}
              alt="证明材料"
              onClick={() => window.open(materialUrl, '_blank')}
            />
          ))}
      </Modal>

      <Modal
        open={!!rejectTarget}
        title="驳回认证申请"
        okText="确认驳回"
        okButtonProps={{ danger: true, disabled: !rejectReason.trim() }}
        onOk={handleRejectSubmit}
        onCancel={() => setRejectTarget(null)}
        confirmLoading={acting}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="驳回原因（必填）" required>
            <Input.TextArea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请填写驳回原因，将展示给用户"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
