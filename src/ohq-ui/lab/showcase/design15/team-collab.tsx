import { Plus } from 'lucide-react'
import { cx } from '../../../lib/cx'
import { Avatar } from './avatar'
import { cssVars } from './d15-format'
import { memberByInitials, type D15CollabStatus } from './design15-data'

interface TeamCollabProps {
  rows: readonly { member: string; task: string; status: D15CollabStatus }[]
  onAdd?: () => void
  index?: number
}

const STATUS_CLASS: Record<D15CollabStatus, string> = {
  Completed: 'is-done',
  'In Progress': 'is-doing',
  Pending: 'is-pending',
}

/** Team Collaboration(F205 x171~365) — 머리글자·이름·"Working on 굵은 일"·상태 꼬리표(완료는 강조색, F899 보라) */
export function TeamCollab({ rows, onAdd, index = 8 }: TeamCollabProps) {
  return (
    <section className="d15-card d15-collab d15-rise" style={cssVars({ '--i': index })}>
      <header className="d15-card__head">
        <h3 className="d15-card__title">Team Collaboration</h3>
        <button type="button" className="d15-btn d15-btn--ghost d15-btn--xs" onClick={onAdd}>
          <Plus aria-hidden strokeWidth={2.4} />
          Add Member
        </button>
      </header>
      <ul className="d15-collab__list">
        {rows.map((row) => (
          <li key={row.member} className="d15-collab__row">
            <Avatar initials={row.member} size="md" />
            <span className="d15-collab__who">
              <b>{memberByInitials(row.member)?.name ?? row.member}</b>
              <span>
                Working on <strong>{row.task}</strong>
              </span>
            </span>
            <span className={cx('d15-tag', STATUS_CLASS[row.status])}>{row.status}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
