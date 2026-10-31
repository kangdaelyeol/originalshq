import type { CSSProperties } from 'react'
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

type JobView = ReturnType<typeof useBatchLogViewModel>['state']['jobs'][number]

const SPARK_W = 320
const SPARK_H = 76

/** 소요 시간 추이 — 최근 실행을 오래된 것부터. 점 색은 그 실행의 결과, 점을
 * 누르면 아래 실행 내역에서 그 실행이 펼쳐진다. */
const DurationSpark = ({
  history,
  onOpenRun,
}: {
  history: JobView['history']
  onOpenRun: (run: BatchRun) => void
}) => {
  const points = history.filter(({ run }) => run.durationMs !== null)
  if (points.length < 2)
    return <p className="log-insp__empty">추이를 그릴 실행이 아직 적습니다.</p>
  const max = Math.max(...points.map(({ run }) => run.durationMs ?? 0), 1)
  const average =
    points.reduce((sum, { run }) => sum + (run.durationMs ?? 0), 0) /
    points.length
  const x = (index: number) =>
    6 + (index * (SPARK_W - 12)) / (points.length - 1)
  const y = (ms: number) => SPARK_H - 8 - (ms / max) * (SPARK_H - 20)
  const line = points
    .map(
      ({ run }, index) =>
        `${index ? 'L' : 'M'}${x(index)},${y(run.durationMs ?? 0)}`,
    )
    .join(' ')
  return (
    <figure className="log-insp__spark">
      <svg
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        role="img"
        aria-label="소요 시간 추이"
      >
        <defs>
          <linearGradient id="log-spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="log-insp__spark-top" />
            <stop offset="1" className="log-insp__spark-bottom" />
          </linearGradient>
        </defs>
        <line
          className="log-insp__spark-avg"
          x1="0"
          x2={SPARK_W}
          y1={y(average)}
          y2={y(average)}
        />
        <path
          className="log-insp__spark-area"
          d={`${line} L${x(points.length - 1)},${SPARK_H} L${x(0)},${SPARK_H} Z`}
        />
        <path className="log-insp__spark-line" d={line} />
        {points.map(({ run, state }, index) => (
          <circle
            key={run.id}
            className={`log-insp__spark-dot is-${state}`}
            cx={x(index)}
            cy={y(run.durationMs ?? 0)}
            r={index === points.length - 1 ? 3.6 : 2.4}
            onClick={() => onOpenRun(run)}
          >
            <title>
              {`${formatDateTime(run.startedAt)} · ${formatDuration(run.durationMs)} · ${STATUS_LABEL[state]}`}
            </title>
          </circle>
        ))}
      </svg>
      <figcaption>
        <span>
          평균 <b>{formatDuration(average)}</b>
        </span>
        <span>
          최장 <b>{formatDuration(max)}</b>
        </span>
        <span>최근 {points.length}회</span>
      </figcaption>
    </figure>
  )
}

/**
 * 작업 하나의 상세 — 파이프라인 노드를 누르면 그래프 아래로 펼쳐진다. 왼쪽부터
 * 지금 상태(판독), 성공률과 소요 시간 추이, 최근 며칠의 예약 시각별 칸(줄 =
 * 날짜, 칸 = 09·11·13·15·17·22시). 칸·점을 누르면 아래 실행 내역에서 그 실행이
 * 펼쳐진다. ←/→로 다른 작업, Esc로 닫는다(batch-log-panel.tsx).
 */
