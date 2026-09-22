import type { CombinedInsight } from '../client'
import type { ISODate } from '../types'
import { METRIC_FIELDS } from './metric-fields'
import { SegmentedToggle } from './segmented-toggle'
import {
  usePeriodTestViewModel,
  type PeriodTestEntityType,
} from '../view-model/use-period-test-view-model'

const ENTITY_TYPE_OPTIONS: readonly {
  value: PeriodTestEntityType
  label: string
}[] = [
  { value: 'campaign', label: '캠페인' },
  { value: 'adset', label: '애드셋' },
]

type DeltaDir = 'up' | 'down' | 'flat'

const DELTA_ARROW: Record<DeltaDir, string> = { up: '▲', down: '▼', flat: '—' }

/** 바로 앞 구간(더 오래된 구간) 대비 증감 — channel-insight.tsx의 computeMetricDelta,
 * index-line-chart.tsx의 computeDelta와 같은 계산을 이 파일 전용으로 작게 다시
 * 둔다(이미 이 코드베이스 여러 곳이 같은 계산을 각자 갖고 있는 패턴 — 표 하나
 * 전용의 단순 계산이라 공용 훅으로 묶기보다 모듈 독립성을 우선한다). */
function computeDelta(
  now: number,
  prev: number,
): { delta: number; pct: number | null; dir: DeltaDir } {
  const delta = now - prev
  const pct = prev !== 0 ? (delta / Math.abs(prev)) * 100 : null
  const dir: DeltaDir = delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down'
  return { delta, pct, dir }
}

interface PeriodTestPanelProps {
  combinedInsight: CombinedInsight | null
  dateStart: ISODate
  dateEnd: ISODate
}

/** "매체별 테스트" 탭 — 캠페인(또는 애드셋) 하나를 골라, 그 안에서 가변 개수의
 * 임의 구간(예: 캠페인 설정을 바꾼 날 전/후)으로 잘라 지표를 나란히 비교한다.
 * 채널별 펼침 행/그래프/엑셀 연동은 이번 범위 밖 — 구간 비교 자체가 핵심. */
