import type { TechItemDoc } from '@xtool-core/tech-boards'
import type { TimelineColumn } from '@xtool-core/tech-timeline'
import { cx } from '@/ohq-ui/lib/cx'
import { useHoverCard } from '@/ohq-ui/lib/use-hover-card'
import { mondayDate } from './monday-values'

/**
 * 묶은 "타임라인" 칸(tech-timeline) — 날짜가 하나라도 있으면 "보기", 없으면 비운다. 마우스를 올리거나 누르면
 * 단계 순서대로 날짜 카드를 띄운다(아직 안 간 단계는 흐리게). 날짜를 고치려면 "타임라인 펼치기"로 칸을 펼친다.
 */
export function TimelineCell({ item, column }: { item: TechItemDoc; column: TimelineColumn }) {
  const steps = column.parts.map((part) => ({ part, date: item.values[part.id]?.text?.trim() ?? '' }))
  const filled = steps.filter((step) => step.date).length
  const hover = useHoverCard(
    filled > 0 ? (
      <>
        <span className="hover-card__title">타임라인</span>
        <ul className="hover-card__list">
          {steps.map(({ part, date }) => (
            <li key={part.id} className={cx('hover-card__pair', !date && 'is-empty')}>
              <span>{part.title}</span>
              <span>{date ? mondayDate(date) : '—'}</span>
            </li>
          ))}
        </ul>
      </>
    ) : null,
    { pressable: true },
  )
  return (
    <div className="mon-cell mon-cell--timeline" role="gridcell">
      {filled > 0 && (
        <button
          type="button"
          className="mon-timeline"
          aria-label={`타임라인 보기, 날짜 ${filled}개`}
          {...hover.anchorProps}
        >
          보기
        </button>
      )}
      {hover.card}
    </div>
  )
}
