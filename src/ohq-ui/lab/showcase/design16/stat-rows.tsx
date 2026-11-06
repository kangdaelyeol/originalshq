import { cx } from '../../../lib/cx'

interface StatRowsProps {
  rows: readonly { label: string; value: string }[]
  className?: string
}

/** 라벨 ↔ 값 줄들(목표 카드 11.8px 간격 · 라이브 카드 11.7px) */
export function StatRows({ rows, className }: StatRowsProps) {
  return (
    <dl className={cx('d16-rows', className)}>
      {rows.map((row) => (
        <div key={row.label} className="d16-rows__row">
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}
