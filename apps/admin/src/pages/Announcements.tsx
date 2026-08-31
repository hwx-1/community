import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Image,
  Input,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Upload,
  message,
} from 'antd'
import { DeleteOutlined, LinkOutlined, UploadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { api } from '../api'
import type { Announcement } from '../types'

interface AnnouncementForm {
  title: string
  summary: string
  body: string
  image_url: string
  link_url: string
  link_text: string
  published: boolean
}

export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Announcement | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form] = Form.useForm<AnnouncementForm>()
  const imageUrl = Form.useWatch('image_url', form)
  const linkUrl = Form.useWatch('link_url', form)

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
        image_url: '',
        link_url: '',
        link_text: '',
        published: false,
      })
    } else {
      form.setFieldsValue({
        title: record.title,
        summary: record.summary,
        body: record.body,
        image_url: record.image_url ?? '',
        link_url: record.link_url ?? '',
        link_text: record.link_text ?? '',
        published: record.published,
      })
    }
  }

  const uploadImage = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(file.type) && !/\.(jpe?g|png|webp|heic)$/i.test(file.name)) {
      message.error('仅支持 JPG、PNG、WebP 或 HEIC 图片')
      return Upload.LIST_IGNORE
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error('图片大小不能超过 5MB')
      return Upload.LIST_IGNORE
    }
    setUploading(true)
    try {
      const result = await api.uploadAnnouncementImage(file)
      form.setFieldValue('image_url', result.url)
      message.success('图片上传成功')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '图片上传失败')
    } finally {
      setUploading(false)
    }
    return Upload.LIST_IGNORE
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
    {
      title: '标题',
      dataIndex: 'title',
      render: (title: string, record) => (
        <Space size={10}>
          {record.image_url && (
            <Image
              src={record.image_url}
              alt="公告配图"
              width={42}
              height={42}
              style={{ objectFit: 'cover', borderRadius: 6 }}
            />
          )}
          <span>{title}</span>
        </Space>
      ),
    },
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
      width={720}
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
          <Form.Item name="image_url" label="公告配图" extra="支持 JPG、PNG、WebP、HEIC，单张不超过 5MB。">
            <Input type="hidden" />
          </Form.Item>
          <div className="announcement-image-editor">
            {imageUrl ? (
              <div className="announcement-image-preview">
                <Image src={imageUrl} alt="公告配图预览" />
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => form.setFieldValue('image_url', '')}
                >
                  移除图片
                </Button>
              </div>
            ) : (
              <Upload
                accept="image/jpeg,image/png,image/webp,image/heic,.heic"
                showUploadList={false}
                beforeUpload={uploadImage}
              >
                <Button icon={<UploadOutlined />} loading={uploading}>
                  上传公告图片
                </Button>
              </Upload>
            )}
          </div>
          <Form.Item
            name="link_url"
            label="点击链接（可选）"
            rules={[{ type: 'url', message: '请输入完整的 http 或 https 链接' }]}
          >
            <Input prefix={<LinkOutlined />} placeholder="https://example.com/notice" />
          </Form.Item>
          {linkUrl && (
            <Form.Item
              name="link_text"
              label="链接按钮文字"
              rules={[{ max: 30, message: '最多 30 个字' }]}
            >
              <Input maxLength={30} placeholder="查看详情" />
            </Form.Item>
          )}
          <Alert
            type="info"
            showIcon
            message="设为发布后，公告会立即出现在 Web 和手机 App；保存为草稿则仅后台可见。"
            style={{ marginBottom: 20 }}
          />
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
