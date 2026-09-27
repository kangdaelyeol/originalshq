import type {
  Cafe24RevenueSummary,
  CombinedInsight,
  OfflineRevenueSummary,
} from '../client'
import { SingleSelectDropdown } from './single-select-dropdown'
import {
  RoasGrouping,
  useRoasViewModel,
  type RoasMetrics,
  type RoasRow,
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
  {
    key: 'onlineRevenue',
    label: '온라인 매출',
    format: won,
    formatCompact: won,
  },
  {
    key: 'totalRevenue',
    label: '총 매출',
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

// ------------------------------------------------------------------ ROAS 추이 시각화
// SVG viewBox를 고정 논리 좌표(1000×220)로 두고 preserveAspectRatio="none"으로
// 늘려서, index-line-chart.tsx처럼 ResizeObserver로 실제 px 크기를 재지 않고도
// 반응형으로 그린다 — 이 차트는 "기간별 추이" 표를 보완하는 간단한 막대 그래프
// 하나뿐이라, 그 정도로 무거운 장치 없이도 충분하다(모듈 독립성 우선).
const CHART_VB_W = 1000
const CHART_VB_H = 220
const CHART_MARGIN = { top: 24, right: 12, bottom: 26, left: 46 }

/** y축 최댓값을 100 단위로 올림 — 150%면 200까지, 480%면 500까지처럼 눈금이
 * 딱 떨어지게 한다. ROAS가 전부 낮아도(예: 40%) 100% 기준선은 항상 보이도록
 * 최소 100은 보장한다. */
function roundUpToHundred(value: number): number {
  return Math.max(100, Math.ceil(value / 100) * 100)
}

/** "기간별 추이" 표 바로 아래에 두는 간단한 ROAS 막대 그래프 — 표의 숫자를
 * 한눈에 훑어볼 수 있도록 그래프 하나만 곁들인다(엑셀 다운로드용 상세 차트인
 * IndexLineChart와 달리 호버·범례·지표 여러 개 겹쳐보기 같은 기능은 없다).
 * 막대 색은 이 앱 전역에서 "증가/양호"를 뜻하는 초록(#3fb950)과 "감소/부진"을
 * 뜻하는 빨강(#ff7b72)을 그대로 재사용한다(channel-insight.scss의
 * __metric-delta.is-up/is-down과 같은 색) — ROAS 100%(광고비만큼 매출이 났는지)
 * 기준으로 갈린다. */
function RoasTrendChart({ rows }: { rows: readonly RoasRow[] }) {
  const n = rows.length
  const plotW = CHART_VB_W - CHART_MARGIN.left - CHART_MARGIN.right
  const plotH = CHART_VB_H - CHART_MARGIN.top - CHART_MARGIN.bottom
  const plotBottom = CHART_MARGIN.top + plotH
  const maxValue = roundUpToHundred(
    Math.max(100, ...rows.map((r) => r.metrics.roas)) * 1.15,
  )
  const bandW = plotW / n
  const barW = Math.min(bandW * 0.56, 34)
  const yOf = (v: number) => plotBottom - (v / maxValue) * plotH
  const xOf = (i: number) => CHART_MARGIN.left + bandW * i + (bandW - barW) / 2
  const labelStride = Math.max(1, Math.ceil(n / 8))
  const ticks = [0, maxValue / 2, maxValue]

  return (
    <div className="channel-insight__roas-chart">
      <svg
        className="channel-insight__roas-chart-svg"
        viewBox={`0 0 ${CHART_VB_W} ${CHART_VB_H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="기간별 ROAS 추이 그래프"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={CHART_MARGIN.left}
              x2={CHART_VB_W - CHART_MARGIN.right}
              y1={yOf(t)}
              y2={yOf(t)}
              className="channel-insight__roas-chart-grid"
            />
            <text
              x={CHART_MARGIN.left - 8}
              y={yOf(t)}
              textAnchor="end"
              dominantBaseline="middle"
              className="channel-insight__roas-chart-axis"
            >
              {Math.round(t)}%
            </text>
          </g>
        ))}

        {rows.map((row, i) => {
          const barY = yOf(row.metrics.roas)
          const h = Math.max(0, plotBottom - barY)
          return (
            <g key={row.key}>
              <rect
                x={xOf(i)}
                y={barY}
                width={barW}
                height={h}
                rx={2}
                className={`channel-insight__roas-chart-bar${
                  row.metrics.roas < 100 ? ' is-negative' : ''
                }`}
              >
                <title>{`${row.label}: ${row.metrics.roas.toFixed(1)}%`}</title>
              </rect>
              {(i % labelStride === 0 || i === n - 1) && (
                <text
                  x={xOf(i) + barW / 2}
                  y={CHART_VB_H - 8}
                  textAnchor="middle"
                  className="channel-insight__roas-chart-axis"
                >
                  {row.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** "ROAS" 탭 — 광고비(combinedInsight, Meta+Google+Naver 합산)와 오프라인
 * 매출(offlineRevenue, Monday CRM 매장 결제액) + 온라인 매출(onlineRevenue,
 * Cafe24 자사몰 결제액)을 같은 기간 기준으로 짝지어 광고비 대비 매출(ROAS)을
 * 보여준다. 온라인/오프라인을 합치지 않고 별도 컬럼으로 나눠 어느 채널의
 * 매출인지 구분해서 볼 수 있게 한다. 두 매출 모두 광고 전환매출
 * (MetricsSummary.revenue)이 아니라 실제로 결제된 금액 기준이라, 전환 추적이
 * 부정확한 채널(예: 문의 목적 캠페인)에서도 실제 성과를 볼 수 있다. */
export function RoasPanel({
  combinedInsight,
  offlineRevenue,
  onlineRevenue,
}: {
  combinedInsight: CombinedInsight | null
  offlineRevenue: OfflineRevenueSummary | null
  onlineRevenue: Cafe24RevenueSummary | null
}) {
  const { grouping, setGrouping, total, average, rows } = useRoasViewModel(
    combinedInsight,
    offlineRevenue,
    onlineRevenue,
  )

  if (!combinedInsight || !offlineRevenue || !onlineRevenue) {
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
            <span className="channel-insight__section-head-hint">보기</span>
            <SingleSelectDropdown<RoasGrouping>
              options={GROUPING_OPTIONS}
              value={grouping}
              onChange={setGrouping}
              ariaLabel="보기"
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="channel-insight__result-empty">데이터 없음</p>
        ) : (
          <>
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

            <RoasTrendChart rows={rows} />
          </>
        )}
      </section>
    </div>
  )
}
