import styles from './MessagesPage.module.css'

const notices = [
  { id: 1, icon: '💬', title: '3 人评论了你的帖子「周六羽毛球局」', time: '5 分钟前 · 按帖子聚合，点开即已读' },
  { id: 2, icon: '官', title: '官方回答：你询问的教务处电话已补充', time: '2 小时前 · 查看不消耗 AI 额度', official: true },
  { id: 3, icon: '📋', title: '举报处理结果：你举报的评论已被移除', time: '昨天' },
]

const dms = [
  { id: 1, avatar: '张', name: '张同学', preview: '「我想和你聊聊」· 等待对方回复后才能发自由文字', time: '10:24', locked: true },
  { id: 2, avatar: '赵', name: '赵一鸣', preview: '好的，那周六见！', time: '昨天', locked: false },
]

export default function MessagesPage() {
  return (
    <>
      <div className={styles.title}>消息</div>
      <div className={styles.section}>通知</div>
      {notices.map((n) => (
        <div key={n.id} className={styles.item}>
          <div className={n.official ? `${styles.icon} ${styles.iconOfficial}` : styles.icon}>{n.icon}</div>
          <div className={styles.col}>
            <div className={styles.itemTitle}>{n.title}</div>
            <div className={styles.itemTime}>{n.time}</div>
          </div>
        </div>
      ))}
      <div className={styles.section}>私信</div>
      {dms.map((d) => (
        <div key={d.id} className={styles.item}>
          <div className={styles.icon}>{d.avatar}</div>
          <div className={styles.col}>
            <div className={styles.itemTitle}>{d.name}</div>
            <div className={d.locked ? styles.lock : styles.itemTime}>{d.preview}</div>
          </div>
          <div className={styles.itemTime}>{d.time}</div>
        </div>
      ))}
    </>
  )
}
