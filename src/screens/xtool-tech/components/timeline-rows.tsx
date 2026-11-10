import type { TechCellValue } from '@xtool-core/tech-boards'
import { mondayDate } from '@xtool-core/monday-values'
import type { TimelineStep } from '@xtool-core/tech-timeline'
import { elapsedSeconds, formatDuration, timeTracking, useTickingNow } from '@xtool-core/time-tracking'
import { cx } from '@/ohq-ui/lib/cx'

// 타임라인 단계 줄 — Monday 표 "보기" 카드(monday-timeline)·대시보드 상세(record-drawer)·물 상세 서랍이 같이 쓴다.
// 모양(목록 테두리·글자색)은 놓이는 목록이 정한다 — 여기는 줄 내용만.

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

/** 단계 값 — 날짜는 Monday 날짜 글자, 시간 추적은 흐르는 시간, 비었으면 — */
export function StepValue({ step }: { step: TimelineStep }) {
  if (!step.filled) return <>—</>
  if (step.column.type === 'time_tracking') return <LiveDuration cell={step.cell} />
  return <>{mondayDate(step.cell?.text ?? '')}</>
}

/** 단계마다 한 줄(li) — 이름 · 값. 아직 안 간 단계는 is-empty(흐리게) */
export function TimelineRows({ steps, metaClassName }: { steps: readonly TimelineStep[]; metaClassName: string }) {
  return (
    <>
      {steps.map((step) => (
        <li key={step.column.id} className={cx('timeline-row', !step.filled && 'is-empty')}>
          <span>{step.column.title}</span>
          <span className={metaClassName}>
            <StepValue step={step} />
          </span>
        </li>
      ))}
    </>
  )
}
