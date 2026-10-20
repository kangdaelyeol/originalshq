import { Fragment } from 'react'
import { BATCH_JOBS } from '../constants'
import {
  displayStatus,
  findJob,
  formatDateTime,
  formatDuration,
  STATUS_LABEL,
  summarizeRun,
  type DisplayStatus,
} from '../utils/batch-run'
import type { useBatchLogViewModel } from '../view-model/use-batch-log-view-model'
import { RunDetail } from './run-detail'
import { StatusBadge } from './status-badge'

type ViewModel = ReturnType<typeof useBatchLogViewModel>

const FILTER_STATUSES: DisplayStatus[] = [
  'success',
  'partial',
  'failed',
  'timeout',
  'running',
]

/** 실행 목록 — 최근 것부터. 줄을 누르면 상세가 펼쳐진다. */
export const RunTable = ({ state, actions }: ViewModel) => {
  const {
    filteredRuns,
    visibleRuns,
    totalRuns,
    jobFilter,
    statusFilter,
    selectedRun,
    now,
  } = state

  return (
    <section className="batch-log__card">
      <header className="batch-log__table-head">
        <h2>
          실행 내역{' '}
          <span className="batch-log__muted">
            {filteredRuns.length.toLocaleString('ko-KR')}
            {filteredRuns.length !== totalRuns &&
              ` / ${totalRuns.toLocaleString('ko-KR')}`}
            건
          </span>
        </h2>
        <div className="batch-log__filters">
          <select
            value={jobFilter}
            aria-label="작업"
            onChange={(e) => actions.changeJobFilter(e.target.value)}
          >
            <option value="all">모든 작업</option>
            {BATCH_JOBS.map((job) => (
              <option key={job.id} value={job.id}>
                {job.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            aria-label="상태"
            onChange={(e) =>
              actions.changeStatusFilter(
                e.target.value as DisplayStatus | 'all',
              )
            }
          >
            <option value="all">모든 상태</option>
            {FILTER_STATUSES.map((each) => (
              <option key={each} value={each}>
                {STATUS_LABEL[each]}
              </option>
            ))}
          </select>
        </div>
      </header>

      {filteredRuns.length === 0 ? (
        <p className="batch-log__empty">
          {totalRuns === 0
            ? '아직 실행 기록이 없습니다. 배치 함수를 배포한 뒤 첫 예약 시각이 지나면 여기에 쌓입니다.'
            : '조건에 맞는 실행이 없습니다.'}
        </p>
      ) : (
        <div className="batch-log__table-scroll">
          <table className="batch-log__table">
            <thead>
              <tr>
                <th>시작</th>
                <th>작업</th>
                <th>상태</th>
                <th className="is-num">소요</th>
                <th>결과</th>
              </tr>
            </thead>
            <tbody>
              {visibleRuns.map((run) => {
                const open = selectedRun?.id === run.id
                return (
                  <Fragment key={run.id}>
                    <tr
                      id={`run-${run.id}`}
                      className={`batch-log__row${open ? ' is-open' : ''}`}
                      onClick={() => actions.toggleRun(run.id)}
                      aria-expanded={open}
                    >
                      <td className="batch-log__mono">
                        <span className="batch-log__caret" aria-hidden="true">
                          {open ? '▾' : '▸'}
                        </span>
                        {formatDateTime(run.startedAt)}
                      </td>
                      <td>{findJob(run.job)?.label ?? run.job}</td>
                      <td>
                        <StatusBadge state={displayStatus(run, now)} />
                      </td>
                      <td className="is-num">
                        {formatDuration(run.durationMs)}
                      </td>
                      <td className="batch-log__result">
                        {run.note && <strong>{run.note} — </strong>}
                        {summarizeRun(run)}
                      </td>
                    </tr>
                    {open && (
                      <tr className="batch-log__detail-row">
                        <td colSpan={5}>
                          <RunDetail run={run} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          {visibleRuns.length < filteredRuns.length && (
            <button
              type="button"
              className="batch-log__more"
              onClick={actions.showMore}
            >
              더 보기 ({visibleRuns.length.toLocaleString('ko-KR')} /{' '}
              {filteredRuns.length.toLocaleString('ko-KR')})
            </button>
          )}
        </div>
      )}
    </section>
  )
}
