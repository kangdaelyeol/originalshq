import { ArrowUpRight, ChevronUp } from 'lucide-react'
import { cx } from '../../../lib/cx'
import { CountUp } from './count-up'
import { cssVars } from './d15-format'

interface StatCardProps {
  title: string
  value: number
  /** 아래 한 줄 — "Increased from last month" 또는 "Awaiting review" */
  note: string
  /** up: 작은 "5↑" 꼬리표와 회색 글 · review: 강조색 글만(Pending) */
  noteTone?: 'up' | 'review'
  /** 첫 칸(Total Projects) — 강조색 그라데이션 카드 */
  highlight?: boolean
  /** 떠오르는 차례(0부터 52ms씩) */
  index?: number
  /** 숫자 오르기 시작(ms) — 부품 견본에서 바꿔 본다 */
  countDelay?: number
}

/** 숫자 칸(F205 113×58px) — 제목·↗ 동그라미·큰 숫자(오르기)·아래 한 줄 */
export function StatCard({ title, value, note, noteTone = 'up', highlight, index = 0, countDelay }: StatCardProps) {
  return (
    <article
      className={cx('d15-card d15-stat d15-rise', highlight && 'is-highlight')}
      style={cssVars({ '--i': index })}
    >
      <header className="d15-stat__head">
        <h3 className="d15-stat__title">{title}</h3>
        <button type="button" className="d15-stat__go" aria-label={`Open ${title}`}>
          <ArrowUpRight strokeWidth={2.2} aria-hidden />
        </button>
      </header>
      <CountUp className="d15-stat__value" value={value} delay={countDelay} />
      <p className={cx('d15-stat__note', noteTone === 'review' && 'is-review')}>
        {noteTone === 'up' && (
          <span className="d15-stat__chip" aria-hidden>
            5<ChevronUp strokeWidth={3} />
          </span>
        )}
        {note}
      </p>
    </article>
  )
}
