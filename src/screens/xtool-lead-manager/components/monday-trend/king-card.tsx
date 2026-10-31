import { Fragment, type ReactNode } from 'react'
import { Crown } from 'lucide-react'

/** 순위 한 줄 — 이름, 막대 길이를 정하는 값, 보이는 값, 펼치면 나오는 내용. */
export interface KingRow {
  name: string
  value: number
  valueText: string
  detail: ReactNode
}

/**
 * 왕 카드 하나(기술 통계·영업통계) — 1위를 왕관과 함께 크게, 아래에 담당자
 * 순위(막대·값). 줄을 누르면 그 숫자를 이룬 기록(detail)이 펼쳐진다. 모양은
 * 인입통계 CS팀 카드(.cs_metric_*)와 왕 카드(.tech_king_* — tech-stats.scss).
 */
export const KingCard = ({
  title,
  badge,
  desc,
  rows,
  totalText,
  emptyText,
  notes,
  openKey,
  openRows,
  onToggle,
}: {
  title: string
  badge?: string
  desc: string
  rows: KingRow[]
  /** 1위 아래 "팀 합계 …". */
  totalText: string
  /** 아직 아무도 없을 때 1위 자리 아래에 — 기간 등. */
  emptyText: string
  /** 카드 맨 아래 작은 글씨(지난 기간 1위, 담당자 없음 등). */
  notes: ReactNode[]
  /** 펼친 줄을 가리는 앞부분 — 카드마다 달라야 한다. */
  openKey: string
  openRows: ReadonlySet<string>
  onToggle: (key: string) => void
}) => {
  const [top] = rows
  const max = Math.max(1, ...rows.map((row) => row.value))
  return (
    <section className="stats_card cs_metric tech_king">
      <h2>
        {title}
        {badge && <span className="tech_king_board">{badge}</span>}
      </h2>
      <p className="stats_desc">{desc}</p>

      <div className="tech_king_top">
        <span className="tech_king_crown" aria-hidden="true">
          <Crown strokeWidth={1.8} />
        </span>
        <div className="tech_king_who">
          {top ? (
            <>
              <strong>{top.name}</strong>
              <span>
                {top.valueText} · 팀 합계 {totalText}
              </span>
            </>
          ) : (
            <>
              <strong className="is-empty">아직 없습니다</strong>
              <span>{emptyText}</span>
            </>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <ul className="cs_metric_rows">
          {rows.map((row) => {
            const key = `${openKey}:${row.name}`
            const open = openRows.has(key)
            return (
              <Fragment key={row.name}>
                <li
                  className={`cs_metric_row${open ? ' is-open' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  onClick={() => onToggle(key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onToggle(key)
                    }
                  }}
                >
                  <span className="cs_metric_name">
                    <span className="cs_metric_caret" aria-hidden="true">
                      {open ? '▾' : '▸'}
                    </span>
                    {row.name}
                  </span>
                  <span className="cs_metric_bar" aria-hidden="true">
                    <span style={{ width: `${(row.value / max) * 100}%` }} />
                  </span>
                  <span className="cs_metric_value">{row.valueText}</span>
                </li>
                {open && <li className="cs_metric_detail">{row.detail}</li>}
              </Fragment>
            )
          })}
        </ul>
      )}

      {notes.length > 0 && (
        <p className="tech_king_note">
          {notes.map((note, index) => (
            <span key={index}>{note}</span>
          ))}
        </p>
      )}
    </section>
  )
}
