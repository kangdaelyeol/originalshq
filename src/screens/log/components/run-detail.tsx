import { useEffect, useState } from 'react'
import { getBatchRun, type BatchRun } from '../client/batch-run-client'
import { CapiAutoDetail } from './capi-auto-detail'
import {
  findJob,
  formatDateTime,
  formatDuration,
  parseResult,
} from '../utils/batch-run'

/** 목록에서 결과가 줄어 있으면(resultCompacted) 원본을 받아 온다 — 받기
 * 전에는 줄인 결과를 그대로 쓴다. */
const useFullRun = (run: BatchRun) => {
  const [full, setFull] = useState<{ id: string; run: BatchRun } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!run.resultCompacted) return
    let cancelled = false
    ;(async () => {
      const res = await getBatchRun(run.id)
      if (cancelled) return
      if (res.ok) setFull({ id: run.id, run: res.data.run })
      else setError(res.error)
    })()
    return () => {
      cancelled = true
    }
  }, [run.id, run.resultCompacted])
  const loaded = full?.id === run.id ? full.run : null
  return {
    run: loaded ?? run,
    loading: Boolean(run.resultCompacted) && !loaded && !error,
    error,
  }
}

/** 실행 1건의 상세 — 입력값, 시각, 결과 원본(JSON), 오류 스택. */
export const RunDetail = ({ run: listed }: { run: BatchRun }) => {
  const { run, loading, error: loadError } = useFullRun(listed)
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

      {loading && <p className="batch-log__muted">결과 전체를 불러오는 중…</p>}
      {loadError && (
        <p className="batch-log__warn">
          {loadError} — 아래는 목록용으로 줄인 결과입니다.
        </p>
      )}

      {run.job === 'capi-auto' && !loading && (
        <CapiAutoDetail result={result} />
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
