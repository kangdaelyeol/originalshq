import { PERIOD_OPTIONS } from '../constants'
import { formatAgo, formatDateTime, type SlotState } from '../utils/batch-run'
import { useBatchLogViewModel } from '../view-model/use-batch-log-view-model'
import { useEffect, useState } from 'react'
import { BatchFlow } from './flow-graphs'
import { JobInspector } from './job-inspector'
import { RunTable } from './run-table'
import { StatusBadge } from './status-badge'

const LEGEND: SlotState[] = [
  'success',
  'partial',
  'failed',
  'timeout',
  'running',
  'missing',
  'pending',
  'no-data',
]

/**
 * /log의 "배치 로그" 탭 — functions-xtool·functions-cmip의 예약 실행 함수가
 * 제때 돌았는지, 결과가 어땠는지를 본다. 기록은 각 함수가 batchRuns 컬렉션에
 * 남긴다(functions-xtool/src/batch-log.ts).
 */
export function BatchLogPanel() {
  const viewModel = useBatchLogViewModel()
  const { state, actions } = viewModel
  const { days, status, error, fetchedAt, now, jobs, totals, jobFilter } = state

  // 고른 노드(작업) — 실행 내역의 작업 거르기와 같은 값이다.
  const selectedIndex = jobs.findIndex((view) => view.job.id === jobFilter)
  const selected = selectedIndex === -1 ? null : jobs[selectedIndex]
  // 닫을 때 패널이 접히는 동안에도 내용이 남아 있게, 마지막으로 연 작업을 둔다.
  const [shown, setShown] = useState(selected)
  if (selected && selected !== shown) setShown(selected)
  const closeJob = () => actions.changeJobFilter('all')
  const stepJob = (step: -1 | 1) => {
    const from = selectedIndex === -1 ? 0 : selectedIndex
    actions.changeJobFilter(
      jobs[(from + step + jobs.length) % jobs.length].job.id,
    )
  }

  // 패널이 열려 있으면 ←/→로 다른 작업, Esc로 닫기(입력칸·고르기 상자 안에서는
  // 그 칸의 키로 둔다).
  useEffect(() => {
    if (!selected) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
        return
      if (event.key === 'Escape') actions.changeJobFilter('all')
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        const step = event.key === 'ArrowLeft' ? -1 : 1
        actions.changeJobFilter(
          jobs[(selectedIndex + step + jobs.length) % jobs.length].job.id,
        )
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selected, selectedIndex, jobs, actions])

  return (
    <>
      <header className="batch-log__header">
        <div>
          <h2 className="batch-log__title">배치 실행 로그</h2>
          <p className="batch-log__muted">
            예약 실행: 매일 09·11·13·15·17·22시(KST). 1분마다 자동으로 새로
            불러옵니다.
          </p>
        </div>
        <div className="batch-log__controls">
          <div
            className="batch-log__segmented"
            role="tablist"
            aria-label="기간"
          >
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.days}
                type="button"
                role="tab"
                aria-selected={option.days === days}
                className={option.days === days ? 'is-active' : ''}
                onClick={() => actions.changeDays(option.days)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="batch-log__refresh"
            onClick={() => void actions.reload()}
          >
            새로고침
          </button>
        </div>
      </header>

      {status === 'error' && (
        <p className="batch-log__card batch-log__error">
          실행 기록을 불러오지 못했습니다: {error}
        </p>
      )}

      <section className="batch-log__totals" aria-label="기간 요약">
        <div>
          <span>실행</span>
          <strong>{totals.total.toLocaleString('ko-KR')}회</strong>
        </div>
        <div>
          <span>성공</span>
          <strong>{totals.success.toLocaleString('ko-KR')}</strong>
        </div>
        <div>
          <span>일부 실패</span>
          <strong className={totals.partial ? 'is-partial' : ''}>
            {totals.partial.toLocaleString('ko-KR')}
          </strong>
        </div>
        <div>
          <span>실패·시간 초과</span>
          <strong className={totals.failed + totals.timeout ? 'is-failed' : ''}>
            {(totals.failed + totals.timeout).toLocaleString('ko-KR')}
          </strong>
        </div>
        <div>
          <span>누락 (최근 {state.gridDates.length}일)</span>
          <strong className={totals.missing ? 'is-missing' : ''}>
            {totals.missing.toLocaleString('ko-KR')}
          </strong>
        </div>
        <div>
          <span>마지막 조회</span>
          <strong className="is-small">
            {fetchedAt
              ? `${formatDateTime(fetchedAt).slice(-8)} (${formatAgo(fetchedAt, now)})`
              : status === 'loading'
                ? '불러오는 중…'
                : '-'}
          </strong>
        </div>
      </section>

      <section className="batch-log__card log-flow">
        <header className="log-flow__head">
          <b>
            <i aria-hidden="true" />
            PIPELINE
          </b>
          <span>
            {selected
              ? '← → 다른 작업 · Esc 닫기 · 칸·점을 누르면 그 실행을 펼칩니다'
              : '노드를 누르면 작업 상세가 열리고, 아래 실행 내역도 그 작업만 보여 줍니다'}
          </span>
        </header>
        <BatchFlow
          state={state}
          onSelectJob={(id) =>
            actions.changeJobFilter(jobFilter === id ? 'all' : id)
          }
        />
        {/* 노드를 누르면 그래프 아래로 펼쳐지는 작업 상세. 작업을 바꾸면
            새로 붙여 처음부터 다시 켜지게(key). */}
        <div className={`log-insp-fold${selected ? '' : ' is-closed'}`}>
          <div className="log-insp-fold__inner">
            {shown && (
              <JobInspector
                key={shown.job.id}
                view={shown}
                index={jobs.findIndex((view) => view.job.id === shown.job.id)}
                total={jobs.length}
                now={now}
                onOpenRun={actions.openRun}
                onStep={stepJob}
                onClose={closeJob}
              />
            )}
          </div>
        </div>
      </section>

      <div className="batch-log__legend" aria-label="상태 범례">
        {LEGEND.map((state) => (
          <StatusBadge key={state} state={state} />
        ))}
      </div>

      <RunTable {...viewModel} />
    </>
  )
}