export function PeriodTestPanel({
  combinedInsight,
  dateStart,
  dateEnd,
}: PeriodTestPanelProps) {
  const {
    entityType,
    entityName,
    entityOptions,
    periods,
    transposed,
    entity,
    rows,
    setEntityType,
    setEntityName,
    addPeriod,
    removePeriod,
    updatePeriodStart,
    updatePeriodEnd,
    toggleTransposed,
  } = usePeriodTestViewModel(combinedInsight, dateStart, dateEnd)

  return (
    <div className="channel-insight__result">
      <section className="channel-insight__section">
        <div className="channel-insight__section-head">
          <h3 className="channel-insight__section-title">비교 대상</h3>
        </div>

        <div className="channel-insight__period-test-controls">
          <SegmentedToggle<PeriodTestEntityType>
            label="구분"
            options={ENTITY_TYPE_OPTIONS}
            value={entityType}
            onChange={setEntityType}
          />
          {entityOptions.length === 0 ? (
            <span className="channel-insight__result-empty">
              {entityType === 'campaign' ? '캠페인' : 'adset'} 데이터 없음
            </span>
          ) : (
            <div className="segmented-toggle">
              <div className="segmented-toggle__label">
                {entityType === 'campaign' ? '캠페인' : 'adset'}
              </div>
              <select
                className="channel-insight__result-select"
                value={entityName ?? ''}
                onChange={(e) => setEntityName(e.target.value)}
              >
                {entityOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      <section className="channel-insight__section">
        <div className="channel-insight__section-head">
          <h3 className="channel-insight__section-title">구간</h3>
        </div>

        <div className="channel-insight__period-test-rows">
          {periods.map((p) => (
            <div key={p.id} className="channel-insight__period-test-row">
              <input
                type="date"
                min={dateStart}
                max={dateEnd}
                value={p.start}
                onChange={(e) => updatePeriodStart(p.id, e.target.value)}
              />
              <span>~</span>
              <input
                type="date"
                min={dateStart}
                max={dateEnd}
                value={p.end}
                onChange={(e) => updatePeriodEnd(p.id, e.target.value)}
              />
              <button
                type="button"
                className="channel-insight__btn channel-insight__ghost"
                onClick={() => removePeriod(p.id)}
                disabled={periods.length <= 1}
              >
                삭제
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="channel-insight__btn channel-insight__ghost"
          onClick={addPeriod}
        >
          + 구간 추가
        </button>
      </section>

      <section className="channel-insight__section">
        <div className="channel-insight__section-head">
          <h3 className="channel-insight__section-title">구간별 성과</h3>
          <button
            type="button"
            className="channel-insight__compare-toggle"
            onClick={toggleTransposed}
          >
            표 뒤집기
          </button>
        </div>

        {!entity ? (
          <p className="channel-insight__result-empty">데이터 없음</p>
        ) : rows.length === 0 ? (
          <p className="channel-insight__result-empty">
            비교할 구간을 추가해주세요.
          </p>
        ) : (
          <div className="channel-insight__table-wrap">
            <table className="channel-insight__table channel-insight__table--period-test">
              {transposed ? (
                // 구간은 보통 2~4개뿐이고 지표는 10개라, 구간을 컬럼으로 두면
                // (=지표를 행으로) 표가 옆으로 덜 넓어지고 지표 하나씩 구간 간
                // 변화를 위아래로 훑어보기도 더 쉽다 — 기본값.
                <>
                  <thead>
                    <tr>
                      <th>지표</th>
                      {rows.map((row) => (
                        <th key={row.id}>{row.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {METRIC_FIELDS.map((f) => (
                      <tr key={f.key}>
                        <td>{f.label}</td>
                        {rows.map((row, i) => (
                          <MetricValueCell
                            key={row.id}
                            value={row.metrics[f.key]}
                            prevValue={
                              i > 0 ? rows[i - 1].metrics[f.key] : null
                            }
                            field={f}
                          />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : (
                // 구간이 많아지면 반대로 구간을 행에 두는 쪽이 표가 옆으로
                // 덜 길어져 더 편할 수 있다 — "표 뒤집기"로 전환.
                <>
                  <thead>
                    <tr>
                      <th>구간</th>
                      {METRIC_FIELDS.map((f) => (
                        <th key={f.key}>{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const prevRow = i > 0 ? rows[i - 1] : null
                      return (
                        <tr key={row.id}>
                          <td>{row.label}</td>
                          {METRIC_FIELDS.map((f) => (
                            <MetricValueCell
                              key={f.key}
                              value={row.metrics[f.key]}
                              prevValue={
                                prevRow ? prevRow.metrics[f.key] : null
                              }
                              field={f}
                            />
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </>
              )}
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

/** 표 한 칸 — 이전 값이 없으면(구간이든 지표든, 그 축의 첫 항목) 값만, 있으면
 * 그 값 대비 증감(▲/▼ + %)을 같이 보여준다. 표 뒤집기(transposed) 양쪽 모두
 * 같은 셀 렌더링을 공유한다. */
function MetricValueCell({
  value,
  prevValue,
  field,
}: {
  value: number
  prevValue: number | null
  field: (typeof METRIC_FIELDS)[number]
}) {
  if (prevValue == null) {
    return <td>{field.formatCompact(value)}</td>
  }
  const { delta, pct, dir } = computeDelta(value, prevValue)
  return (
    <td>
      <span className="channel-insight__metric-cell">
        <span className={`channel-insight__metric-delta is-${dir}`}>
          {DELTA_ARROW[dir]} {field.formatCompact(Math.abs(delta))}
          {pct != null &&
            ` (${delta >= 0 ? '+' : '-'}${Math.abs(pct).toFixed(1)}%)`}
        </span>
        <span className="channel-insight__metric-value">
          {field.formatCompact(value)}
        </span>
      </span>
    </td>
  )
}
