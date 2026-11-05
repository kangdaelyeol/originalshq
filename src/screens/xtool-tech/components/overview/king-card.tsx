import { ChevronDown, Crown } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import type { KingDef, KingPeriod, KingResult, KingRow } from '@xtool-core/tech-kings'
import { shortDate } from '@xtool-core/dates'
import { cx } from '@/ohq-ui/lib/cx'
import { cardEnter } from '@/ohq-ui/lib/motion'

// 처음에 보여 줄 순위 수 — 나머지는 "외 N명"
const SHOWN = 5

interface KingCardProps {
  def: KingDef
  spanLabel: string
  previousLabel: string
  period: KingPeriod
  result: KingResult | null
  previousTop: KingRow | null
}

/** 기술팀 왕 카드 — 기간 안의 담당자 순위(막대), 줄을 누르면 센 기록. */
export function KingCard({ def, spanLabel, previousLabel, period, result, previousTop }: KingCardProps) {
  const [open, setOpen] = useState<string | null>(null)
  const max = Math.max(1, ...(result?.rows.map((r) => r.count) ?? [1]))
  const rows = result?.rows.slice(0, SHOWN) ?? []

  return (
    <motion.section className="glass card king-card" variants={cardEnter}>
      <header className="king-card__head">
        <h2 className="card__title">
          {spanLabel} {def.title}
        </h2>
      </header>

      {result === null ? (
        <p className="bar-list__empty">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="bar-list__empty">
          아직 실적이 없어요 ({shortDate(period.start)}~{shortDate(period.end)})
        </p>
      ) : (
        <ol className="king-rank">
          {rows.map((row, i) => {
            const opened = open === row.name
            return (
              <li key={row.name} className={cx('king-rank__item', i === 0 && 'is-top')}>
                <button
                  type="button"
                  className="king-rank__row"
                  aria-expanded={opened}
                  onClick={() => setOpen(opened ? null : row.name)}
                >
                  <span className="king-rank__no">{i === 0 ? <Crown size={14} aria-hidden /> : i + 1}</span>
                  <span className="king-rank__name">{row.name}</span>
                  <span className="king-rank__bar" aria-hidden>
                    <span style={{ width: `${(row.count / max) * 100}%` }} />
                  </span>
                  <span className="king-rank__count">{row.count}건</span>
                  <ChevronDown size={14} className={cx('king-rank__chev', opened && 'is-open')} aria-hidden />
                </button>
                {opened && (
                  <ul className="king-rank__facts">
                    {row.facts.slice(0, 12).map((fact) => (
                      <li key={fact.itemId}>
                        <span>
                          {def.dateLabel} {shortDate(fact.date)}
                        </span>
                        {fact.name || '(이름 없음)'}
                      </li>
                    ))}
                    {row.facts.length > 12 && <li className="king-rank__more">외 {row.facts.length - 12}건</li>}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {result && (
        <footer className="king-card__foot">
          <span>합계 {result.total}건</span>
          {result.rows.length > SHOWN && <span>외 {result.rows.length - SHOWN}명</span>}
          {result.unassigned > 0 && <span>담당자 없음 {result.unassigned}건</span>}
          <span>
            {previousLabel} 1위 {previousTop ? `${previousTop.name} ${previousTop.count}건` : '없음'}
          </span>
        </footer>
      )}
    </motion.section>
  )
}
