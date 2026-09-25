import type { CombinedInsight, OfflineRevenueSummary } from '../client'
import { SegmentedToggle } from './segmented-toggle'
import {
  RoasGrouping,
  useRoasViewModel,
  type RoasMetrics,
} from '../view-model/use-roas-view-model'

const GROUPING_OPTIONS: readonly { value: RoasGrouping; label: string }[] = [
  { value: RoasGrouping.DATE, label: '일별' },
  { value: RoasGrouping.DAY_OF_WEEK, label: '요일별' },
  { value: RoasGrouping.WEEK, label: '주차별' },
  { value: RoasGrouping.MONTH, label: '월별' },
]

const num2 = (v: number): string =>
  v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const won = (v: number): string => `${Math.round(v).toLocaleString()}원`
const pct2 = (v: number): string => `${num2(v)}%`

interface RoasField {
  key: keyof RoasMetrics
  label: string
  format: (v: number) => string
  formatCompact: (v: number) => string
}

// MetricField(metric-fields.ts)와 같은 모양이지만, ROAS/오프라인 매출은
// 광고 채널의 MetricsSummary에 없는 값이라(offlineRevenue, roas) 그 목록에
// 끼워 넣지 않고 이 탭 전용으로 따로 둔다.
const ROAS_FIELDS: readonly RoasField[] = [
  { key: 'spend', label: '광고비', format: won, formatCompact: won },
  {
    key: 'offlineRevenue',
    label: '오프라인 매출',
    format: won,
    formatCompact: won,
  },
  { key: 'roas', label: 'ROAS', format: pct2, formatCompact: pct2 },
]

type DeltaDir = 'up' | 'down' | 'flat'

const DELTA_ARROW: Record<DeltaDir, string> = { up: '▲', down: '▼', flat: '—' }

/** period-test-panel.tsx의 computeDelta와 같은 계산(바로 앞 행 대비 증감) —
 * 이 표 전용으로 다시 작게 둔다(모듈 독립성 우선, 이 코드베이스 여러 곳이
 * 같은 계산을 각자 갖고 있는 것과 같은 패턴). */
function computeDelta(
  now: number,
  prev: number,
): { delta: number; pct: number | null; dir: DeltaDir } {
  const delta = now - prev
  const pct = prev !== 0 ? (delta / Math.abs(prev)) * 100 : null
  const dir: DeltaDir = delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down'
  return { delta, pct, dir }
}

function MetricValueCell({
  value,
  prevValue,
  field,
}: {
  value: number
  prevValue: number | null
  field: RoasField
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

/** "ROAS" 탭 — 광고비(combinedInsight, Meta+Google+Naver 합산)와 오프라인
 * 매출(offlineRevenue, Monday CRM)을 같은 기간 기준으로 짝지어 광고비 대비
 * 오프라인 매출(ROAS)을 보여준다. 온라인 전환매출(MetricsSummary.revenue)이
 * 아니라 매장에서 실제로 결제된 금액 기준이라, 온라인 전환 추적이 부정확한
 * 채널(예: 문의 목적 캠페인)에서도 실제 성과를 볼 수 있다. */
export function RoasPanel({
  combinedInsight,
  offlineRevenue,
}: {
  combinedInsight: CombinedInsight | null
  offlineRevenue: OfflineRevenueSummary | null
}) {
  const { grouping, setGrouping, total, average, rows } = useRoasViewModel(
    combinedInsight,
    offlineRevenue,
  )

  if (!combinedInsight || !offlineRevenue) {
    return <p className="channel-insight__result-empty">데이터 없음</p>
  }

  return (
    <div className="channel-insight__result">
      <section className="channel-insight__summary">
        <div className="channel-insight__summary-head">
          <span className="channel-insight__summary-label">ROAS 요약</span>
        </div>
        <div className="channel-insight__summary-grid">
          {ROAS_FIELDS.map((f) => (
            <div key={f.key} className="channel-insight__kpi">
              <span className="channel-insight__kpi-label">{f.label}</span>
              <span className="channel-insight__kpi-value">
                {f.format(total[f.key])}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="channel-insight__section">
        <div className="channel-insight__section-head">
          <h3 className="channel-insight__section-title">기간별 추이</h3>
          <div className="channel-insight__section-head-actions">
            <SegmentedToggle<RoasGrouping>
              label="보기"
              options={GROUPING_OPTIONS}
              value={grouping}
              onChange={setGrouping}
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="channel-insight__result-empty">데이터 없음</p>
        ) : (
          <div className="channel-insight__table-wrap">
            <table className="channel-insight__table">
              <thead>
                <tr>
                  <th>기간</th>
                  {ROAS_FIELDS.map((f) => (
                    <th key={f.key}>{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const prevRow = i > 0 ? rows[i - 1] : null
                  return (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      {ROAS_FIELDS.map((f) => (
                        <MetricValueCell
                          key={f.key}
                          value={row.metrics[f.key]}
                          prevValue={prevRow ? prevRow.metrics[f.key] : null}
                          field={f}
                        />
                      ))}
                    </tr>
                  )
                })}
                <tr className="channel-insight__table-row--total">
                  <td>합계</td>
                  {ROAS_FIELDS.map((f) => (
                    <td key={f.key}>{f.formatCompact(total[f.key])}</td>
                  ))}
                </tr>
                <tr className="channel-insight__table-row--average">
                  <td>평균</td>
                  {ROAS_FIELDS.map((f) => (
                    <td key={f.key}>{f.formatCompact(average[f.key])}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
