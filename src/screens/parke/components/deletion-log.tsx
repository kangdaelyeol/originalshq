import { useState } from 'react'
import { useParkeContext } from '@/screens/parke/context'
import { useDeletionLogs } from '@/screens/parke/controller/use-deletion-logs'
import { formatCardPhone } from '@/screens/parke/entity/card'
import '@/screens/parke/styles/admin-ui.scss'

const formatDateTime = (ms: number) =>
  new Date(ms).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

/** 삭제 기록 — 누가 언제 어떤 시리얼(과 카드)을 지웠는지, 되돌리기. 최근
 * 100건. 접혀 있다가 열 때만 DB에서 받는다. */
const DeletionLogList = () => {
  const { logs, status } = useDeletionLogs()
  const { restore } = useParkeContext()
  const [restoring, setRestoring] = useState<string | null>(null)

  if (status === 'loading')
    return <p className="parke-log__empty">불러오는 중…</p>
  if (status === 'error')
    return <p className="parke-log__empty">삭제 기록을 불러오지 못했습니다</p>
  if (logs.length === 0)
    return <p className="parke-log__empty">삭제 기록이 없습니다</p>

  return (
    <ul className="parke-log__list">
      {logs.map((log) => {
        const title = typeof log.card?.title === 'string' ? log.card.title : ''
        const phone =
          typeof log.card?.phone === 'string'
            ? formatCardPhone(log.card.phone)
            : ''
        return (
          <li
            key={log.id}
            className={`parke-log__item${log.restoredAt ? ' is-restored' : ''}`}
          >
            <div className="parke-log__main">
              <span className="parke-log__serial">{log.serial}</span>
              <span className="parke-log__card">
                {log.card
                  ? [title || '이름 없음', phone].filter(Boolean).join(' · ')
                  : '미등록 시리얼'}
              </span>
            </div>
            <div className="parke-log__meta">
              {formatDateTime(log.deletedAt)} · {log.deletedBy}
              {log.restoredAt && (
                <span className="parke-log__restored">
                  {formatDateTime(log.restoredAt)} 되돌림 · {log.restoredBy}
                </span>
              )}
            </div>
            {!log.restoredAt && (
              <button
                type="button"
                className="parke-btn is-small is-ghost"
                disabled={restoring === log.id}
                onClick={async () => {
                  setRestoring(log.id)
                  await restore(log.id, log.serial)
                  setRestoring(null)
                }}
              >
                {restoring === log.id ? '되돌리는 중…' : '되돌리기'}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export const DeletionLog = () => {
  const [open, setOpen] = useState(false)
  return (
    <section className="parke-log">
      <button
        type="button"
        className="parke-log__toggle"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        삭제 기록 {open ? '▾' : '▸'}
      </button>
      {open && <DeletionLogList />}
    </section>
  )
}
