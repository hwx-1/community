import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { Avatar } from './Avatar'
import { isImageUrl } from '../utils/image'
import { api, formatTime, Post } from '../api/client'
import { useAuth } from '../store/auth'
import styles from './PostCard.module.css'

const statusLabels: Record<string, string> = {
  pending: '审核中',
  rejected: '未通过',
  reported_hidden: '复核中',
  removed: '已下架',
  deleted: '已删除',
}

export default function PostCard({ post, onChanged, variant = 'feed' }: { post: Post; onChanged?: (post: Post) => void; variant?: 'feed' | 'detail' }) {
  const [liked, setLiked] = useState(post.liked)
  const [likes, setLikes] = useState(post.likes)
  const [saved, setSaved] = useState(post.bookmarked)
  const [copied, setCopied] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [broken, setBroken] = useState<Record<string, boolean>>({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { account } = useAuth()
  const mine = account?.id === post.author.id

  const copyLink = async () => {
    const url = `${window.location.origin}/posts/${post.id}`
    try { await navigator.clipboard.writeText(url) } catch { /* 浏览器不支持时仍给出轻量反馈 */ }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const toggleLike = async () => {
    try {
      const { post: updated } = await api.likePost(post.id)
      setLiked(updated.liked)
      setLikes(updated.likes)
      onChanged?.(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    }
  }

  const toggleBookmark = async () => {
    try {
      const { post: updated } = await api.bookmarkPost(post.id)
      setSaved(updated.bookmarked)
      onChanged?.(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    }
  }

  const images = post.images ?? []
  const tags = post.tags ?? []

  const markBroken = (img: string) => setBroken((prev) => (prev[img] ? prev : { ...prev, [img]: true }))
  const imgOrFallback = (img: string, alt: string) =>
    broken[img]
      ? <span className={styles.imgFallback}><Icon name="image" /><span>图片加载失败</span></span>
      : <img src={img} alt={alt} onError={() => markBroken(img)} />

  const menu = menuOpen && (
    <div className={styles.postMenu}>
      <button type="button" onClick={() => navigate(`/posts/${post.id}`)}>查看帖子详情</button>
      {mine
        ? <button type="button" onClick={() => navigate(`/compose/${post.id}`)}>编辑帖子</button>
        : <button type="button" onClick={() => navigate(`/posts/${post.id}?report=1`)}>举报帖子</button>}
    </div>
  )

  const previewOverlay = preview && (
    <div className={styles.previewOverlay} role="dialog" aria-modal="true" aria-label="图片预览" onClick={() => setPreview(null)}>
      <button type="button" aria-label="关闭图片预览" onClick={() => setPreview(null)}><Icon name="close" /></button>
      <div onClick={(event) => event.stopPropagation()}>
        {isImageUrl(preview) ? <img src={preview} alt="帖子图片预览" /> : <><Icon name="image" /><strong>{preview}</strong><span>演示图片占位</span></>}
      </div>
    </div>
  )

  const tagList = tags.length > 0 && (
    <div className={styles.tags} aria-label="帖子标签">
      {tags.map((tag) => <a key={tag} className={styles.tag} href={`/search?q=${encodeURIComponent(tag)}`}># {tag}</a>)}
    </div>
  )

  if (variant === 'detail') {
    return (
      <article className={post.pinned ? `${styles.detail} ${styles.pinned}` : styles.detail}>
        <header className={styles.head}>
          <button className={styles.authorButton} type="button" aria-label={`查看 ${post.author.nickname} 的主页`} onClick={() => navigate(`/users/${post.author.id}`)}>
            <span className={styles.avatar}><Avatar value={post.author.avatar} fallback={post.author.nickname.slice(0, 1)} /></span>
            <span className={styles.authorMeta}>
              <span className={styles.name}>
                {post.author.nickname}
                {post.author.verified && <span className={styles.verified}><Icon name="check" />已认证</span>}
              </span>
              <span className={styles.time}>{formatTime(post.created_at)}</span>
            </span>
          </button>
          {post.pinned && <span className={styles.pin}>置顶</span>}
          {post.status !== 'public' && <span className={styles.pin}>{statusLabels[post.status] ?? post.status}</span>}
          <button className={styles.more} type="button" aria-label="更多操作" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name="more" /></button>
        </header>

        {menu}

        <p className={styles.detailText}>{post.text}</p>

        {images.length > 0 && (
          <div className={`${styles.imgs} ${styles[`g${Math.min(images.length, 5)}`]}`}>
            {images.map((img, index) => (
              <button key={img} className={styles.img} type="button" aria-label={`查看图片 ${index + 1}`} onClick={() => setPreview(img)}>
                {isImageUrl(img) ? imgOrFallback(img, `帖子图片 ${index + 1}`) : <><Icon name="image" /><span>{img}</span></>}
              </button>
            ))}
          </div>
        )}

        {tagList}

        {error && <p role="alert" style={{ color: 'var(--danger)', margin: '4px 0' }}>{error}</p>}

        <footer className={styles.actionBar}>
          <button type="button" className={liked ? styles.actionOn : ''} aria-label={`${liked ? '取消点赞' : '点赞'}，当前 ${likes} 个赞`} aria-pressed={liked} onClick={toggleLike}>
            <Icon name="heart" /> <span>{likes}</span>
          </button>
          <button type="button" aria-label={`查看 ${post.comments} 条评论`} onClick={() => navigate(`/posts/${post.id}`)}><Icon name="comment" /> <span>{post.comments}</span></button>
          <button type="button" className={saved ? styles.actionOn : ''} aria-label={saved ? '取消收藏' : '收藏帖子'} aria-pressed={saved} onClick={toggleBookmark}>
            <Icon name="bookmark" /> <span>{saved ? '已收藏' : '收藏'}</span>
          </button>
          <button type="button" aria-label={copied ? '链接已复制' : '复制帖子链接'} onClick={copyLink}><Icon name="share" /> <span>{copied ? '已复制' : '分享'}</span></button>
        </footer>
        {previewOverlay}
      </article>
    )
  }

  return (
    <article className={post.pinned ? `${styles.stream} ${styles.pinned}` : styles.stream}>
      <header className={styles.head}>
        <button className={styles.authorButton} type="button" aria-label={`查看 ${post.author.nickname} 的主页`} onClick={() => navigate(`/users/${post.author.id}`)}>
          <span className={styles.avatar}><Avatar value={post.author.avatar} fallback={post.author.nickname.slice(0, 1)} /></span>
          <span className={styles.authorMeta}>
            <span className={styles.name}>
              {post.author.nickname}
              {post.author.verified && <span className={styles.verified} aria-label="已认证"><Icon name="check" /></span>}
            </span>
            <span className={styles.time}>{formatTime(post.created_at)}</span>
          </span>
        </button>
        {post.pinned && <span className={styles.pin}>置顶</span>}
        {post.status !== 'public' && <span className={styles.pin}>{statusLabels[post.status] ?? post.status}</span>}
        <button className={styles.more} type="button" aria-label="更多操作" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name="more" /></button>
      </header>

      {menu}

      <p className={styles.streamText} onClick={() => navigate(`/posts/${post.id}`)}>{post.text}</p>

      {images.length > 0 && (
        <div className={`${styles.streamImgs} ${styles[`g${Math.min(images.length, 5)}`]}`}>
          {images.map((img, index) => (
            <button key={img} className={styles.img} type="button" aria-label={`查看图片 ${index + 1}`} onClick={() => setPreview(img)}>
              {isImageUrl(img) ? imgOrFallback(img, `帖子图片 ${index + 1}`) : <><Icon name="image" /><span>{img}</span></>}
            </button>
          ))}
        </div>
      )}

      {tagList}

      {error && <p role="alert" style={{ color: 'var(--danger)', margin: '4px 0' }}>{error}</p>}

      <footer className={styles.streamBar}>
        <button type="button" className={liked ? `${styles.vote} ${styles.voteOn}` : styles.vote} aria-label={`${liked ? '取消点赞' : '点赞'}，当前 ${likes} 个赞`} aria-pressed={liked} onClick={toggleLike}>
          <Icon name="heart" /> <span>{likes > 0 ? `赞同 ${likes}` : '赞同'}</span>
        </button>
        <button type="button" className={styles.ghost} aria-label={`查看 ${post.comments} 条评论`} onClick={() => navigate(`/posts/${post.id}`)}>
          <Icon name="comment" /> <span>{post.comments > 0 ? `${post.comments} 条评论` : '评论'}</span>
        </button>
        <button type="button" className={`${styles.ghost} ${saved ? styles.actionOn : ''}`} aria-label={saved ? '取消收藏' : '收藏帖子'} aria-pressed={saved} onClick={toggleBookmark}>
          <Icon name="bookmark" /> <span>{saved ? '已收藏' : '收藏'}</span>
        </button>
        <button type="button" className={styles.ghost} aria-label={copied ? '链接已复制' : '复制帖子链接'} onClick={copyLink}>
          <Icon name="share" /> <span>{copied ? '已复制' : '分享'}</span>
        </button>
      </footer>
      {previewOverlay}
    </article>
  )
}
