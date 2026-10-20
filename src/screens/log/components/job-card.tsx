import type { BatchRun } from '../client/batch-run-client'
import { SCHEDULE_HOURS } from '../constants'
import {
  formatAgo,
  formatDateTime,
  formatDay,
  formatDuration,
  nextScheduledAt,
  STATUS_ICON,
  STATUS_LABEL,
  summarizeRun,
} from '../utils/batch-run'
import type { useBatchLogViewModel } from '../view-model/use-batch-log-view-model'
import { StatusBadge } from './status-badge'

type JobView = ReturnType<typeof useBatchLogViewModel>['state']['jobs'][number]

/**
 * 작업 하나의 현황 카드 — 마지막 실행 결과와, 최근 며칠의 예약 시각별 칸
 * (줄 = 날짜, 칸 = 09·11·13·15·17·22시). 칸을 누르면 그 실행의 상세가 아래
 * 표에서 펼쳐진다.
 */
export const JobCard = ({
  view,
  now,
  onOpenRun,
}: {
  view: JobView
  now: number
  onOpenRun: (run: BatchRun) => void
}) => {
  const { job, latest, latestStatus, counts, missing, grid } = view
  const finished = counts.success + counts.partial + counts.failed

  return (
    <section className="batch-log__card batch-log__job">
      <header className="batch-log__job-head">
        <div>
          <h2>
            {job.label}
            <span className="batch-log__codebase">{job.codebase}</span>
          </h2>
          <p className="batch-log__muted">{job.description}</p>
        </div>
        {latestStatus ? (
          <StatusBadge state={latestStatus} />
        ) : (
          <StatusBadge state="no-data" />
        )}
      </header>

      <dl className="batch-log__facts">
        <div>
          <dt>마지막 실행</dt>
          <dd>
            {latest
              ? `${formatDateTime(latest.startedAt)} (${formatAgo(latest.startedAt, now)})`
              : '기록 없음'}
          </dd>
        </div>
        <div>
          <dt>소요 시간</dt>
          <dd>{latest ? formatDuration(latest.durationMs) : '-'}</dd>
        </div>
        <div>
          <dt>다음 예정</dt>
          <dd>{formatDateTime(nextScheduledAt(now)).slice(0, -3)}</dd>
        </div>
        <div>
          <dt>기간 내 성공</dt>
          <dd>
            {finished === 0
              ? '-'
              : `${counts.success}/${finished}회 (${Math.round((counts.success / finished) * 100)}%)`}
            {missing > 0 && (
              <span className="batch-log__warn"> · 누락 {missing}회</span>
            )}
          </dd>
        </div>
      </dl>
      {latest && (
        <p className="batch-log__summary" title={summarizeRun(latest)}>
          {latest.note && <strong>{latest.note} — </strong>}
          {summarizeRun(latest)}
        </p>
      )}

      <table className="batch-log__grid">
        <thead>
          <tr>
            <th scope="col">날짜</th>
            {SCHEDULE_HOURS.map((hour) => (
              <th key={hour} scope="col">
                {hour}시
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map(({ date, slots }) => (
            <tr key={date}>
              <th scope="row">{formatDay(date)}</th>
              {slots.map((slot) => {
                const label = `${formatDay(date)} ${slot.hour}시 — ${STATUS_LABEL[slot.state]}${
                  slot.run
                    ? ` · ${formatDuration(slot.run.durationMs)} · ${summarizeRun(slot.run)}`
                    : ''
                }`
                return (
                  <td key={slot.hour}>
                    {slot.run ? (
                      <button
                        type="button"
                        className={`batch-log__slot is-${slot.state}`}
                        title={label}
                        aria-label={label}
                        onClick={() => slot.run && onOpenRun(slot.run)}
                      >
                        {STATUS_ICON[slot.state]}
                      </button>
                    ) : (
                      <span
                        className={`batch-log__slot is-${slot.state}`}
                        title={label}
                        aria-label={label}
                        role="img"
                      >
                        {STATUS_ICON[slot.state]}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
