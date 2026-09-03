import { FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { api, ApiError } from '../api/client'
import { useToast } from '../components/Toast'
import styles from './ComposePage.module.css'

export default function ComposePage() {
  const { postId } = useParams()
  const isEditing = Boolean(postId)
  const toast = useToast()
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitted, setSubmitted] = useState('')
  const [busy, setBusy] = useState(false)
  const tagRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // 编辑模式：载入旧帖内容
  useEffect(() => {
    if (!postId) return
    api.getPost(Number(postId)).then(({ post }) => {
      setContent(post.text)
      setTags(post.tags ?? [])
      setImageUrls(post.images ?? [])
    }).catch(() => toast('帖子不存在或已删除', 'error'))
  }, [postId, toast])

  const addTag = () => {
    const value = tagRef.current?.value.trim()
    if (!value || tags.includes(value) || tags.length >= 3) return
    setTags([...tags, value.slice(0, 10)])
    if (tagRef.current) tagRef.current.value = ''
  }

  const pickImages = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const remaining = 9 - imageUrls.length
      for (const file of Array.from(files).slice(0, remaining)) {
        const { url } = await api.upload(file)
        setImageUrls((current) => [...current, url])
      }
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '图片上传失败', 'error')
    } finally {
      setUploading(false)
      if (imageRef.current) imageRef.current.value = ''
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!content.trim() || busy) return
    setBusy(true)
    try {
      const payload = { text: content.trim(), images: imageUrls, tags }
      const result = isEditing
        ? await api.updatePost(Number(postId), payload)
        : await api.createPost(payload)
      setSubmitted(result.message)
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '提交失败，请稍后重试', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (submitted) return (
    <section className={styles.success}>
      <span><Icon name="check" /></span><h1>{isEditing ? '修改稿已提交' : '帖子已提交'}</h1><p>{submitted}</p><button type="button" onClick={() => navigate('/me')}>查看我的帖子</button>
    </section>
  )

  return (
    <form className={styles.form} onSubmit={submit}>
      <header className={styles.pageHead}><div><h1>{isEditing ? '编辑帖子' : '发布新帖'}</h1><p>{isEditing ? '新版本审核通过前，旧版本继续公开。' : '分享校园生活、学习资料或活动信息。'}</p></div></header>
      <section className={styles.card}>
        <label htmlFor="post-content">帖子内容 <span>必填</span></label>
        <textarea id="post-content" maxLength={2000} value={content} onChange={(event) => setContent(event.target.value)} placeholder="想和大家分享什么？" />
        <div className={styles.count}>{content.length} / 2000</div>
        <div className={styles.divider} />
        <div className={styles.uploadHead}><div><strong>添加图片</strong><span>选填，最多 9 张</span></div><small>JPG / PNG / WEBP / HEIC，单张不超过 5MB</small></div>
        <input className="srOnly" ref={imageRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple onChange={(event) => pickImages(event.target.files)} />
        <div className={styles.imageList}>
          {imageUrls.map((url) => (
            <div key={url} className={styles.imageItem}>
              <img src={url} alt="已上传的图片" loading="lazy" />
              <button type="button" aria-label="移除这张图片" onClick={() => setImageUrls(imageUrls.filter((item) => item !== url))}><Icon name="close" /></button>
            </div>
          ))}
          {(uploading || imageUrls.length < 9) && (
            <button className={styles.uploadTile} type="button" disabled={uploading} onClick={() => imageRef.current?.click()}>
              <Icon name="image" /><span>{uploading ? '上传中…' : '添加图片'}</span>
            </button>
          )}
        </div>
      </section>
      <section className={styles.card}>
        <label htmlFor="post-tag">帖子标签 <span>选填，最多 3 个</span></label>
        <div className={styles.tagInput}><span>#</span><input id="post-tag" ref={tagRef} maxLength={10} placeholder="输入标签名称" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag() } }} /><button type="button" onClick={addTag}>添加</button></div>
        <div className={styles.tags}>{tags.map((tag) => <button key={tag} type="button" onClick={() => setTags(tags.filter((item) => item !== tag))}># {tag}<Icon name="close" /></button>)}</div>
      </section>
      <div className={styles.actions}>
        <div className={styles.notice}><Icon name="shield" /><span>帖子提交后将经过内容审核，通过后公开展示。</span></div>
        <div className={styles.actionButtons}>
          <button className={styles.cancel} type="button" onClick={() => navigate(-1)}>取消</button>
          <button className={styles.submit} type="submit" disabled={!content.trim() || busy || uploading}><Icon name="send" />{busy ? '提交中…' : isEditing ? '保存修改' : '发布'}</button>
        </div>
      </div>
    </form>
  )
}
