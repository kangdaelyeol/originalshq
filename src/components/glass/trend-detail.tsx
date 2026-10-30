import './trend-detail.scss'
import { useMemo, useState, type PointerEvent, type Ref } from 'react'
import { X } from 'lucide-react'
import { GlassLine } from './glass-line'
import { smoothPath } from './smooth-path'
import { trendStats } from './trend-stats'
import { useElementSize } from './use-element-size'

/** 펼친 추이에 넘기는 것 — TrendGrid 칸의 detail. */
export interface TrendDetailInfo {
  /** 지표 이름("광고비"). */
  title: string
  /** 기간 등 부제("2026-10-23 ~ 10-29 · 일별"). */
  subtitle?: string
  /** 머리에 크게 적을 값 — 칸에 적힌 기간 값 그대로(비율 지표는 합계로 나눈
   * 값이라 날짜별 평균과 다르다). 없으면 마지막 칸 값. */
  value?: string
  /** 칸마다 이름(날짜 등) — values와 같은 길이. */
  labels: readonly string[]
  /** 값 표기("1,234원", "3.85%"). */
  format: (value: number) => string
  /** 한 칸의 단위 이름 — "일 평균"의 "일". 기본 '일'. */
  unit?: string
}

// ── 펼친 추이의 내용 ──────────────────────────────────────────────────────
// TrendGrid가 누른 칸을 섹션 크기로 키운 자리에 그린다: 머리(이름·기간 값·
// 기간 추세·닫기), 큰 그래프(평균선·직선 추세·이동평균·최고/최저·마우스 위치
// 값), 요약 7칸(일평균·최고·최저·최근·기간 추세·앞뒤 절반·변동성).

const PAD = { top: 36, right: 20, bottom: 30 }

/** 값들이 쓰는 소수 자릿수(0~2) — 평균·추세처럼 계산한 값도 그 자릿수로
 * 반올림해 적는다(정수 금액의 평균이 "2,983,954.143원"이 되지 않게). */
const decimalsOf = (values: readonly number[]) => {
  let decimals = 0
  for (const value of values) {
    while (
      decimals < 2 &&
      Math.abs(value * 10 ** decimals - Math.round(value * 10 ** decimals)) >
        1e-6
    )
      decimals += 1
    if (decimals === 2) break
  }
  return decimals
}

/** 눈금 값 — 눈금 간격의 자릿수(두 자리)로 반올림("3,159,528" → "3,160,000"). */
const roundTick = (value: number, step: number) => {
  if (step <= 0) return value
  const unit = 10 ** (Math.floor(Math.log10(step)) - 1)
  return Math.round(value / unit) * unit
}

const signed = (value: number, format: (v: number) => string) =>
  `${value > 0 ? '+' : value < 0 ? '−' : '±'}${format(Math.abs(value))}`
const pctText = (pct: number | null) =>
  pct === null
    ? ''
    : `${pct > 0 ? '+' : pct < 0 ? '−' : '±'}${Math.abs(pct).toFixed(1)}%`
const tone = (value: number | null) =>
  value === null || Math.abs(value) < 0.05
    ? 'is-flat'
    : value > 0
      ? 'is-up'
      : 'is-down'

