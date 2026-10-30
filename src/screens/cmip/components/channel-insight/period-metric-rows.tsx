import type { CSSProperties } from 'react'
import type { MetricsSummary } from '../../client'
import type { CHANNELS, ChannelKey } from '../channels'
import {
  ACCOUNT_ONLY_METRIC_KEYS,
  METRIC_FIELDS,
  type MetricField,
} from '../metric-fields'
import {
  ADDITIVE_METRIC_KEYS,
  CHART_CHANNEL_COLOR,
} from './insight-chart-shared'
import { DELTA_ARROW, computeMetricDelta } from './metric-delta'
import { PeriodChart, type PeriodPoint } from './period-chart'

type Channel = (typeof CHANNELS)[number]

/** 칸 평균 등 계산한 값 — 큰 값은 정수로, 작은 값(비율 등)은 소수 둘째 자리까지. */
const tidy = (value: number) =>
  Number(value.toFixed(Math.abs(value) >= 100 ? 0 : 2))

/** 증감 — 표의 대비 표시와 같은 모양·색(오름 초록, 내림 빨강, 같음 회색). */
const Delta = ({
  now,
  prev,
  format,
}: {
  now: number
  prev: number | null
  format: (v: number) => string
}) => {
  const cmp = computeMetricDelta(now, prev)
  if (!cmp) return null
  return (
    <span className={`channel-insight__metric-delta is-${cmp.dir}`}>
      {DELTA_ARROW[cmp.dir]} {format(Math.abs(cmp.delta))}
      {cmp.pct != null &&
        ` (${cmp.delta >= 0 ? '+' : '-'}${Math.abs(cmp.pct).toFixed(1)}%)`}
    </span>
  )
}

