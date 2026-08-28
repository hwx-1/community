import styles from './ToolsPage.module.css'

// 工具由超管后台配置（增删改/排序/启用），此处为占位数据
const tools = [
  { id: 1, name: '校园地图', desc: '一张图看全校，点击放大', icon: '🗺' },
  { id: 2, name: 'AI 问答', desc: '部门电话 · 校内资讯', icon: '✦' },
  { id: 3, name: '常用网址', desc: '教务、图书馆等入口', icon: '🔗' },
]

const rank = [
  { no: 1, name: 'AI 问答' },
  { no: 2, name: '校园地图' },
  { no: 3, name: '常用网址' },
]

export default function ToolsPage() {
  return (
    <>
      <div className={styles.title}>校园工具</div>
      <div className={styles.grid}>
        {tools.map((tool) => (
          <div key={tool.id} className={styles.card}>
            <div className={styles.icon}>{tool.icon}</div>
            <div className={styles.name}>{tool.name}</div>
            <div className={styles.desc}>{tool.desc}</div>
          </div>
        ))}
      </div>
      <div className={styles.title}>工具排行</div>
      <div className={styles.rank}>
        {rank.map((item) => (
          <div key={item.no} className={styles.rankRow}>
            <span className={item.no === 1 ? `${styles.rankNo} ${styles.rankNoTop}` : styles.rankNo}>{item.no}</span>
            <span>{item.name}</span>
          </div>
        ))}
      </div>
      <div className={styles.note}>排序由超级管理员手动配置</div>
    </>
  )
}
