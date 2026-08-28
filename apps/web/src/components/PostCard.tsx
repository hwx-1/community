import styles from './PostCard.module.css'

export interface Post {
  id: number
  author: string
  avatar: string
  verified: boolean
  time: string
  pinned?: boolean
  text: string
  images?: string[]
  tags?: string[]
  likes: number
  comments: number
}

export default function PostCard({ post }: { post: Post }) {
  return (
    <article className={post.pinned ? `${styles.post} ${styles.pinned}` : styles.post}>
      <div className={styles.head}>
        <div className={styles.avatar}>{post.avatar}</div>
        <div>
          <div className={styles.name}>
            {post.author}
            {post.verified && <span className={styles.badge}>已认证</span>}
          </div>
          <div className={styles.time}>{post.time}</div>
        </div>
        {post.pinned && <span className={styles.pin}>置顶</span>}
      </div>
      <div className={styles.text}>{post.text}</div>
      {post.images && post.images.length > 0 && (
        <div className={post.images.length === 1 ? `${styles.imgs} ${styles.g1}` : post.images.length === 2 ? `${styles.imgs} ${styles.g2}` : `${styles.imgs} ${styles.g3}`}>
          {post.images.map((img, i) => (
            <div key={i} className={styles.img}>{img}</div>
          ))}
        </div>
      )}
      {post.tags && post.tags.length > 0 && (
        <div className={styles.tags}>
          {post.tags.map((t) => (
            <span key={t} className={styles.tag}># {t}</span>
          ))}
        </div>
      )}
      <div className={styles.actions}>
        <span>👍 {post.likes}</span>
        <span>💬 {post.comments}</span>
        <span>⭐ 收藏</span>
        <span>🔗 复制链接</span>
      </div>
    </article>
  )
}