/** 지표 한 줄 — [기간 값·칸 통계 | 그래프 | 채널별]. */
const MetricRow = ({
  field,
  points,
  channels,
  total,
  showCompare,
  order,
}: {
  field: MetricField
  points: readonly PeriodPoint[]
  channels: readonly Channel[]
  total: Record<'combined' | ChannelKey, MetricsSummary>
  showCompare: boolean
  order: number
}) => {
  const key = field.key
  const additive = ADDITIVE_METRIC_KEYS.has(key)
  const byChannel = !ACCOUNT_ONLY_METRIC_KEYS.has(key) && channels.length > 1

  // 칸 통계 — 값을 모르는 칸(NaN)은 빼고.
  const cells = points
    .map((p) => ({ label: p.label, value: p.combined[key] }))
    .filter((c) => Number.isFinite(c.value))
  const mean = cells.length
    ? tidy(cells.reduce((sum, c) => sum + c.value, 0) / cells.length)
    : NaN
  const max = cells.reduce<(typeof cells)[number] | null>(
    (best, c) => (!best || c.value > best.value ? c : best),
    null,
  )
  const min = cells.reduce<(typeof cells)[number] | null>(
    (best, c) => (!best || c.value < best.value ? c : best),
    null,
  )
  const last = cells.at(-1) ?? null
  const prev = cells.at(-2) ?? null
  // 대비 표시 — 앞 칸보다 오른 칸·내린 칸·같은 칸 수.
  const moves = { up: 0, down: 0, flat: 0 }
  if (showCompare)
    for (let i = 1; i < cells.length; i++) {
      const cmp = computeMetricDelta(cells[i].value, cells[i - 1].value)
      if (cmp) moves[cmp.dir] += 1
    }

  // 채널별 — 더해지는 지표는 전체 중 몫, 비율 지표는 가장 큰 채널 대비 길이.
  const channelValues = channels.map((c) => ({
    ...c,
    value: total[c.key][key],
  }))
  const channelMax = Math.max(
    0,
    ...channelValues.map((c) => (Number.isFinite(c.value) ? c.value : 0)),
  )
  const combinedValue = total.combined[key]

  return (
    <article
      className="period-metric"
      style={{ '--glass-i': Math.min(order, 8) } as CSSProperties}
    >
      <div className="period-metric__info">
        <span className="period-metric__label" title={field.note}>
          {field.label}
        </span>
        <strong className="period-metric__value">
          {field.format(combinedValue)}
        </strong>
        <span className="period-metric__basis">기간 전체</span>
        <dl className="period-metric__stats">
          <div>
            <dt>칸 평균</dt>
            <dd>{Number.isFinite(mean) ? field.format(mean) : '-'}</dd>
          </div>
          <div>
            <dt>최고</dt>
            <dd>
              {max ? field.format(max.value) : '-'}
              {max && <small>{max.label}</small>}
            </dd>
          </div>
          <div>
            <dt>최저</dt>
            <dd>
              {min ? field.format(min.value) : '-'}
              {min && <small>{min.label}</small>}
            </dd>
          </div>
          <div>
            <dt>최근</dt>
            <dd>
              {last ? field.format(last.value) : '-'}
              {last && <small>{last.label}</small>}
            </dd>
          </div>
        </dl>
        {showCompare && last && (
          <div className="period-metric__compare">
            <span className="period-metric__compare-label">앞 칸 대비</span>
            <Delta
              now={last.value}
              prev={prev?.value ?? null}
              format={field.format}
            />
            <span className="period-metric__moves">
              <span className="channel-insight__metric-delta is-up">
                ▲ {moves.up}
              </span>
              <span className="channel-insight__metric-delta is-down">
                ▼ {moves.down}
              </span>
              <span className="channel-insight__metric-delta is-flat">
                — {moves.flat}
              </span>
            </span>
          </div>
        )}
      </div>

      <PeriodChart
        points={points}
        channels={channels.map((c) => c.key)}
        field={field}
        byChannel={byChannel}
        showCompare={showCompare}
      />

      <div className="period-metric__side">
        {byChannel ? (
          <>
            <span className="period-metric__side-title">
              {additive ? '채널별 몫' : '채널별'}
              {showCompare && ' · 최근 칸 앞 칸 대비'}
            </span>
            {channelValues.map((c) => {
              const ratio = additive
                ? combinedValue > 0
                  ? c.value / combinedValue
                  : 0
                : channelMax > 0 && Number.isFinite(c.value)
                  ? c.value / channelMax
                  : 0
              return (
                <div key={c.key} className="period-metric__channel">
                  <span className="period-metric__channel-name">
                    <i style={{ background: CHART_CHANNEL_COLOR[c.key] }} />
                    {c.label}
                    {additive && <em>{(ratio * 100).toFixed(1)}%</em>}
                  </span>
                  <b>{field.format(c.value)}</b>
                  <span className="period-metric__channel-track">
                    <i
                      style={{
                        width: `${Math.min(100, ratio * 100)}%`,
                        background: CHART_CHANNEL_COLOR[c.key],
                      }}
                    />
                  </span>
                  {showCompare && (
                    <span className="period-metric__channel-delta">
                      <Delta
                        now={points.at(-1)?.channels[c.key]?.[key] ?? NaN}
                        prev={points.at(-2)?.channels[c.key]?.[key] ?? null}
                        format={field.format}
                      />
                    </span>
                  )}
                </div>
              )
            })}
          </>
        ) : (
          <>
            <span className="period-metric__side-title">
              {ACCOUNT_ONLY_METRIC_KEYS.has(key) ? '계정 단위 지표' : '채널'}
            </span>
            <p className="period-metric__side-note">
              {ACCOUNT_ONLY_METRIC_KEYS.has(key)
                ? '채널 구분 없이 계정 전체로만 집계됩니다.'
                : `${channels[0]?.label ?? '한 채널'}만 데이터가 있습니다.`}
            </p>
            {field.note && (
              <p className="period-metric__side-note">{field.note}</p>
            )}
          </>
        )}
      </div>
    </article>
  )
}

/**
 * 기간별 성과 — 그래프 보기. 지표마다 한 줄씩: 왼쪽에 기간 전체 값과 칸 통계
 * (평균·최고·최저·최근, 대비 표시면 앞 칸 대비 증감과 오른·내린 칸 수), 가운데
 * 그래프, 오른쪽에 채널별 값.
 */
export function PeriodMetricRows({
  points,
  channels,
  total,
  showCompare,
}: {
  points: readonly PeriodPoint[]
  /** 데이터가 있는 채널. */
  channels: readonly Channel[]
  total: Record<'combined' | ChannelKey, MetricsSummary>
  showCompare: boolean
}) {
  const byChannel = channels.length > 1
  return (
    <div className="period-metrics">
      <div className="insight-chart__legend">
        {byChannel &&
          channels.map((c) => (
            <span key={c.key}>
              <i style={{ background: CHART_CHANNEL_COLOR[c.key] }} />
              {c.label}
            </span>
          ))}
        <span>
          <i className="is-total" />
          전체
        </span>
        <span className="is-mean">칸 평균</span>
        {showCompare && (
          <span className="period-metrics__compare-hint">
            <em className="channel-insight__metric-delta is-up">▲</em>
            <em className="channel-insight__metric-delta is-down">▼</em>앞 칸
            대비
          </span>
        )}
      </div>
      {METRIC_FIELDS.map((field, index) => (
        <MetricRow
          key={field.key}
          field={field}
          points={points}
          channels={channels}
          total={total}
          showCompare={showCompare}
          order={index}
        />
      ))}
    </div>
  )
}