export function TrendDetailBody({
  values: input,
  info,
  onClose,
  closeRef,
}: {
  values: readonly number[]
  info: TrendDetailInfo
  onClose: () => void
  closeRef?: Ref<HTMLButtonElement>
}) {
  const values = useMemo(
    () => input.map((v) => (Number.isFinite(v) ? v : 0)),
    [input],
  )
  const stats = useMemo(() => trendStats(values), [values])
  const { labels } = info
  // 칸 값은 그대로, 계산한 값(평균·추세 등)은 값들의 자릿수로 반올림해서.
  const decimals = useMemo(() => decimalsOf(values), [values])
  const format = (value: number) => info.format(Number(value.toFixed(decimals)))
  const unit = info.unit ?? '일'
  const direction =
    stats.trendPct === null || Math.abs(stats.trendPct) < 3
      ? '보합'
      : stats.trendPct > 0
        ? '상승'
        : '하락'

  return (
    <div className="glass_trend_body">
      <header className="glass_trend_head">
        <div className="glass_trend_titles">
          <h2>{info.title}</h2>
          {info.subtitle && <p>{info.subtitle}</p>}
        </div>
        <div className="glass_trend_headline">
          <strong>{info.value ?? format(stats.last)}</strong>
          <span className={`glass_trend_badge ${tone(stats.trendPct)}`}>
            기간 추세 {direction}
            {stats.trendPct !== null && ` ${pctText(stats.trendPct)}`}
          </span>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="glass_trend_close"
          aria-label="닫기"
          onClick={onClose}
        >
          <X strokeWidth={1.8} aria-hidden="true" />
        </button>
      </header>

      <TrendChart
        values={values}
        labels={labels}
        format={format}
        stats={stats}
      />

      <dl className="glass_trend_stats">
        <div>
          <dt>{unit} 평균</dt>
          <dd>{format(stats.mean)}</dd>
          <small>{stats.count}칸</small>
        </div>
        <div>
          <dt>최고</dt>
          <dd>{format(stats.max.value)}</dd>
          <small>{labels[stats.max.index] ?? ''}</small>
        </div>
        <div>
          <dt>최저</dt>
          <dd>{format(stats.min.value)}</dd>
          <small>
            {labels[stats.min.index] ?? ''}
            {stats.zeros > 0 && ` · 0인 칸 ${stats.zeros}`}
          </small>
        </div>
        <div>
          <dt>최근</dt>
          <dd>{format(stats.last)}</dd>
          <small
            className={stats.prev === null ? '' : tone(stats.last - stats.prev)}
          >
            {stats.prev === null
              ? labels[labels.length - 1]
              : `직전 대비 ${signed(stats.last - stats.prev, format)} ${pctText(
                  stats.prev === 0
                    ? null
                    : ((stats.last - stats.prev) / Math.abs(stats.prev)) * 100,
                )}`}
          </small>
        </div>
        <div>
          <dt>기간 추세</dt>
          <dd className={tone(stats.trendPct)}>
            {signed(stats.trendChange, format)}
          </dd>
          <small>직선 추세가 처음 → 끝에 바뀐 양</small>
        </div>
        <div>
          <dt>앞 · 뒤 절반</dt>
          <dd className={tone(stats.halves?.pct ?? null)}>
            {stats.halves ? pctText(stats.halves.pct) || '-' : '-'}
          </dd>
          <small>
            {stats.halves
              ? `${format(stats.halves.first)} → ${format(stats.halves.second)}`
              : '칸이 4개 이상일 때'}
          </small>
        </div>
        <div>
          <dt>변동성</dt>
          <dd>{stats.cv === null ? '-' : `${stats.cv.toFixed(0)}%`}</dd>
          <small>
            표준편차 {format(stats.stdev)} ·{' '}
            {stats.cv === null
              ? ''
              : stats.cv < 15
                ? '고른 편'
                : stats.cv < 40
                  ? '보통'
                  : '들쭉날쭉'}
          </small>
        </div>
      </dl>
    </div>
  )
}

/** 큰 그래프 — 눈금 3줄, 선·면(GlassLine), 평균선, 직선 추세, 이동평균, 최고/최저
 * 점, 마우스를 올린 칸의 세로선과 값. */
