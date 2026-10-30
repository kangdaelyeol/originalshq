import {
  TEST_KPIS,
  bestSegment,
  formatKpi,
  type AdTestSegment,
  type GoalKpi,
  type SegmentMetrics,
  type TestKpi,
} from '../../client'
import { formatMD } from '../../utils'
import { segmentColor } from './palette'

// 전환이 이보다 적은 구간의 전환 단가·전환율은 우연이 커서 "표본 적음"을 붙인다.
const SMALL_SAMPLE = 5

type Dir = 'up' | 'down' | 'flat'
const ARROW: Record<Dir, string> = { up: '▲', down: '▼', flat: '—' }

const deltaOf = (now: number, prev: number) => {
  const pct = prev !== 0 ? ((now - prev) / Math.abs(prev)) * 100 : null
  // 0.05% 안의 차이는 같음으로(반올림 차이까지 오르내림으로 보이지 않게).
  const flat = pct === null ? Math.abs(now - prev) < 1e-9 : Math.abs(pct) < 0.05
  const dir: Dir = flat ? 'flat' : now > prev ? 'up' : 'down'
  return { dir, pct }
}

/** 판단 지표로 본 결론 한 줄 — 가장 좋은 구간과, 바로 앞 구간 대비. */
const verdict = (
  kpi: TestKpi,
  segments: readonly AdTestSegment[],
  metrics: readonly SegmentMetrics[],
): string | null => {
  const best = bestSegment(kpi, metrics)
  if (best === null) return null
  const value = metrics[best][kpi.key]
  const others = metrics
    .map((m, i) => ({ i, v: m[kpi.key] }))
    .filter((o) => o.i !== best && Number.isFinite(o.v) && o.v !== 0)
  const ref = others[others.length - 1]
  const diff =
    ref && ref.v !== 0
      ? ` — ${segments[ref.i].label} 대비 ${(((value - ref.v) / Math.abs(ref.v)) * 100).toFixed(1)}%`
      : ''
  return `가장 좋은 구간: ${segments[best].label} — ${kpi.label} ${formatKpi(kpi, value)}${diff}`
}

/**
 * 구간별 지표 — 구간이 열, 지표가 줄. 판단 지표 줄을 맨 위에 두고 가장 좋은
 * 구간에 표시. 칸마다 바로 앞 구간 대비 증감(오름 초록·내림 빨강·같음 회색 —
 * 다른 표와 같은 규칙). 전환이 적은 구간의 단가·전환율에는 "표본 적음".
 */
export function SegmentKpis({
  segments,
  metrics,
  primaryKpi,
}: {
  segments: readonly AdTestSegment[]
  metrics: readonly SegmentMetrics[]
  primaryKpi: GoalKpi
}) {
  const primary =
    TEST_KPIS.find((k) => k.goalKpi === primaryKpi) ?? TEST_KPIS[2]
  // 전환 가치가 하나도 없으면(문의 목표 등) ROAS 줄은 뺀다.
  const hasRevenue = metrics.some((m) => m.revenue > 0)
  const rows = [primary, ...TEST_KPIS.filter((k) => k !== primary)].filter(
    (k) => k.key !== 'roas' || hasRevenue || k === primary,
  )
  const conclusion = verdict(primary, segments, metrics)

  if (segments.length === 0) {
    return (
      <p className="ad-test__empty">
        구간을 추가하면 구간마다 지표를 견줍니다.
      </p>
    )
  }
  return (
    <div className="ad-test-kpis">
      {conclusion && <p className="ad-test-kpis__verdict">{conclusion}</p>}
      <div className="channel-insight__table-wrap">
        <table className="channel-insight__table channel-insight__table--period-test ad-test-kpis__table">
          <thead>
            <tr>
              <th>지표</th>
              {segments.map((s, i) => (
                <th key={s.id}>
                  <span className="ad-test-kpis__seg">
                    <i style={{ background: segmentColor(i) }} />
                    {s.label}
                  </span>
                  <small>
                    {formatMD(s.start)}~{formatMD(s.end)} ·{' '}
                    {metrics[i]?.days ?? 0}일
                  </small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((kpi) => {
              const best = bestSegment(kpi, metrics)
              return (
                <tr
                  key={kpi.key}
                  className={kpi === primary ? 'is-primary' : undefined}
                >
                  <td title={kpi.note}>
                    {kpi.label}
                    {kpi === primary && (
                      <span className="ad-badge is-current">판단 지표</span>
                    )}
                  </td>
                  {metrics.map((m, i) => {
                    const value = m[kpi.key]
                    const prev = i > 0 ? metrics[i - 1][kpi.key] : null
                    const d = prev === null ? null : deltaOf(value, prev)
                    const small =
                      (kpi.key === 'cpa' || kpi.key === 'cvr') &&
                      m.conversions < SMALL_SAMPLE
                    return (
                      <td
                        key={segments[i].id}
                        className={best === i ? 'is-best' : undefined}
                      >
                        <span className="ad-test-kpis__value">
                          {best === i && (
                            <span className="ad-test-kpis__best">
                              가장 좋음
                            </span>
                          )}
                          {formatKpi(
                            kpi,
                            value,
                            kpi.unit === 'days' ? m.days : undefined,
                          )}
                        </span>
                        {d && (
                          <span className={`roas-delta is-${d.dir}`}>
                            {ARROW[d.dir]}
                            {d.pct !== null
                              ? ` ${Math.abs(d.pct).toFixed(1)}%`
                              : ''}
                          </span>
                        )}
                        {small && (
                          <span className="ad-test-kpis__small">
                            표본 적음(전환 {m.conversions.toFixed(0)})
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
