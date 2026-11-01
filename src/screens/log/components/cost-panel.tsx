import { useState, type CSSProperties } from 'react'
import { MAX_FLOW_VIEWS } from '../constants'
import {
  COST_RESOURCES,
  formatBytes,
  formatCount,
  formatMs,
  formatUsd,
  PRICE,
} from '../utils/api-cost'
import { formatAgo, formatDateTime } from '../utils/batch-run'
import {
  API_COST_PERIOD_OPTIONS,
  useApiCostViewModel,
} from '../view-model/use-api-cost-view-model'
import { useLatched } from '../view-model/use-latched'
import { CostNodePanel } from './cost-node-panel'
import { CostFlow } from './flow-graphs'

type CallSort = 'reads' | 'slow'

/**
 * /log의 "비용 분석" 탭 — xtool 함수가 호출마다 쓴 자원(Firestore 읽기·쓰기·
 * 삭제, 실행 시간, 응답 크기, 외부 호출)과 그 어림 비용. 재료는 함수가 호출마다
 * 남긴 로그(functions-xtool cost-trace.ts → Cloud Logging → BigQuery ops_logs),
 * 금액은 가정 단가(utils/api-cost.ts)로 어림한다 — 실제 청구액이 아니라
 * 함수끼리의 비중을 보는 용도다.
 */