export const JobInspector = ({
  view,
  index,
  total,
  now,
  onOpenRun,
  onStep,
  onClose,
}: {
  view: JobView
  index: number
  total: number
  now: number
  onOpenRun: (run: BatchRun) => void
  onStep: (step: -1 | 1) => void
  onClose: () => void
}) => {
  const { job, latest, latestStatus, counts, missing, grid, history } = view
  const finished = counts.success + counts.partial + counts.failed
  const rate = finished ? counts.success / finished : null
  const state = latestStatus ?? 'no-data'

  return (
    <div className={`log-insp is-${state}`}>
      <header className="log-insp__head">
        <div className="log-insp__title">
          <span className="log-insp__id">
            NODE {String(index + 1).padStart(2, '0')}/
            {String(total).padStart(2, '0')} <i>//</i> {job.id}
          </span>
          <h2>
            {job.label}
            <span className="batch-log__codebase">{job.codebase}</span>
          </h2>
          <p className="batch-log__muted">{job.description}</p>
        </div>
        <div className="log-insp__tools">
          <button
            type="button"
            onClick={() => onStep(-1)}
            aria-label="이전 작업"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => onStep(1)}
            aria-label="다음 작업"
          >
            →
          </button>
          <button
            type="button"
            className="log-insp__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ESC ✕
          </button>
        </div>
      </header>

      <div className="log-insp__body">
        {/* 판독 — 지금 상태를 크게. */}
        <section
          className="log-insp__cell"
          style={{ '--i': 0 } as CSSProperties}
        >
          <h3>READOUT</h3>
          <div className="log-insp__state">
            <strong>
              {STATUS_ICON[state] && (
                <span aria-hidden="true">{STATUS_ICON[state]}</span>
              )}
              {STATUS_LABEL[state]}
            </strong>
            <span>
              {latest ? formatAgo(latest.startedAt, now) : '기록 없음'}
            </span>
          </div>
          <dl className="batch-log__facts">
            <div>
              <dt>마지막 실행</dt>
              <dd>{latest ? formatDateTime(latest.startedAt) : '-'}</dd>
            </div>
            <div>
              <dt>소요 시간</dt>
              <dd>{latest ? formatDuration(latest.durationMs) : '-'}</dd>
            </div>
            <div>
              <dt>다음 예정</dt>
              <dd>{formatDateTime(nextScheduledAt(now)).slice(0, -3)}</dd>
            </div>
            <div className="log-insp__wide">
              <dt>함수 · 제한 시간</dt>
              <dd>
                {job.functionName} · {job.timeoutSeconds}초
              </dd>
            </div>
          </dl>
          {latest && (
            <p className="batch-log__summary" title={summarizeRun(latest)}>
              {latest.note && <strong>{latest.note} — </strong>}
              {summarizeRun(latest)}
            </p>
          )}
        </section>

        {/* 성공률 + 소요 시간 추이. */}
        <section
          className="log-insp__cell"
          style={{ '--i': 1 } as CSSProperties}
        >
          <h3>SUCCESS RATE</h3>
          <div className="log-insp__rate">
            <strong>
              {rate === null ? '-' : `${Math.round(rate * 100)}`}
              {rate !== null && <small>%</small>}
            </strong>
            <span>
              {finished === 0
                ? '기간 내 실행 없음'
                : `${counts.success}/${finished}회 성공`}
              {counts.partial > 0 && ` · 일부 실패 ${counts.partial}`}
              {counts.failed + counts.timeout > 0 &&
                ` · 실패 ${counts.failed + counts.timeout}`}
              {missing > 0 && (
                <em className="batch-log__warn"> · 누락 {missing}</em>
              )}
            </span>
          </div>
          <div className="log-insp__squares" aria-hidden="true">
            {history.map(({ run, state: runState }) => (
              <i key={run.id} className={`is-${runState}`} />
            ))}
          </div>
          <h3>DURATION</h3>
          <DurationSpark history={history} onOpenRun={onOpenRun} />
        </section>

        {/* 예약 시각 칸 — 위에서부터 차례로 켜진다. */}
        <section
          className="log-insp__cell"
          style={{ '--i': 2 } as CSSProperties}
        >
          <h3>SCHEDULE</h3>
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
              {grid.map(({ date, slots }, row) => (
                <tr key={date}>
                  <th scope="row">{formatDay(date)}</th>
                  {slots.map((slot, column) => {
                    const label = `${formatDay(date)} ${slot.hour}시 — ${STATUS_LABEL[slot.state]}${
                      slot.run
                        ? ` · ${formatDuration(slot.run.durationMs)} · ${summarizeRun(slot.run)}`
                        : ''
                    }`
                    const style = {
                      '--i': row * SCHEDULE_HOURS.length + column,
                    } as CSSProperties
                    return (
                      <td key={slot.hour}>
                        {slot.run ? (
                          <button
                            type="button"
                            className={`batch-log__slot is-${slot.state}`}
                            style={style}
                            title={label}
                            aria-label={label}
                            onClick={() => slot.run && onOpenRun(slot.run)}
                          >
                            {STATUS_ICON[slot.state]}
                          </button>
                        ) : (
                          <span
                            className={`batch-log__slot is-${slot.state}`}
                            style={style}
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
      </div>
    </div>
  )
}
