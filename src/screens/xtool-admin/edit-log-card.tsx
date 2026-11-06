import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { xtoolFirebase } from '@/xtool-auth/firebase'
import { GlassCard, StatusPill } from '@/screens/xtool-tech/components/basic-parts'

// 최근 몇 건까지 실시간으로 받을지 — 더 오래된 기록은 Firestore 콘솔에서 본다.
const LIMIT = 300

interface EditLog {
  id: string
  at: number
  action: 'update' | 'create' | 'delete'
  boardKey: string
  boardName: string
  itemId: string | null
  itemName: string
  by: { email: string; name: string }
  changes: { field: string; title: string; before: string | null; after: string | null }[]
  ok: boolean
  error?: string
}

const stamp = (ms: number) =>
  new Date(ms).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/** 수정 기록 — tech 페이지에서 누가 무엇을 바꿨는지(관리자만 읽는다). */
export function EditLogCard() {
  const [logs, setLogs] = useState<EditLog[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [board, setBoard] = useState('')
  const [q, setQ] = useState('')

  useEffect(
    () =>
      onSnapshot(
        query(collection(xtoolFirebase().db, 'techEditLogs'), orderBy('at', 'desc'), limit(LIMIT)),
        (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EditLog, 'id'>) }))),
        (e) => setError(e.message),
      ),
    [],
  )

  const boards = [...new Set((logs ?? []).map((l) => l.boardName))]
  const needle = q.trim().toLowerCase()
  const shown = (logs ?? []).filter(
    (l) =>
      (!board || l.boardName === board) &&
      (!needle ||
        [l.itemName, l.by.name, l.by.email, ...l.changes.map((c) => `${c.title} ${c.before ?? ''} ${c.after ?? ''}`)]
          .join(' ')
          .toLowerCase()
          .includes(needle)),
  )

  return (
    <GlassCard
      title="수정 기록"
      subtitle={logs ? `최근 ${logs.length}건 — tech 페이지에서 바꾼 내용(Monday 활동 로그에는 API 키 주인만 남아요)` : '불러오는 중…'}
      actions={
        <div className="log-filters">
          <select className="log-select" value={board} onChange={(e) => setBoard(e.target.value)} aria-label="보드">
            <option value="">보드 전체</option>
            {boards.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <label className="admin-search">
            <Search size={14} aria-hidden />
            <span className="sr-only">검색</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="항목·사람·내용 검색" />
          </label>
        </div>
      }
    >
      {error && <p className="member-form__result member-form__result--crit admin-table-error">{error}</p>}
      {logs && shown.length === 0 && <p className="log-empty">{logs.length ? '조건에 맞는 기록이 없어요.' : '아직 기록이 없어요.'}</p>}
      <ol className="log-list">
        {shown.map((log) => (
          <li key={log.id} className="log-row">
            <div className="log-row__head">
              <time className="log-row__time">{stamp(log.at)}</time>
              <strong>{log.by.name || log.by.email}</strong>
              <span className="log-row__verb">
                {log.boardName} · <b>{log.itemName}</b> {log.action === 'create' ? '만듦' : log.action === 'delete' ? '지움' : '수정'}
              </span>
              {!log.ok && (
                <StatusPill tone="crit" dot>
                  실패
                </StatusPill>
              )}
            </div>
            {log.ok ? (
              <ul className="log-row__changes">
                {log.changes.map((c) => (
                  <li key={c.field}>
                    <span className="log-row__field">{c.title}</span>
                    <span className="log-row__before">{c.before ?? '(비어 있음)'}</span>
                    <span aria-hidden>→</span>
                    <span className="log-row__after">{c.after ?? '(비어 있음)'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="log-row__error">{log.error}</p>
            )}
          </li>
        ))}
      </ol>
    </GlassCard>
  )
}
