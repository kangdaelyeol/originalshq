import type { TechItemDoc } from '@xtool-core/tech-boards'
import { stepFilled, type TimelineColumn } from '@xtool-core/tech-timeline'
import { cx } from '@/ohq-ui/lib/cx'
import { useHoverCard } from '@/ohq-ui/lib/use-hover-card'
import { StepValue } from '../timeline-rows'

/**
 * 묶은 "타임라인" 칸(tech-timeline) — 값이 하나라도 있으면 "보기", 없으면 비운다. 마우스를 올리거나 누르면
 * 단계 순서대로 날짜(시간 추적은 흐르는 시간) 카드를 띄운다(아직 안 간 단계는 흐리게). 날짜를 고치려면 "타임라인
 * 펼치기"로 칸을 펼친다. 단계 줄 내용은 상세 화면 타임라인 구역과 같다(timeline-rows).
 */
export function TimelineCell({ item, column }: { item: TechItemDoc; column: TimelineColumn }) {
  const steps = column.parts.map((part) => {
    const cell = item.values[part.id]
    return { column: part, cell, filled: stepFilled(part, cell) }
  })
  const count = steps.filter((step) => step.filled).length
  const hover = useHoverCard(
    count > 0 ? (
      <>
        <span className="hover-card__title">타임라인</span>
        <ul className="hover-card__list">
          {steps.map((step) => (
            <li key={step.column.id} className={cx('hover-card__pair', !step.filled && 'is-empty')}>
              <span>{step.column.title}</span>
              <span>
                <StepValue step={step} />
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