export function CostPanel() {
  const { state, actions } = useApiCostViewModel()
  const { days, report, status, error, fns, daily, totals, now } = state
  // 비용 지도에서 고른 노드 — 오른쪽 상세 패널.
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const shownNode = useLatched(selectedNode)
  const [callSort, setCallSort] = useState<CallSort>('reads')

  // 그림의 노드 순서(←/→) — 호출 방식, 함수, 자원.
  const top = fns.slice(0, MAX_FLOW_VIEWS)
  const nodeIds = [
    ...[...new Set(top.map((each) => each.trigger))].map((t) => `trigger:${t}`),
    ...top.map((each) => `fn:${each.fn}`),
    ...COST_RESOURCES.map((each) => `res:${each.id}`),
  ]
  const toggleNode = (nodeId: string) =>
    setSelectedNode((prev) => (prev === nodeId ? null : nodeId))
  // 기록이 있는 날 수 — 기록을 남기기 시작한 지 며칠 안 됐을 때도 월 환산이
  // 맞게(기간 일수가 아니라 실제로 기록된 날로 나눈다).
  const coveredDays = Math.max(1, daily.length)
  const monthly = (totals.cost / coveredDays) * 30
  const maxDailyCost = Math.max(1e-12, ...daily.map((day) => day.cost))
  const calls =
    callSort === 'reads' ? (report?.topReads ?? []) : (report?.topSlow ?? [])

  return (
    <>
      <header className="batch-log__header">
        <div>
          <h2 className="batch-log__title">비용 분석</h2>
          <p className="batch-log__muted">
            xtool·cmip 함수가 호출마다 쓴 자원과 어림 비용 — 로그가 BigQuery에
            들어오기까지 1분쯤, 화면은 몇 분마다 새로 집계합니다.
          </p>
        </div>
        <div className="batch-log__controls">
          <div
            className="batch-log__segmented"
            role="tablist"
            aria-label="기간"
          >
            {API_COST_PERIOD_OPTIONS.map((option) => (
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
          비용 기록을 불러오지 못했습니다: {error}
        </p>
      )}

      <section className="batch-log__totals" aria-label="기간 요약">
        <div>
          <span>어림 비용</span>
          <strong>{formatUsd(totals.cost)}</strong>
        </div>
        <div>
          <span>월 환산 (기록 {coveredDays}일 기준)</span>
          <strong>{formatUsd(monthly)}</strong>
        </div>
        <div>
          <span>호출</span>
          <strong>{formatCount(totals.calls)}</strong>
        </div>
        <div>
          <span>Firestore 읽기</span>
          <strong>{formatCount(totals.reads)}</strong>
        </div>
        <div>
          <span>쓰기 (삭제 {formatCount(totals.deletes)})</span>
          <strong>{formatCount(totals.writes)}</strong>
        </div>
        <div>
          <span>마지막 집계</span>
          <strong className="is-small">
            {report
              ? `${formatDateTime(report.fetchedAt).slice(-8)} (${formatAgo(report.fetchedAt, now)})`
              : status === 'loading'
                ? '불러오는 중…'
                : '-'}
          </strong>
        </div>
      </section>

      {fns.length === 0 ? (
        <section className="batch-log__card">
          <p className="batch-log__empty">
            {status === 'loading'
              ? '불러오는 중…'
              : '이 기간에 기록이 없습니다. 함수가 호출되면 1분쯤 뒤부터 보입니다.'}
          </p>
        </section>
      ) : (
        <>
          <section className="batch-log__card log-flow">
            <header className="log-flow__head">
              <b>
                <i aria-hidden="true" />
                COST MAP
              </b>
              <span>
                비싼 함수 상위 {Math.min(MAX_FLOW_VIEWS, fns.length)}개 · 선
                굵기는 금액 · 노드를 누르면 상세
              </span>
            </header>
            <CostFlow fns={fns} selected={selectedNode} onSelect={toggleNode} />
          </section>

          <section className="batch-log__card">
            <h2>함수별 비용</h2>
            <p className="batch-log__muted batch-log__card-desc">
              비싼 순 · 줄을 누르면 오른쪽에 상세
            </p>
            <div className="batch-log__table-scroll">
              <table className="batch-log__table">
                <thead>
                  <tr>
                    <th>함수</th>
                    <th className="is-num">호출</th>
                    <th className="is-num">평균 · p95</th>
                    <th className="is-num">읽기</th>
                    <th className="is-num">호출당 읽기</th>
                    <th className="is-num">쓰기 · 삭제</th>
                    <th className="is-num">응답</th>
                    <th className="is-num">어림 비용</th>
                    <th className="is-num">비중</th>
                  </tr>
                </thead>
                <tbody>
                  {fns.map((row) => {
                    const id = `fn:${row.fn}`
                    return (
                      <tr
                        key={row.fn}
                        className={`batch-log__row${selectedNode === id ? ' is-open' : ''}`}
                        onClick={() => toggleNode(id)}
                      >
                        <td>
                          {row.fn}{' '}
                          {row.codebase && (
                            <span className="batch-log__codebase">
                              {row.codebase}
                            </span>
                          )}{' '}
                          <span className="batch-log__codebase">
                            {row.trigger}
                          </span>
                        </td>
                        <td className="is-num">{formatCount(row.calls)}</td>
                        <td className="is-num">
                          {formatMs(row.avgMs)} · {formatMs(row.p95Ms)}
                        </td>
                        <td className="is-num">{formatCount(row.reads)}</td>
                        <td className="is-num">
                          {row.calls
                            ? formatCount(Math.round(row.reads / row.calls))
                            : '-'}
                        </td>
                        <td className="is-num">
                          {formatCount(row.writes)} · {formatCount(row.deletes)}
                        </td>
                        <td className="is-num">
                          {formatBytes(row.responseBytes)}
                        </td>
                        <td className="is-num">
                          <strong>{formatUsd(row.cost)}</strong>
                        </td>
                        <td className="is-num">
                          {(row.share * 100).toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="batch-log__columns">
            <section className="batch-log__card">
              <h2>날짜별</h2>
              <p className="batch-log__muted batch-log__card-desc">
                한국 날짜 기준 · 모든 함수 합계
              </p>
              <div className="batch-log__table-scroll">
                <table className="batch-log__table">
                  <thead>
                    <tr>
                      <th>날짜</th>
                      <th className="is-num">호출</th>
                      <th className="is-num">읽기</th>
                      <th className="is-num">쓰기</th>
                      <th aria-label="비중 막대" />
                      <th className="is-num">어림 비용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...daily].reverse().map((day) => (
                      <tr key={day.date}>
                        <td>{day.date}</td>
                        <td className="is-num">{formatCount(day.calls)}</td>
                        <td className="is-num">{formatCount(day.reads)}</td>
                        <td className="is-num">{formatCount(day.writes)}</td>
                        <td className="log-cost__bar-cell">
                          <span className="log-cost__bar">
                            <span
                              style={
                                {
                                  width: `${(day.cost / maxDailyCost) * 100}%`,
                                } as CSSProperties
                              }
                            />
                          </span>
                        </td>
                        <td className="is-num">{formatUsd(day.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="batch-log__card">
              <header className="batch-log__table-head">
                <h2>무거운 호출</h2>
                <div
                  className="batch-log__segmented"
                  role="tablist"
                  aria-label="정렬"
                >
                  {(
                    [
                      ['reads', '많이 읽은'],
                      ['slow', '오래 걸린'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={callSort === id}
                      className={callSort === id ? 'is-active' : ''}
                      onClick={() => setCallSort(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </header>
              <div className="batch-log__table-scroll">
                <table className="batch-log__table">
                  <thead>
                    <tr>
                      <th>시각</th>
                      <th>함수</th>
                      <th className="is-num">시간</th>
                      <th className="is-num">읽기</th>
                      <th className="is-num">쓰기</th>
                      <th className="is-num">응답</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.map((call) => (
                      <tr
                        key={`${call.at}|${call.fn}`}
                        className="batch-log__row"
                        onClick={() => toggleNode(`fn:${call.fn}`)}
                      >
                        <td className="batch-log__mono">
                          {formatDateTime(call.at)}
                        </td>
                        <td>
                          {call.fn}
                          {call.coldStart && (
                            <span className="batch-log__codebase">cold</span>
                          )}
                        </td>
                        <td className="is-num">{formatMs(call.durationMs)}</td>
                        <td className="is-num">{formatCount(call.reads)}</td>
                        <td className="is-num">{formatCount(call.writes)}</td>
                        <td className="is-num">
                          {formatBytes(call.responseBytes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="batch-log__card log-cost__note">
            <h2>어림 기준</h2>
            <p className="batch-log__muted">
              Google 공개 요금표의 기본(US) 단가 — Firestore 읽기 $
              {(PRICE.read * 100_000).toFixed(2)} · 쓰기 $
              {(PRICE.write * 100_000).toFixed(2)} · 삭제 $
              {(PRICE.delete * 100_000).toFixed(2)} (10만 건당), 실행 vCPU $
              {PRICE.vcpuSecond}/초(함수당 1개 가정) · 메모리 ${PRICE.gibSecond}
              /GiB·초, 호출 $0.40/100만 건. 무료 사용량을 빼지 않고, 서울 리전
              단가와 조금 다를 수 있습니다. 실제 청구액은 청구
              데이터(billing_export)로 맞춥니다. 이 집계를 만드는 데 BigQuery가{' '}
              {formatBytes(report?.bytesProcessed ?? 0)}를 처리했습니다
              {report?.cached ? ' (몇 분 안의 집계를 다시 씀)' : ''}.
            </p>
          </section>
        </>
      )}

      {shownNode && report && (
        <CostNodePanel
          open={selectedNode !== null}
          nodeId={shownNode}
          nodeIds={nodeIds}
          fns={fns}
          report={report}
          onSelect={setSelectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </>
  )
}
