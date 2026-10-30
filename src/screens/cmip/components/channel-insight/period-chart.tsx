import '../../styles/insight-charts.scss'
import { useState, type CSSProperties, type PointerEvent } from 'react'
import { GlassLine, smoothPath, useElementSize } from '@/components/glass'
import type { MetricsSummary } from '../../client'
import { CHANNELS, type ChannelKey } from '../channels'
import type { MetricField } from '../metric-fields'
import {
  ADDITIVE_METRIC_KEYS,
  CHART_CHANNEL_COLOR,
  compactNumber,
  finiteOr0,
  roundTopBar,
} from './insight-chart-shared'
import { DELTA_ARROW, computeMetricDelta } from './metric-delta'

/** 그래프의 한 칸(날짜·요일·주·달) — 전체 값과 채널별 값. */
export interface PeriodPoint {
  key: string
  label: string
  combined: MetricsSummary
  channels: Partial<Record<ChannelKey, MetricsSummary>>
}

const PAD = { top: 14, right: 14, bottom: 28 }
// 대비 표시 — 날짜 아래에 앞 칸 대비 %를 한 줄 더(칸이 이만큼 넓을 때만).
const DELTA_ROW = 16
const DELTA_MIN_BAND = 46

/**
 * 기간별 성과 그래프 — 지표 하나를 기간(날짜·요일·주·달)마다.
 *
 * 더해지는 지표(광고비·클릭·전환 등)는 채널별로 쌓은 막대 — 막대 높이가 전체,
 * 칸 하나하나가 채널 몫이다. 비율 지표(ROAS·CTR·CPA 등)는 전체를 굵은 선(+면)
 * 으로, 채널마다 가는 선을 겹친다. 계정 단위로만 있는 지표(매출·ROAS 일부)와
 * 채널이 하나뿐일 때는 전체만.
 *
 * 평균은 점선, 마우스를 올린 칸은 옅게 밝아지고 그 칸의 전체·채널별 값(더해지는
 * 지표는 몫 %)이 떠 있는 유리 판에 보인다. 대비 표시를 켜면 앞 칸 대비 증감이
 * 날짜 아래(자리가 되면)와 유리 판에 표의 색(오름 초록·내림 빨강·같음 회색)으로.
 */
