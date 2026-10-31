import { ExternalLink } from 'lucide-react'
import type { TechBoardDoc } from '../../data/tech-boards'
import { sinceTime } from '../../lib/dates'
import { StatusPill } from '../ui/status-pill'

/** Monday 보드 주소 — 기록 주소(…/boards/<id>/pulses/<item>)에서 앞부분만. */
const boardUrl = (doc: TechBoardDoc): string | null => doc.records.find((r) => r.url)?.url?.split('/pulses/')[0] ?? null

/** 보드 화면 맨 위 — 보드 이름, 실시간 표시, 마지막 전체 동기화, Monday에서 열기. */
export function BoardHeader({ doc }: { doc: TechBoardDoc }) {
  const url = boardUrl(doc)
  return (
    <header className="glass board-header">
      <div className="board-header__title">
        <h1>{doc.name}</h1>
        <p>
          <StatusPill tone="good" dot="pulse">
            실시간
          </StatusPill>
          전체 {doc.records.length}건{doc.syncedAt ? ` · 전체 동기화 ${sinceTime(doc.syncedAt)}` : ''}
          {doc.lastSync && !doc.lastSync.ok && (
            <StatusPill tone="crit" className="board-header__warn">
              마지막 동기화 실패
            </StatusPill>
          )}
        </p>
      </div>
      <div className="board-header__actions">
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="button button--ghost button--md">
            <ExternalLink size={14} aria-hidden />
            Monday 보드
          </a>
        )}
      </div>
    </header>
  )
}
