import './trend-list.scss'
import type { CSSProperties, ReactNode } from 'react'
import { GlassLine } from './glass-line'
import { useElementSize } from './use-element-size'

/** 추이 목록의 한 줄 — 무엇을 그릴지(series)와 칸마다 적을 글자를 부르는
 * 쪽이 정한다(보드별 인입, 담당자별 처리 수·전환 등). */
export interface TrendListRow {
  key: string
  name: string
  /** 이름이 줄여져 있을 때 전체 이름. */
  title?: string
  /** 기간 칸마다의 값(오래된 것부터) — 작은 그래프의 높이. */
  series: number[]
  /** 기간 칸마다 툴팁에 적을 값("8건", "57.1%"). */
  seriesText: string[]
  /** 합계 칸. */
  value: ReactNode
  /** 막대 칸 — 길이(0~1)와 옆 글자. */
  bar: { ratio: number; text: string }
  /** 가장 큰 칸 — 그래프의 점과 마지막 칸. */
  peak: { index: number; text: ReactNode } | null
  /** 읽어 주는 요약. */
  ariaLabel: string
}

export interface TrendListColumns {
  name: string
  value: string
  bar: string
  peak: string
}

/**
 * 한 줄의 작은 추이 그래프 — 유리 선(GlassLine)과 아래로 옅어지는 면. 높이는 그 줄의
 * 최댓값 기준이라(줄끼리 크기는 합계·막대 칸이 보여준다) 작은 줄도 모양이
 * 보인다. 가장 큰 칸에 점을 찍고, 칸마다 마우스를 올리면 그 칸의 값.
 */
const Sparkline = ({
  row,
  labels,
}: {
  row: TrendListRow
  labels: string[]
}) => {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>()
  const count = row.series.length
  const top = Math.max(...row.series, 0) || 1
  // 점·마우스 칸은 %로(HTML), 선은 상자의 실제 px로 그린다.
  const xOf = (index: number) => ((index + 0.5) / count) * 100
  // 위아래 12%씩 비워 굵은 선과 빛이 상자 끝에 닿지 않게.
  const yOf = (value: number) => 88 - (value / top) * 76

  return (
    <div ref={ref} className="glass_trend_list_spark">
      <GlassLine
        weight="sm"
        width={width}
        height={height}
        points={row.series.map((value, index) => [
          (xOf(index) / 100) * width,
          (yOf(value) / 100) * height,
        ])}
      />
      {row.peak && (
        <span
          className="glass_trend_list_peak"
          style={{
            left: `${xOf(row.peak.index)}%`,
            top: `${yOf(row.series[row.peak.index])}%`,
          }}
          aria-hidden="true"
        />
      )}
      <div className="glass_trend_list_cols">
        {row.series.map((value, index) => (
          <span
            key={labels[index]}
            className={`glass_trend_list_col${index > count * 0.6 ? ' to_left' : ''}`}
          >
            <span
              className="glass_trend_list_dot"
              style={{ top: `${yOf(value)}%` }}
            />
            <span className="glass_trend_list_tip">
              {labels[index]} · <strong>{row.seriesText[index]}</strong>
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

const Row = ({
  row,
  labels,
  rank,
  order,
  warn = false,
}: {
  row: TrendListRow
  labels: string[]
  /** 화면에서의 순서(0부터) — 처음 그릴 때 줄마다 조금씩 늦게. */
  order: number
  /** 순위(1부터) — 아래 따로 둔 줄(오기입 등)은 없음. */
  rank?: number
  warn?: boolean
}) => (
  <li
    className={`glass_trend_list_row${warn ? ' is-warn' : ''}`}
    style={{ '--glass-i': order } as CSSProperties}
    aria-label={row.ariaLabel}
  >
    <span
      className={`glass_trend_list_rank${rank !== undefined && rank <= 3 ? ' is-top' : ''}`}
      aria-hidden="true"
    >
      {rank ?? '!'}
    </span>
    <span className="glass_trend_list_name" title={row.title ?? row.name}>
      {row.name}
    </span>
    <Sparkline row={row} labels={labels} />
    <span className="glass_trend_list_total">{row.value}</span>
    <span className="glass_trend_list_share">
      <span className="glass_trend_list_share_track" aria-hidden="true">
        <span
          className="glass_trend_list_share_fill"
          style={{ width: `${row.bar.ratio * 100}%` }}
        />
      </span>
      <span className="glass_trend_list_share_text">{row.bar.text}</span>
    </span>
    <span className="glass_trend_list_best">
      {row.peak ? row.peak.text : '-'}
    </span>
  </li>
)

/**
 * 추이 목록 — 기간 × 무엇(보드·담당자) 표를 "무엇" 쪽으로 돌려, 한 줄에
 * 순위·이름·작은 추이 그래프·합계·막대·가장 큰 칸을 둔다. 기간이 길어도 줄
 * 수는 그대로다. extra는 맨 아래 선 뒤에 경고색으로 따로 두는 줄(오기입 등).
 */
export const TrendList = ({
  rows,
  extra,
  labels,
  columns,
  empty = '이 기간에 기록이 없습니다.',
  wideName = false,
}: {
  rows: TrendListRow[]
  extra?: TrendListRow[]
  /** 기간 칸의 이름(툴팁) — series와 같은 순서. */
  labels: string[]
  columns: TrendListColumns
  empty?: string
  /** 이름이 긴 항목(제품명 등) — 이름 칸을 넓힌다. */
  wideName?: boolean
}) =>
  rows.length === 0 ? (
    <p className="glass_trend_list_empty">{empty}</p>
  ) : (
    <div className={`glass_trend_list${wideName ? ' is-wide-name' : ''}`}>
      <div className="glass_trend_list_head" aria-hidden="true">
        <span />
        <span>{columns.name}</span>
        <span>추이</span>
        <span>{columns.value}</span>
        <span>{columns.bar}</span>
        <span>{columns.peak}</span>
      </div>
      <ol className="glass_trend_list_rows">
        {rows.map((row, index) => (
          <Row
            key={row.key}
            row={row}
            labels={labels}
            rank={index + 1}
            order={index}
          />
        ))}
      </ol>
      {extra && extra.length > 0 && (
        <ul className="glass_trend_list_rows glass_trend_list_extra">
          {extra.map((row, index) => (
            <Row
              key={row.key}
              row={row}
              labels={labels}
              order={rows.length + index}
              warn
            />
          ))}
        </ul>
      )}
    </div>
  )
