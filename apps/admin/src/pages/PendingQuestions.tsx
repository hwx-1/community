import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Input,
  Modal,
  Table,
  Tag,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { api } from '../api'
import type { PendingQuestion } from '../types'

const statusText: Record<PendingQuestion['status'], string> = {
  open: '待补充',
  answered: '已回答',
  withdrawn: '已撤回',
}

const statusColor: Record<PendingQuestion['status'], string> = {
  open: 'gold',
  answered: 'green',
  withdrawn: 'default',
}

export default function PendingQuestions() {
  const [items, setItems] = useState<PendingQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState<PendingQuestion | null>(null)
  const [answer, setAnswer] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api
      .pendingQuestions()
      .then((res) => setItems(res.items))
      .catch((err) => message.error(err.message ?? '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // open 状态优先展示
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.status === 'open' && b.status !== 'open') return -1
        if (a.status !== 'open' && b.status === 'open') return 1
        return dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()
      }),
    [items],
  )

  const submit = async () => {
    if (!target) return
    if (!answer.trim()) {
      message.warning('请填写答案')
      return
    }
    setSaving(true)
    try {
      await api.answerPendingQuestion(target.id, answer.trim())
      message.success('答案已补充，系统会通知提问用户')
      setTarget(null)
      setAnswer('')
      load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '提交失败')
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<PendingQuestion> = [
    { title: '问题', dataIndex: 'question', ellipsis: true },
    {
      title: '热度',
      dataIndex: 'ask_count',
      width: 110,
      render: (count: number) => <Tag color="blue">{count} 人问过</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: PendingQuestion['status']) => (
        <Tag color={statusColor[status]}>{statusText[status]}</Tag>
      ),
    },
    {
      title: '答案',
      dataIndex: 'answer',
      ellipsis: true,
      render: (v?: string) => v || '—',
    },
    {
      title: '提问时间',
      dataIndex: 'created_at',
      width: 150,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '回答时间',
      dataIndex: 'answered_at',
      width: 150,
      render: (v?: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) =>
        record.status === 'open' ? (
          <Button
            size="small"
            type="primary"
            onClick={() => {
              setTarget(record)
              setAnswer('')
            }}
          >
            补充答案
          </Button>
        ) : null,
    },
  ]

  return (
    <div>
      <h2 className="page-title">待补充问题</h2>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="以下是 AI 暂时答不上来的问题。补充答案后系统会通知提问用户，并沉淀进知识库。"
      />
      <Table<PendingQuestion>
        rowKey="id"
        loading={loading}
        dataSource={sorted}
        columns={columns}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        open={!!target}
        title="补充答案"
        okText="提交答案"
        okButtonProps={{ disabled: !answer.trim() }}
        confirmLoading={saving}
        onOk={submit}
        onCancel={() => setTarget(null)}
        width={640}
      >
        <p style={{ color: '#334155' }}>
          <strong>问题：</strong>
          {target?.question}
        </p>
        <p style={{ color: '#94a3b8', fontSize: 13 }}>
          补充后系统会通知提问用户。
        </p>
        <Input.TextArea
          rows={5}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="请输入答案内容"
        />
      </Modal>
    </div>
  )
}
