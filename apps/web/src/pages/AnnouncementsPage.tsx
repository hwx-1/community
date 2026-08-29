import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { api, formatTime } from '../api/client'
import styles from './AnnouncementsPage.module.css'

export default function AnnouncementsPage() {
  const { announcementId } = useParams()
  const { data } = useQuery({ queryKey: ['announcements'], queryFn: api.listAnnouncements })
  const items = data?.items ?? []
  const selected = items.find((item) => item.id === Number(announcementId))

  if (selected) return (
    <article className={styles.detail}>
      <Link to="/announcements"><Icon name="arrowLeft" />全部公告</Link>
      <span>平台公告</span>
      <h1>{selected.title}</h1>
      <time>{formatTime(selected.created_at)}</time>
      <div className={styles.articleBody}>
        <p>{selected.summary}</p>
        <p>{selected.body}</p>
      </div>
      <footer><Icon name="info" />本内容由校园社区平台发布，不代表学校官方通知。</footer>
    </article>
  )

  return (
    <>
      <header className={styles.pageHead}><span>COMMUNITY NOTICE</span><h1>平台公告</h1><p>社区运营信息与使用提示。</p></header>
      <section className={styles.list}>
        {items.map((item) => <Link key={item.id} to={`/announcements/${item.id}`}><span><Icon name="bell" /></span><div><strong>{item.title}</strong><p>{item.summary}</p><small>{formatTime(item.created_at)}</small></div><Icon name="chevronRight" /></Link>)}
        {items.length === 0 && <Link to="/announcements"><span><Icon name="bell" /></span><div><strong>暂无公告</strong><p>平台公告会展示在这里。</p></div></Link>}
      </section>
    </>
  )
}
