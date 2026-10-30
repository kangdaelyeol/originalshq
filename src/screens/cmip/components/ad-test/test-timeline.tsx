import { useState, type CSSProperties, type PointerEvent } from 'react'
import { Segmented, smoothPath, useElementSize } from '@/components/glass'
import type {
  AdEntityDay,
  AdTestSegment,
  DataEvent,
  SegmentMetrics,
  TestKpi,
} from '../../client'
import { formatKpi } from '../../client'
import { formatMD } from '../../utils'
import {
  compactNumber,
  roundTopBar,
} from '../channel-insight/insight-chart-shared'
import type { SettingEvent } from './changes'
import { segmentColor } from './palette'

export type TimelineMetric = 'spend' | 'conversions' | 'primary'

/** 하루 값 — 비율 지표는 분모가 0이면 없음(선이 끊긴다). */
const dayValue = (kpi: TestKpi, d: AdEntityDay): number | null => {
  const div = (a: number, b: number) => (b > 0 ? a / b : null)
  switch (kpi.key) {
    case 'cpa':
      return div(d.spend, d.conversions)
    case 'cvr': {
      const v = div(d.conversions, d.clicks)
      return v === null ? null : v * 100
    }
    case 'ctr': {
      const v = div(d.clicks, d.impressions)
      return v === null ? null : v * 100
    }
    case 'cpc':
      return div(d.spend, d.clicks)
    case 'cpm': {
      const v = div(d.spend, d.impressions)
      return v === null ? null : v * 1000
    }
    case 'roas': {
      const v = div(d.revenue, d.spend)
      return v === null ? null : v * 100
    }
    default:
      return null
  }
}

const niceMax = (max: number) => {
  if (max <= 0) return 1
  const target = max * 1.12
  const unit = 10 ** Math.floor(Math.log10(target))
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
  return (steps.find((s) => s * unit >= target) ?? 10) * unit
}

const PAD = { top: 30, right: 14, bottom: 28, left: 56 }

/**
 * 테스트 범위의 일별 그래프 — 구간마다 색 띠를 깔고 그 구간의 평균(광고비·전환은
 * 일평균, 판단 지표는 구간 합계로 낸 값)을 띠 위에 가로 금으로. 하루 값은 광고비·
 * 전환이면 막대, 판단 지표(비율)면 선. 설정 바뀐 날은 링크색 핀, 성과에서 찾은
 * 변화는 주의색 핀.
 */
