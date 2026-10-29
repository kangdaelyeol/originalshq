import './stacked-bars.scss'
import { Fragment, type CSSProperties, type ReactNode } from 'react'

/** 쌓는 조각 하나의 종류 — 이름과 색(CSS 값, 보통 var(--…)). */
export interface StackSegment {
  key: string
  label: string
  color: string
}

export interface StackRow {
  key: string
  label: ReactNode
  /** 이름이 줄여져 있을 때 전체 이름(마우스를 올리면). */
  title?: string
  values: Record<string, number>
  total: number
  /** 합계 옆에 덧붙이는 칸(진행 중·비율 등) — 한 줄이라도 있으면 칸이 생긴다. */
  aside?: ReactNode
  /** 줄을 눌러 펼치는 내용 — 있으면 줄이 눌린다(onToggle). */
  detail?: ReactNode
  open?: boolean
  onToggle?: () => void
}

const percent = (count: number, total: number) =>
  total === 0 ? '0%' : `${((count / total) * 100).toFixed(1)}%`

/** 조각들 — 0인 조각은 그리지 않는다. 조각마다 마우스를 올리면 이름·건수·비율. */
const Segments = ({
  segments,
  row,
  showCounts = false,
}: {
  segments: StackSegment[]
  row: Pick<StackRow, 'values' | 'total'> & { name: string }
  /** 조각 안에 건수를 적을지(넓은 요약 띠) — 좁은 조각에는 안 적는다. */
  showCounts?: boolean
}) => (
  <>
    {segments.map((segment) => {
      const value = row.values[segment.key] ?? 0
      if (value === 0) return null
      const width = (value / row.total) * 100
      return (
        <span
          key={segment.key}
          className="glass_stack_seg"
          style={{ flexGrow: value, '--seg': segment.color } as CSSProperties}
        >
          {showCounts && width >= 6 && (
            <span className="glass_stack_seg_count">{value}</span>
          )}
          <span className="glass_stack_tip">
            {row.name} · {segment.label} <strong>{value}건</strong> (
            {percent(value, row.total)})
          </span>
        </span>
      )
    })}
  </>
)

/**
 * 쌓은 가로 막대 — 맨 위에 전체 구성(100% 띠 + 범례), 그 아래 줄마다 막대.
 * 줄 막대의 길이는 그 줄의 합계(가장 큰 줄 = 가득), 조각은 종류별 건수.
 * 순서가 있는 종류(단계 등)는 부르는 쪽이 한 색의 옅은→진한 색을 준다.
 */
export const StackedBars = ({
  segments,
  rows,
  sum,
  sumLabel,
}: {
  segments: StackSegment[]
  rows: StackRow[]
  /** 전체 합 — 맨 위 띠와 범례의 건수. */
  sum: Pick<StackRow, 'values' | 'total'>
  sumLabel: string
}) => {
  const max = Math.max(1, ...rows.map((row) => row.total))
  const hasAside = rows.some((row) => row.aside !== undefined)

  return (
    <div className="glass_stack">
      <div className="glass_stack_summary">
        <div className="glass_stack_bar is-summary">
          <Segments
            segments={segments}
            row={{ ...sum, name: sumLabel }}
            showCounts
          />
        </div>
        <ul className="glass_stack_legend">
          {segments.map((segment) => (
            <li key={segment.key}>
              <span
                className="glass_stack_swatch"
                style={{ '--seg': segment.color } as CSSProperties}
                aria-hidden="true"
              />
              {segment.label}
              <strong>
                {(sum.values[segment.key] ?? 0).toLocaleString('ko-KR')}
              </strong>
              <small>{percent(sum.values[segment.key] ?? 0, sum.total)}</small>
            </li>
          ))}
        </ul>
      </div>

      <ol className="glass_stack_rows">
        {rows.map((row, index) => {
          const clickable = Boolean(row.detail && row.onToggle)
          return (
            <Fragment key={row.key}>
              <li
                className={[
                  'glass_stack_row',
                  hasAside ? 'has-aside' : '',
                  clickable ? 'is-clickable' : '',
                  row.open ? 'is-open' : '',
                ]
                  .join(' ')
                  .trim()}
                // 처음 그릴 때 줄마다 조금씩 늦게(요약 띠 다음부터).
                style={{ '--glass-i': index + 1 } as CSSProperties}
                {...(clickable && {
                  role: 'button',
                  tabIndex: 0,
                  'aria-expanded': Boolean(row.open),
                  onClick: row.onToggle,
                  onKeyDown: (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      row.onToggle?.()
                    }
                  },
                })}
              >
                <span className="glass_stack_name" title={row.title}>
                  {clickable && (
                    <span className="glass_stack_caret" aria-hidden="true">
                      {row.open ? '▾' : '▸'}
                    </span>
                  )}
                  {row.label}
                </span>
                <span className="glass_stack_track">
                  {row.total > 0 && (
                    <span
                      className="glass_stack_bar"
                      style={{ width: `${(row.total / max) * 100}%` }}
                    >
                      <Segments
                        segments={segments}
                        row={{ ...row, name: row.title ?? String(row.label) }}
                      />
                    </span>
                  )}
                </span>
                <span className="glass_stack_total">
                  {row.total.toLocaleString('ko-KR')}
                  <small>건</small>
                </span>
                {hasAside && (
                  <span className="glass_stack_aside">{row.aside}</span>
                )}
              </li>
              {row.open && row.detail && (
                <li className="glass_stack_detail">{row.detail}</li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </div>
  )
}
