import { useQuery } from '@tanstack/react-query'
import Icon, { IconName } from '../components/Icon'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import styles from './ToolsPage.module.css'

const toolPaths: Record<string, string> = { ai: '/tools/ai', map: '/tools/map', links: '/tools/links' }
const toolDescs: Record<string, { desc: string; note: string }> = {
  ai: { desc: '查询校内资讯与部门电话', note: '每日 10 次免费额度' },
  map: { desc: '快速查找教学楼与场馆', note: '点击查看大图' },
  links: { desc: '教务、图书馆等常用入口', note: '后台统一维护' },
}

export default function ToolsPage() {
  const navigate = useNavigate()
  const { data } = useQuery({ queryKey: ['tools'], queryFn: api.listTools })
  const tools = data?.items ?? []

  return (
    <>
      <header className={styles.pageHead}>
        <div><span>校园服务</span><h1>百宝箱</h1><p>把常用的校园服务放在一个地方。</p></div>
      </header>

      <section className={styles.grid} aria-label="百宝箱工具">
        {tools.map((tool, index) => {
          const meta = toolDescs[tool.type] ?? { desc: tool.url || '由管理员配置', note: '点击前往' }
          return (
            <button key={tool.id} className={index === 0 ? `${styles.card} ${styles.featured}` : styles.card} type="button" onClick={() => navigate(tool.url || toolPaths[tool.type] || '/tools')}>
              <span className={styles.icon}><Icon name={(tool.icon || 'toolbox') as IconName} /></span>
              <span className={styles.content}><strong>{tool.name}</strong><span>{meta.desc}</span><small>{meta.note}</small></span>
              <Icon name="chevronRight" className={styles.arrow} />
            </button>
          )
        })}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}><h2>使用提示</h2><span>由社区维护</span></div>
        <div className={styles.notice}>
          <Icon name="shield" />
          <div><strong>信息仅供参考</strong><p>涉及考试、学籍等重要事项，请以学校相关部门发布的信息为准。</p></div>
        </div>
      </section>
    </>
  )
}