export function TestTimeline({
  days,
  from,
  to,
  segments,
  metrics,
  settingEvents,
  dataEvents,
  primary,
}: {
  /** 하루도 빠짐없이 채운 일별 성과. */
  days: readonly AdEntityDay[]
  from: string
  to: string
  segments: readonly AdTestSegment[]
  metrics: readonly SegmentMetrics[]
  settingEvents: readonly SettingEvent[]
  dataEvents: readonly DataEvent[]
  primary: TestKpi
}) {
  const [metric, setMetric] = useState<TimelineMetric>('spend')
  const [ref, size] = useElementSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const height = 240
  const view = days.filter((d) => d.date >= from && d.date <= to)
  const n = view.length
  const width = size.width
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom
  const band = n ? plotW / n : 0
  const asLine = metric === 'primary'
  const valueOf = (d: AdEntityDay): number | null =>
    metric === 'spend'
      ? d.spend
      : metric === 'conversions'
        ? d.conversions
        : dayValue(primary, d)
  const values = view.map(valueOf)
  const segAvg = (i: number) =>
    metric === 'spend'
      ? metrics[i]?.dailySpend
      : metric === 'conversions'
        ? metrics[i]?.dailyConversions
        : metrics[i]?.[primary.key]
  const max = niceMax(
    Math.max(
      0,
      ...values.map((v) => v ?? 0),
      ...segments.map((_, i) => segAvg(i) ?? 0),
    ),
  )
  const y = (v: number) => PAD.top + (1 - v / max) * plotH
  const xOfDate = (date: string) => {
    const i = view.findIndex((d) => d.date === date)
    return i < 0 ? null : PAD.left + band * i
  }
  const fmt = (v: number) =>
    metric === 'primary'
      ? formatKpi(primary, v)
      : metric === 'spend'
        ? `${Math.round(v).toLocaleString()}원`
        : v.toLocaleString(undefined, { maximumFractionDigits: 1 })
  const labelStep = Math.max(
    1,
    Math.ceil(n / Math.max(1, Math.floor(plotW / 58))),
  )
  const ready = width > 0 && n > 0

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!n) return
    const box = event.currentTarget.getBoundingClientRect()
    const i = Math.floor((event.clientX - box.left - PAD.left) / band)
    setHover(i >= 0 && i < n ? i : null)
  }
  const hoverDate = hover === null ? null : view[hover].date
  const segIndexOf = (date: string) =>
    segments.findIndex((s) => s.start <= date && date <= s.end)

  // 줄로 이을 점 — 값이 없는 날에서 끊는다.
  const runs: [number, number][][] = []
  let run: [number, number][] = []
  values.forEach((v, i) => {
    if (v === null) {
      if (run.length) runs.push(run)
      run = []
    } else run.push([PAD.left + band * i + band / 2, y(v)])
  })
  if (run.length) runs.push(run)

  return (
    <div className="insight-chart ad-test-timeline">
      <div className="ad-test-timeline__head">
        <Segmented
          options={{
            spend: '광고비',
            conversions: '전환',
            primary: primary.label,
          }}
          value={metric}
          onChange={setMetric}
          label="그래프 지표"
          role="buttons"
        />
        <span className="ad-test-timeline__hint">
          {metric === 'primary'
            ? '선 = 하루 값 · 굵은 금 = 구간 전체로 낸 값'
            : '막대 = 하루 값 · 굵은 금 = 구간 일평균'}
        </span>
      </div>
      <div
        ref={ref}
        className="insight-chart__canvas"
        style={{ height }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ready && (
          <svg width={width} height={height} aria-hidden="true">
            {/* 구간 띠 */}
            {segments.map((s, i) => {
              const x0 = xOfDate(s.start < from ? from : s.start)
              const x1 = xOfDate(s.end > to ? to : s.end)
              if (x0 === null || x1 === null) return null
              return (
                <g key={s.id}>
                  <rect
                    className="ad-test-timeline__band"
                    x={x0}
                    y={PAD.top - 18}
                    width={x1 + band - x0}
                    height={plotH + 18}
                    rx={8}
                    style={{ fill: segmentColor(i) }}
                  />
                  <text
                    className="ad-test-timeline__band-label"
                    x={x0 + 8}
                    y={PAD.top - 5}
                    style={{ fill: segmentColor(i) }}
                  >
                    {s.label}
                  </text>
                </g>
              )
            })}
            {[max, max / 2, 0].map((t) => (
              <g key={t} className="insight-chart__grid">
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                />
                <text x={PAD.left - 8} y={y(t)} dy="0.35em" textAnchor="end">
                  {metric === 'primary' && primary.unit === 'pct'
                    ? `${Number(t.toFixed(1))}%`
                    : compactNumber(t)}
                </text>
              </g>
            ))}
            {hover !== null && (
              <rect
                className="insight-chart__hover-band"
                x={PAD.left + band * hover}
                y={PAD.top}
                width={band}
                height={plotH}
                rx={6}
              />
            )}

            {asLine
              ? runs.map((points, ri) =>
                  points.length > 1 ? (
                    <path
                      key={ri}
                      className="ad-test-timeline__line"
                      d={smoothPath(points)}
                    />
                  ) : (
                    <circle
                      key={ri}
                      className="insight-chart__dot"
                      cx={points[0][0]}
                      cy={points[0][1]}
                      r={2.5}
                    />
                  ),
                )
              : values.map((v, i) => {
                  if (!v) return null
                  const w = Math.max(2, Math.min(band * 0.62, 22))
                  const top = y(v)
                  const segIndex = segIndexOf(view[i].date)
                  return (
                    <path
                      key={view[i].date}
                      className="insight-chart__bar ad-test-timeline__bar"
                      d={roundTopBar(
                        PAD.left + band * i + (band - w) / 2,
                        top,
                        w,
                        PAD.top + plotH - top,
                      )}
                      style={
                        {
                          fill:
                            segIndex >= 0 ? segmentColor(segIndex) : undefined,
                          '--glass-i': Math.min(i, 24),
                        } as CSSProperties
                      }
                    />
                  )
                })}

            {/* 구간 평균 금 */}
            {segments.map((s, i) => {
              const avg = segAvg(i)
              const x0 = xOfDate(s.start < from ? from : s.start)
              const x1 = xOfDate(s.end > to ? to : s.end)
              if (avg === undefined || x0 === null || x1 === null) return null
              return (
                <line
                  key={`avg:${s.id}`}
                  className="ad-test-timeline__avg"
                  x1={x0 + 2}
                  x2={x1 + band - 2}
                  y1={y(avg)}
                  y2={y(avg)}
                  style={{ stroke: segmentColor(i) }}
                />
              )
            })}

            {/* 변경 핀 — 그 날 칸의 왼쪽 끝(그 날부터 바뀜). */}
            {[
              ...settingEvents.map((e) => ({ date: e.date, kind: 'setting' })),
              ...dataEvents.map((e) => ({ date: e.date, kind: 'data' })),
            ].map((e, i) => {
              const x = xOfDate(e.date)
              if (x === null) return null
              return (
                <g
                  key={`${e.kind}:${e.date}:${i}`}
                  className={`ad-test-timeline__pin is-${e.kind}`}
                >
                  <line x1={x} x2={x} y1={PAD.top} y2={PAD.top + plotH} />
                  <circle cx={x} cy={PAD.top + plotH + 1} r={3.5} />
                </g>
              )
            })}

            {view.map((d, i) =>
              i % labelStep === 0 || i === n - 1 ? (
                n - 1 - i < labelStep * 0.75 && i !== n - 1 ? null : (
                  <text
                    key={`x:${d.date}`}
                    className="insight-chart__xlabel"
                    x={PAD.left + band * i + band / 2}
                    y={height - 8}
                    textAnchor="middle"
                  >
                    {formatMD(d.date)}
                  </text>
                )
              ) : null,
            )}
          </svg>
        )}

        {ready && hover !== null && hoverDate && (
          <div
            className="insight-chart__tip"
            style={
              hover < n / 2
                ? { left: PAD.left + band * (hover + 1) + 6, top: PAD.top }
                : { right: width - (PAD.left + band * hover) + 6, top: PAD.top }
            }
          >
            <span className="insight-chart__tip-label">
              {hoverDate}
              {segIndexOf(hoverDate) >= 0 &&
                ` · ${segments[segIndexOf(hoverDate)].label}`}
            </span>
            <strong>
              {values[hover] === null ? '-' : fmt(values[hover]!)}
            </strong>
            <span className="insight-chart__tip-row">
              광고비<b>{Math.round(view[hover].spend).toLocaleString()}원</b>
            </span>
            <span className="insight-chart__tip-row">
              전환
              <b>
                {view[hover].conversions.toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}
              </b>
            </span>
            {settingEvents
              .filter((e) => e.date === hoverDate)
              .map((e) => (
                <small
                  key={`s:${e.date}`}
                  className="ad-test-timeline__tip-event is-setting"
                >
                  설정 변경 — {e.changes.map((c) => c.label).join(', ')}
                </small>
              ))}
            {dataEvents
              .filter((e) => e.date === hoverDate)
              .map((e) => (
                <small
                  key={`d:${e.kind}`}
                  className="ad-test-timeline__tip-event is-data"
                >
                  {e.kind === 'paused'
                    ? `집행 멈춤 ${e.pausedDays}일`
                    : e.kind === 'resumed'
                      ? '집행 다시 시작'
                      : `광고비 수준 ${e.kind === 'spendUp' ? '상승' : '하락'}`}
                </small>
              ))}
          </div>
        )}
      </div>
      <div className="insight-chart__legend">
        <span>
          <i className="ad-test-timeline__legend-pin is-setting" />
          설정 바뀐 날
        </span>
        <span>
          <i className="ad-test-timeline__legend-pin is-data" />
          성과에서 찾은 변화
        </span>
        <span className="ad-test-timeline__range">
          {formatMD(from)} ~ {formatMD(to)} · {n}일
        </span>
      </div>
    </div>
  )
}
