import PostCard, { Post } from '../components/PostCard'
import styles from './HomePage.module.css'

// 首版为占位数据，接口就绪后替换为 /api/v1/posts
const posts: Post[] = [
  {
    id: 1,
    author: '社区管理员',
    avatar: '管',
    verified: false,
    time: '2 小时前',
    pinned: true,
    text: '【公告】下周起图书馆开放时间调整为 8:00–22:00，期末周延长至 23:00。请同学们相互转告。',
    likes: 32,
    comments: 12,
  },
  {
    id: 2,
    author: '李大壮',
    avatar: '李',
    verified: true,
    time: '25 分钟前',
    text: '周六下午体育馆羽毛球局，还差 2 人，想来的评论区报名～',
    images: ['图 1', '图 2', '图 3'],
    tags: ['运动', '羽毛球'],
    likes: 8,
    comments: 5,
  },
  {
    id: 3,
    author: '王小雨',
    avatar: '王',
    verified: true,
    time: '1 小时前',
    text: '高数期末复习重点整理，需要的自取。',
    images: ['图 1', '图 2'],
    tags: ['学习资料'],
    likes: 21,
    comments: 3,
  },
]

export default function HomePage() {
  return (
    <>
      <div className={styles.feedHead}>
        <div className={styles.feedTitle}>最新动态</div>
        <div className={styles.feedNote}>按发布时间倒序 · 不提供热度排序</div>
      </div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </>
  )
}