function TrendChart({
  values,
  labels,
  format,
  stats,
}: {
  values: readonly number[]
  labels: readonly string[]
  format: (value: number) => string
  stats: ReturnType<typeof trendStats>
}) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  // 왼쪽 여백 — 가장 긴 눈금 글자에 맞춘다.
  const tickText = (value: number) => format(value)
  const left = Math.min(
    130,
    Math.max(
      48,
      Math.max(
        ...[stats.max.value, stats.min.value].map(
          (value) => tickText(value).length * 6.6,
        ),
      ) + 18,
    ),
  )
  const plotW = Math.max(0, width - left - PAD.right)
  const plotH = Math.max(0, height - PAD.top - PAD.bottom)
  const { max, min } = stats
  const span = max.value - min.value
  const lo =
    span === 0
      ? Math.min(0, min.value)
      : min.value >= 0
        ? Math.max(0, min.value - span * 0.12)
        : min.value - span * 0.12
  const hi =
    span === 0
      ? max.value === 0
        ? 1
        : max.value * 1.2
      : max.value + span * 0.12
  const x = (index: number) =>
    left +
    (values.length <= 1 ? plotW / 2 : (index / (values.length - 1)) * plotW)
  const y = (value: number) =>
    PAD.top + (1 - (value - lo) / (hi - lo || 1)) * plotH
  const points: [number, number][] = values.map((value, index) => [
    x(index),
    y(value),
  ])
  const tickStep = (hi - lo) / 2
  const ticks = [hi, (hi + lo) / 2, lo].map((tick) => roundTick(tick, tickStep))
  // 아래 날짜 — 칸이 많으면 7개쯤만.
  const step = Math.max(1, Math.ceil(values.length / 7))

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (values.length === 0 || plotW === 0) return
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - box.left - left) / plotW
    setHover(
      Math.min(
        values.length - 1,
        Math.max(0, Math.round(ratio * (values.length - 1))),
      ),
    )
  }

  const ready = width > 0 && height > 0 && values.length > 0

  return (
    <div
      ref={ref}
      className="glass_trend_chart"
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      {ready && (
        <>
          {/* 뒤 — 눈금·날짜 */}
          <svg
            className="glass_trend_grid"
            width={width}
            height={height}
            aria-hidden="true"
          >
            {ticks.map((tick, index) => (
              <g key={index}>
                <line
                  x1={left}
                  x2={width - PAD.right}
                  y1={y(tick)}
                  y2={y(tick)}
                />
                <text x={left - 10} y={y(tick)} dy="0.35em" textAnchor="end">
                  {tickText(tick)}
                </text>
              </g>
            ))}
            {labels.map((label, index) =>
              index % step === 0 || index === labels.length - 1 ? (
                <text
                  key={index}
                  className="glass_trend_xlabel"
                  x={x(index)}
                  y={height - 8}
                  textAnchor={
                    index === 0
                      ? 'start'
                      : index === labels.length - 1
                        ? 'end'
                        : 'middle'
                  }
                >
                  {label}
                </text>
              ) : null,
            )}
          </svg>

          {/* 선·면 */}
          <div className="glass_trend_line">
            <GlassLine points={points} width={width} height={height} />
          </div>

          {/* 앞 — 평균·추세·이동평균·최고/최저·마우스 */}
          <svg
            className="glass_trend_marks"
            width={width}
            height={height}
            aria-hidden="true"
          >
            <line
              className="glass_trend_mean"
              x1={left}
              x2={width - PAD.right}
              y1={y(stats.mean)}
              y2={y(stats.mean)}
            />
            <text
              className="glass_trend_mark_label"
              x={width - PAD.right}
              y={y(stats.mean) - 6}
              textAnchor="end"
            >
              평균 {format(stats.mean)}
            </text>
            {values.length >= 2 && (
              <line
                className="glass_trend_fit"
                x1={x(0)}
                x2={x(values.length - 1)}
                y1={y(stats.trendLine[0])}
                y2={y(stats.trendLine[1])}
              />
            )}
            {stats.moving && (
              <path
                className="glass_trend_moving"
                d={smoothPath(
                  stats.moving.values.map((value, index) => [
                    x(index),
                    y(value),
                  ]),
                )}
              />
            )}
            {[
              { ...max, kind: 'max' as const },
              { ...min, kind: 'min' as const },
            ].map((mark) =>
              span === 0 && mark.kind === 'min' ? null : (
                <g
                  key={mark.kind}
                  className={`glass_trend_extreme is-${mark.kind}`}
                >
                  <circle cx={x(mark.index)} cy={y(mark.value)} r={5} />
                  <text
                    x={x(mark.index)}
                    // 양 끝 칸은 안쪽으로 붙인다(판 밖으로 잘리지 않게).
                    textAnchor={
                      x(mark.index) < left + 70
                        ? 'start'
                        : x(mark.index) > width - PAD.right - 70
                          ? 'end'
                          : 'middle'
                    }
                    // 최고는 점 위, 최저는 점 아래 — 그래프 위·아래 끝에 닿으면
                    // 반대쪽에(날짜 글자와 겹치지 않게).
                    y={
                      mark.kind === 'max'
                        ? y(mark.value) - 12 < PAD.top - 4
                          ? y(mark.value) + 20
                          : y(mark.value) - 12
                        : y(mark.value) + 20 > height - PAD.bottom - 4
                          ? y(mark.value) - 12
                          : y(mark.value) + 20
                    }
                  >
                    {mark.kind === 'max' ? '최고' : '최저'} {format(mark.value)}
                  </text>
                </g>
              ),
            )}
            {hover !== null && (
              <g className="glass_trend_hover">
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1={PAD.top}
                  y2={height - PAD.bottom}
                />
                <circle cx={x(hover)} cy={y(values[hover])} r={5.5} />
              </g>
            )}
          </svg>

          {hover !== null && (
            <div
              className="glass_trend_tip"
              style={{
                left: Math.min(Math.max(x(hover), 90), width - 90),
                top: Math.max(y(values[hover]) - 14, 8),
              }}
            >
              <span>{labels[hover]}</span>
              <strong>{format(values[hover])}</strong>
              <small>
                평균 대비{' '}
                {stats.mean === 0
                  ? '-'
                  : pctText(
                      ((values[hover] - stats.mean) / Math.abs(stats.mean)) *
                        100,
                    )}
              </small>
            </div>
          )}
        </>
      )}
      <div className="glass_trend_legend" style={{ left }} aria-hidden="true">
        <span className="is-line">값</span>
        <span className="is-mean">평균</span>
        <span className="is-fit">직선 추세</span>
        {stats.moving && (
          <span className="is-moving">{stats.moving.window}칸 이동평균</span>
        )}
      </div>
    </div>
  )
}
