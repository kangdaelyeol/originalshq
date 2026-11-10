import type { TechCellValue, TechColumn, TechItemDoc } from '@xtool-core/tech-boards'
import type { TimelineColumn } from '@xtool-core/tech-timeline'
import { elapsedSeconds, formatDuration, hasTime, timeTracking, useTickingNow } from '@xtool-core/time-tracking'
import { cx } from '@/ohq-ui/lib/cx'
import { useHoverCard } from '@/ohq-ui/lib/use-hover-card'
import { mondayDate } from './monday-values'

/** 타임라인 칸 하나에 값이 있는지 — 날짜는 글자, 시간 추적은 쌓인 시간(켜져 있거나 0초보다 많다) */
const filled = (part: TechColumn, cell: TechCellValue | undefined): boolean =>
  part.type === 'time_tracking' ? hasTime(timeTracking(cell)) || !!cell?.text?.trim() : !!cell?.text?.trim()

/** 시간 추적 — 켜져 있으면 1초마다 올라간다(Monday처럼, 값은 켜고 끌 때만 바뀐다 — time-tracking.ts) */
export function LiveDuration({ cell }: { cell: TechCellValue | undefined }) {
  const t = timeTracking(cell)
  const now = useTickingNow(!!t?.running)
  if (!t) return <>{cell?.text?.trim() || '—'}</>
  return (
    <>
      {formatDuration(elapsedSeconds(t, now))}
      {t.running && ' · 진행 중'}
    </>
  )
}

/**
 * 묶은 "타임라인" 칸(tech-timeline) — 값이 하나라도 있으면 "보기", 없으면 비운다. 마우스를 올리거나 누르면
 * 단계 순서대로 날짜(시간 추적은 흐르는 시간) 카드를 띄운다(아직 안 간 단계는 흐리게). 날짜를 고치려면 "타임라인
 * 펼치기"로 칸을 펼친다.
 */
export function TimelineCell({ item, column }: { item: TechItemDoc; column: TimelineColumn }) {
  const steps = column.parts.map((part) => {
    const cell = item.values[part.id]
    return { part, cell, filled: filled(part, cell) }
  })
  const count = steps.filter((step) => step.filled).length
  const hover = useHoverCard(
    count > 0 ? (
      <>
        <span className="hover-card__title">타임라인</span>
        <ul className="hover-card__list">
          {steps.map(({ part, cell, filled: has }) => (
            <li key={part.id} className={cx('hover-card__pair', !has && 'is-empty')}>
              <span>{part.title}</span>
              <span>
                {!has ? '—' : part.type === 'time_tracking' ? <LiveDuration cell={cell} /> : mondayDate(cell?.text ?? '')}
              </span>
            </li>
          ))}
        </ul>
      </>
    ) : null,
    { pressable: true },
  )
  return (
    <div className="mon-cell mon-cell--timeline" role="gridcell">
      {count > 0 && (
        <button type="button" className="mon-timeline" aria-label={`타임라인 보기, ${count}개`} {...hover.anchorProps}>
          보기
        </button>
      )}
      {hover.card}
    </div>
  )
}
