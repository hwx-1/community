import { useNavigate } from 'react-router-dom'
import Icon, { IconName } from '../components/Icon'
import styles from './ToolDetailPage.module.css'

const groups: { title: string; links: { name: string; description: string; icon: IconName }[] }[] = [
  { title: '学习服务', links: [{ name: '教务系统', description: '选课、成绩与考试安排', icon: 'file' }, { name: '图书馆', description: '馆藏检索与借阅服务', icon: 'bookmark' }, { name: '网络教学平台', description: '课程资料与在线学习', icon: 'link' }] },
  { title: '校园服务', links: [{ name: '学校主页', description: '校园新闻与公开信息', icon: 'home' }, { name: '信息服务门户', description: '统一身份认证入口', icon: 'shield' }, { name: '校园邮箱', description: '学生邮箱服务', icon: 'message' }] },
]

export default function LinksPage() {
  const navigate = useNavigate()
  return (
    <>
      <header className={styles.toolHead}><button type="button" onClick={() => navigate('/tools')} aria-label="返回百宝箱"><Icon name="arrowLeft" /></button><div><span>QUICK LINKS</span><h1>常用网址</h1></div><span className={styles.demoBadge}>后台配置</span></header>
      <div className={styles.linkNotice}><Icon name="info" />以下为界面演示项目；正式链接由超级管理员配置并维护。</div>
      {groups.map((group) => <section key={group.title} className={styles.linkGroup}><h2>{group.title}</h2><div>{group.links.map((item) => <button key={item.name} type="button"><span><Icon name={item.icon} /></span><div><strong>{item.name}</strong><small>{item.description}</small></div><Icon name="chevronRight" /></button>)}</div></section>)}
    </>
  )
}
