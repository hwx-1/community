import { FormEvent, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import PostCard from '../components/PostCard'
import { api } from '../api/client'
import styles from './SearchPage.module.css'

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [value, setValue] = useState(params.get('q') ?? '')
  const keyword = params.get('q')?.trim() ?? ''
  const { data: settings } = useQuery({ queryKey: ['public-settings'], queryFn: api.publicSettings })
  const { data, isFetching } = useQuery({
    queryKey: ['search', keyword],
    queryFn: () => api.listPosts({ q: keyword }),
    enabled: keyword.length > 0,
  })
  const results = data?.items ?? []

  const submit = (event: FormEvent) => { event.preventDefault(); setParams(value.trim() ? { q: value.trim() } : {}) }

  return (
    <>
      <header className={styles.pageHead}><h1>搜索</h1><p>仅搜索已公开帖子的正文与标签。</p></header>
      <form className={styles.search} role="search" onSubmit={submit}>
        <Icon name="search" /><input autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder="输入关键词或标签" aria-label="搜索关键词" /><kbd className={styles.kbd}>⏎ 搜索</kbd><button type="submit">搜索</button>
      </form>
      {keyword && <div className={styles.resultHead}><span>“{keyword}” 的搜索结果</span><small>{isFetching ? '搜索中…' : `${results.length} 条`}</small></div>}
      {results.length > 0 && <div className={styles.results}>{results.map((post) => <PostCard key={post.id} post={post} />)}</div>}
      {!keyword && (
        <div className={styles.empty}>
          <Icon name="search" /><strong>搜索校园动态</strong><p>试试下面的热门话题。</p>
          <div>
            {(settings?.hot_topics ?? []).slice(0, 3).map((topic) => (
              <button key={topic} type="button" onClick={() => { setValue(topic); setParams({ q: topic }) }}># {topic}</button>
            ))}
          </div>
        </div>
      )}
      {keyword && !isFetching && results.length === 0 && <div className={styles.empty}><Icon name="file" /><strong>没有找到相关帖子</strong><p>换个关键词试试，只会展示已经公开的内容。</p></div>}
    </>
  )
}
