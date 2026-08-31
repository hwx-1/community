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
      <time>{formatTime(selected.published_at ?? selected.created_at)}</time>
      {selected.image_url && (
        <img className={styles.cover} src={selected.image_url} alt={`${selected.title}公告配图`} />
      )}
      <div className={styles.articleBody}>
        <p className={styles.summary}>{selected.summary}</p>
        <p>{selected.body}</p>
      </div>
      {selected.link_url && (
        <a
          className={styles.action}
          href={selected.link_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <LinkOutlined />
          {selected.link_text || '查看详情'}
        </a>
      )}
      <footer><Icon name="info" />本内容由校园社区平台发布，不代表学校官方通知。</footer>
    </article>
  )

  return (
    <>
      <header className={styles.pageHead}><span>COMMUNITY NOTICE</span><h1>平台公告</h1><p>社区运营信息与使用提示。</p></header>
      <section className={styles.list}>
        {items.map((item) => <Link key={item.id} to={`/announcements/${item.id}`}>{item.image_url ? <img src={item.image_url} alt="" /> : <span><Icon name="bell" /></span>}<div><strong>{item.title}</strong><p>{item.summary}</p><small>{formatTime(item.published_at ?? item.created_at)}</small></div><Icon name="chevronRight" /></Link>)}
        {items.length === 0 && <Link to="/announcements"><span><Icon name="bell" /></span><div><strong>暂无公告</strong><p>平台公告会展示在这里。</p></div></Link>}
      </section>
    </>
  )
}

function LinkOutlined() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.07.07l2-2A5 5 0 0 0 12 4l-1.15 1.15M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.15-1.15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