export function PeriodChart({
  points,
  channels,
  field,
  byChannel,
  showCompare,
}: {
  points: readonly PeriodPoint[]
  /** 데이터가 있는 채널 — 쌓는 순서. */
  channels: readonly ChannelKey[]
  field: MetricField
  /** 채널별로 나눠 그릴지(계정 단위 지표·채널 하나면 false). */
  byChannel: boolean
  showCompare: boolean
}) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const metricKey = field.key
  const additive = ADDITIVE_METRIC_KEYS.has(metricKey)
  const n = points.length

  const raw = points.map((p) => p.combined[metricKey])
  const combined = raw.map(finiteOr0)
  const perChannel = Object.fromEntries(
    channels.map((key) => [
      key,
      points.map((p) => finiteOr0(p.channels[key]?.[metricKey])),
    ]),
  ) as Record<ChannelKey, number[]>

  const candidates = [
    ...combined,
    ...(byChannel && !additive
      ? channels.flatMap((key) => perChannel[key])
      : []),
  ]
  const rawMax = Math.max(0, ...candidates)
  const finite = raw.filter(Number.isFinite)
  const mean = finite.length
    ? finite.reduce((sum, v) => sum + v, 0) / finite.length
    : 0
  // 눈금이 딱 떨어지게 — 가장 큰 값보다 조금 위의 "깔끔한" 수.
  const niceMax = (() => {
    if (rawMax <= 0) return 1
    const target = rawMax * 1.12
    const unit = 10 ** Math.floor(Math.log10(target))
    const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
    return (steps.find((step) => step * unit >= target) ?? 10) * unit
  })()
  const ticks = [niceMax, niceMax / 2, 0]
  const unitMark = field.unit === '%' ? '%' : ''
  const left = Math.max(
    40,
    Math.max(...ticks.map((t) => `${compactNumber(t)}${unitMark}`.length)) * 7 +
      14,
  )
  const plotW = Math.max(0, width - left - PAD.right)
  const band = n ? plotW / n : 0
  const deltaRow = showCompare && band >= DELTA_MIN_BAND
  const bottom = PAD.bottom + (deltaRow ? DELTA_ROW : 0)
  const plotH = Math.max(0, height - PAD.top - bottom)
  const barW = Math.max(2, Math.min(band * 0.58, 34))
  const cx = (i: number) => left + band * i + band / 2
  const y = (v: number) => PAD.top + (1 - v / niceMax) * plotH
  const labelStep = Math.max(
    1,
    Math.ceil(n / Math.max(1, Math.floor(plotW / 64))),
  )
  const deltaAt = (i: number) =>
    i > 0 ? computeMetricDelta(raw[i], raw[i - 1]) : null

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!n || band === 0) return
    const box = event.currentTarget.getBoundingClientRect()
    const i = Math.floor((event.clientX - box.left - left) / band)
    setHover(i >= 0 && i < n ? i : null)
  }

  const ready = width > 0 && height > 0 && n > 0
  const hovered = hover === null ? null : points[hover]
  const hoverDelta = hover === null || !showCompare ? null : deltaAt(hover)

  return (
    <div
      ref={ref}
      className="insight-chart__canvas"
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      {ready && (
        <svg width={width} height={height} aria-hidden="true">
          {ticks.map((t) => (
            <g key={t} className="insight-chart__grid">
              <line x1={left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
              <text x={left - 8} y={y(t)} dy="0.35em" textAnchor="end">
                {compactNumber(t)}
                {unitMark}
              </text>
            </g>
          ))}
          {hover !== null && (
            <rect
              className="insight-chart__hover-band"
              x={left + band * hover}
              y={PAD.top}
              width={band}
              height={plotH}
              rx={8}
            />
          )}

          {additive ? (
            <g className="insight-chart__bars">
              {points.map((p, i) => {
                const x = cx(i) - barW / 2
                if (!byChannel) {
                  const top = y(combined[i])
                  const h = PAD.top + plotH - top
                  return h > 0 ? (
                    <path
                      key={p.key}
                      className="insight-chart__bar is-total"
                      d={roundTopBar(x, top, barW, h)}
                      style={{ '--glass-i': Math.min(i, 24) } as CSSProperties}
                    />
                  ) : null
                }
                // 채널 칸을 아래부터 쌓는다 — 맨 위 칸만 위 끝이 둥글다.
                let base = 0
                const segments = channels
                  .map((key) => ({ key, value: perChannel[key][i] }))
                  .filter((s) => s.value > 0)
                return (
                  <g
                    key={p.key}
                    className="insight-chart__stack"
                    style={{ '--glass-i': Math.min(i, 24) } as CSSProperties}
                  >
                    {segments.map((s, si) => {
                      const segBottom = y(base)
                      base += s.value
                      const top = y(base)
                      // 칸 사이 틈 1.5px.
                      const h = Math.max(
                        0,
                        segBottom - top - (si > 0 ? 1.5 : 0),
                      )
                      return si === segments.length - 1 ? (
                        <path
                          key={s.key}
                          d={roundTopBar(x, top, barW, h)}
                          fill={CHART_CHANNEL_COLOR[s.key]}
                        />
                      ) : (
                        <rect
                          key={s.key}
                          x={x}
                          y={top}
                          width={barW}
                          height={h}
                          fill={CHART_CHANNEL_COLOR[s.key]}
                        />
                      )
                    })}
                  </g>
                )
              })}
            </g>
          ) : (
            byChannel &&
            channels.map((key) => (
              <path
                key={key}
                className="insight-chart__channel-line"
                d={smoothPath(perChannel[key].map((v, i) => [cx(i), y(v)]))}
                stroke={CHART_CHANNEL_COLOR[key]}
              />
            ))
          )}

          <line
            className="insight-chart__mean"
            x1={left}
            x2={width - PAD.right}
            y1={y(mean)}
            y2={y(mean)}
          />

          {points.map((p, i) =>
            i % labelStep === 0 || i === n - 1 ? (
              n - 1 - i < labelStep * 0.75 && i !== n - 1 ? null : (
                <text
                  key={p.key}
                  className="insight-chart__xlabel"
                  x={cx(i)}
                  y={height - bottom + 18}
                  textAnchor="middle"
                >
                  {p.label}
                </text>
              )
            ) : null,
          )}

          {deltaRow &&
            points.map((p, i) => {
              const delta = deltaAt(i)
              return delta ? (
                <text
                  key={p.key}
                  className={`insight-chart__xdelta is-${delta.dir}`}
                  x={cx(i)}
                  y={height - 8}
                  textAnchor="middle"
                >
                  {DELTA_ARROW[delta.dir]}
                  {delta.pct != null
                    ? ` ${Math.abs(delta.pct).toFixed(1)}%`
                    : ''}
                </text>
              ) : null
            })}
        </svg>
      )}

      {/* 비율 지표의 전체 — 굵은 유리 선 + 면. */}
      {ready && !additive && (
        <div className="insight-chart__line">
          <GlassLine
            points={combined.map((v, i) => [cx(i), y(v)])}
            width={width}
            height={height}
          />
        </div>
      )}

      {ready && hover !== null && !additive && (
        <svg
          className="insight-chart__dots"
          width={width}
          height={height}
          aria-hidden="true"
        >
          {byChannel &&
            channels.map((key) => (
              <circle
                key={key}
                cx={cx(hover)}
                cy={y(perChannel[key][hover])}
                r={4}
                fill={CHART_CHANNEL_COLOR[key]}
              />
            ))}
          <circle
            className="insight-chart__dot"
            cx={cx(hover)}
            cy={y(combined[hover])}
            r={5}
          />
        </svg>
      )}

      {ready && hovered && hover !== null && (
        <div
          className="insight-chart__tip"
          // 칸 옆에 — 막대를 가리지 않게 왼쪽 반이면 오른쪽, 오른쪽 반이면 왼쪽.
          style={
            cx(hover) < width / 2
              ? { left: cx(hover) + band / 2 + 6, top: PAD.top }
              : { right: width - cx(hover) + band / 2 + 6, top: PAD.top }
          }
        >
          <span className="insight-chart__tip-label">{hovered.label}</span>
          <strong>
            {field.label} {field.format(raw[hover])}
          </strong>
          {hoverDelta && (
            <span className={`insight-chart__tip-delta is-${hoverDelta.dir}`}>
              앞 칸 대비 {DELTA_ARROW[hoverDelta.dir]}{' '}
              {field.format(Math.abs(hoverDelta.delta))}
              {hoverDelta.pct != null &&
                ` (${hoverDelta.delta >= 0 ? '+' : '-'}${Math.abs(hoverDelta.pct).toFixed(1)}%)`}
            </span>
          )}
          {byChannel &&
            channels.map((key) => {
              const value = perChannel[key][hover]
              const share =
                additive && combined[hover] > 0
                  ? ` · ${((value / combined[hover]) * 100).toFixed(0)}%`
                  : ''
              return (
                <span key={key} className="insight-chart__tip-row">
                  <i style={{ background: CHART_CHANNEL_COLOR[key] }} />
                  {CHANNELS.find((c) => c.key === key)?.label}
                  <b>
                    {field.format(value)}
                    {share}
                  </b>
                </span>
              )
            })}
          <small>
            평균 대비{' '}
            {mean === 0 || !Number.isFinite(raw[hover])
              ? '-'
              : `${raw[hover] >= mean ? '+' : '−'}${Math.abs(
                  ((raw[hover] - mean) / mean) * 100,
                ).toFixed(1)}%`}
          </small>
        </div>
      )}
    </div>
  )
}
