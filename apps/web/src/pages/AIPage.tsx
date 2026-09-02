import { FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { Avatar } from '../components/Avatar'
import { api, AIConversation, ApiError } from '../api/client'
import { formatAIAnswer } from '../utils/formatAI'
import { useAuth } from '../store/auth'
import styles from './ToolDetailPage.module.css'

const suggestions = ['教务处电话是多少？', '图书馆今天几点闭馆？', '游泳馆几点关门？']

export default function AIPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { account } = useAuth()
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [model, setModel] = useState('')
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [feedbackPending, setFeedbackPending] = useState<number | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [error, setError] = useState('')

  const { data: models } = useQuery({ queryKey: ['ai-models'], queryFn: api.aiModels })
  const { data, refetch } = useQuery({ queryKey: ['ai-conversations'], queryFn: api.aiConversations })
  const conversations = data?.items ?? []
  const remaining = data?.remaining ?? 10
  const current: AIConversation | undefined = conversations.find((item) => item.id === conversationId) ?? conversations[0]
  const activeModel = model || current?.model || models?.items[0]?.model || 'campus-demo'

  const ask = async (question: string) => {
    if (!question.trim() || thinking || remaining <= 0) return
    setError('')
    setThinking(true)
    setInput('')
    try {
      let id = current?.id
      if (!id) {
        const { conversation } = await api.createAIConversation(undefined, activeModel)
        id = conversation.id
        setConversationId(id)
      }
      await api.askAI(id, question.trim(), activeModel)
      await refetch()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '问答服务异常，请稍后重试')
    } finally {
      setThinking(false)
    }
  }

  const sendFeedback = async (messageId: number, satisfied: boolean) => {
    if (!current || feedbackPending !== null) return
    setError('')
    setFeedbackPending(messageId)
    try {
      await api.aiFeedback(current.id, messageId, satisfied)
      await refetch()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '反馈提交失败，请稍后重试')
    } finally {
      setFeedbackPending(null)
    }
  }

  const removeConversation = async (id: number) => {
    await api.deleteAIConversation(id)
    if (conversationId === id) setConversationId(null)
    await queryClient.invalidateQueries({ queryKey: ['ai-conversations'] })
  }

  const submit = (event: FormEvent) => { event.preventDefault(); void ask(input) }

  return (
    <section className={styles.aiShell}>
      <header className={styles.toolHead}>
        <button type="button" onClick={() => navigate('/tools')} aria-label="返回百宝箱"><Icon name="arrowLeft" /></button>
        <div><span>AI CAMPUS ASSISTANT</span><h1>AI 问答</h1></div>
        <div className={styles.aiHeadActions}><button type="button" aria-label="会话历史" aria-expanded={historyOpen} onClick={() => setHistoryOpen(!historyOpen)}><Icon name="message" /></button><button type="button" aria-label="新建会话" onClick={() => setConversationId(null)}><Icon name="plus" /></button></div>
      </header>

      <div className={styles.aiToolbar}>
        <label htmlFor="model-select">当前模型</label>
        <select id="model-select" value={activeModel} onChange={(event) => setModel(event.target.value)}>
          {(models?.items ?? []).map((item) => <option key={item.id} value={item.model}>{item.name}</option>)}
          {(models?.items ?? []).length === 0 && <option value="campus-demo">本地开发模型</option>}
        </select>
        <span><Icon name="clock" />今日剩余 <strong>{remaining}</strong> / 10 次</span>
      </div>

      {historyOpen && (
        <div className={styles.aiHistory}>
          <div><strong>会话历史</strong><small>仅你本人可见，未主动删除会持续保留</small></div>
          {conversations.length ? conversations.map((item) => (
            <div className={styles.historyItem} key={item.id}>
              <button type="button" onClick={() => { setConversationId(item.id); setHistoryOpen(false) }}>{item.title}</button>
              <button type="button" aria-label={`删除会话：${item.title}`} onClick={() => removeConversation(item.id)}><Icon name="trash" /></button>
            </div>
          )) : <p>暂无历史会话</p>}
        </div>
      )}

      <div className={styles.aiMessages} aria-live="polite">
        {(!current || current.messages.length === 0) && (
          <div className={styles.aiWelcome}>
            <span><Icon name="sparkles" /></span>
            <h2>有什么可以帮你？</h2>
            <p>可查询部门电话、办事流程和校内公开资讯。</p>
            <div>{suggestions.map((item) => <button key={item} type="button" onClick={() => void ask(item)}>{item}<Icon name="chevronRight" /></button>)}</div>
          </div>
        )}
        {(current?.messages ?? []).map((message) => (
          <div key={message.id} className={message.role === 'user' ? styles.aiUser : styles.aiAnswer}>
            <span>{message.role === 'user' ? <Avatar value={account?.avatar} fallback={account?.nickname.slice(0, 1) || '我'} /> : <Icon name="sparkles" />}</span>
            <div>
              <p>{message.role === 'assistant' ? formatAIAnswer(message.text) : message.text}</p>
              {message.model && <footer><span>由 {message.model} 回答</span>{message.source && <button type="button"><Icon name="file" />{message.source}</button>}</footer>}
              {message.needs_feedback && (
                <div className={styles.aiFeedback} role="group" aria-label="答案确认">
                  <small>本地知识库的这个答案是你想要的吗？</small>
                  <button type="button" disabled={feedbackPending !== null} onClick={() => void sendFeedback(message.id, true)}>是</button>
                  <button type="button" className={styles.aiFeedbackNo} disabled={feedbackPending !== null} onClick={() => void sendFeedback(message.id, false)}>
                    {feedbackPending === message.id ? '正在联网搜索…' : '否，联网搜索'}
                  </button>
                </div>
              )}
              {message.feedback === 'yes' && <small className={styles.aiFeedbackDone}>已确认：知识库答案有帮助</small>}
            </div>
          </div>
        ))}
        {thinking && <div className={styles.aiAnswer}><span><Icon name="sparkles" /></span><div className={styles.thinking}><i /><i /><i /><small>正在查找校内资料…</small></div></div>}
        {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
      </div>

      <form className={styles.aiComposer} onSubmit={submit}>
        <label className="srOnly" htmlFor="ai-question">向校园助手提问</label>
        <textarea id="ai-question" rows={2} value={input} onChange={(event) => setInput(event.target.value)} placeholder={remaining > 0 ? '继续提问…' : '今日额度已用完，明日 00:00 刷新'} disabled={remaining <= 0} />
        <div><span>AI 回答可能有误，重要信息请核对原始来源</span><button type="submit" disabled={!input.trim() || thinking || remaining <= 0}><Icon name="send" />发送</button></div>
      </form>
    </section>
  )
}
