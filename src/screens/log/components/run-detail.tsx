import type { BatchRun } from '../client/batch-run-client'
import {
  findJob,
  formatDateTime,
  formatDuration,
  parseResult,
} from '../utils/batch-run'

/** 실행 1건의 상세 — 입력값, 시각, 결과 원본(JSON), 오류 스택. */
export const RunDetail = ({ run }: { run: BatchRun }) => {
  const job = findJob(run.job)
  const scheduledMs = run.scheduledAt ? Date.parse(run.scheduledAt) : null
  const result = parseResult(run)

  return (
    <div className="batch-log__detail">
      <dl className="batch-log__facts">
        <div>
          <dt>함수</dt>
          <dd>
            {job?.functionName ?? run.job}{' '}
            <span className="batch-log__muted">({run.codebase})</span>
          </dd>
        </div>
        <div>
          <dt>실행 방식</dt>
          <dd>{run.trigger === 'scheduled' ? '예약 실행' : '수동 실행'}</dd>
        </div>
        <div>
          <dt>예약 시각</dt>
          <dd>{scheduledMs ? formatDateTime(scheduledMs) : '-'}</dd>
        </div>
        <div>
          <dt>시작</dt>
          <dd>
            {formatDateTime(run.startedAt)}
            {scheduledMs !== null && (
              <span className="batch-log__muted">
                {' '}
                (예약보다{' '}
                {formatDuration(Math.max(run.startedAt - scheduledMs, 0))} 늦게)
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>종료</dt>
          <dd>{run.finishedAt ? formatDateTime(run.finishedAt) : '-'}</dd>
        </div>
        <div>
          <dt>소요 시간</dt>
          <dd>{formatDuration(run.durationMs)}</dd>
        </div>
        {run.params && (
          <div>
            <dt>입력</dt>
            <dd>
              {Object.entries(run.params)
                .map(([key, value]) => `${key}: ${value}`)
                .join(' · ')}
            </dd>
          </div>
        )}
        <div>
          <dt>기록 id</dt>
          <dd className="batch-log__mono">{run.id}</dd>
        </div>
      </dl>

      {run.note && <p className="batch-log__warn">일부 실패: {run.note}</p>}

      {run.error && (
        <>
          <h3>오류</h3>
          <pre className="batch-log__pre is-error">
            {run.error.message}
            {run.error.stack ? `\n\n${run.error.stack}` : ''}
          </pre>
        </>
      )}

      {result !== null && (
        <>
          <h3>결과</h3>
          <pre className="batch-log__pre">
            {JSON.stringify(result, null, 2)}
          </pre>
        </>
      )}
    </div>
  )
}
