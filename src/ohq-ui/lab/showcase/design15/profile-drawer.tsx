import { MapPin, Plus, Users, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { cx } from '../../../lib/cx'
import { Avatar } from './avatar'
import { DRAWER_OUT_MS } from './d15-motion'
import { STAGE_STATUS, type D15Member, type D15Task } from './design15-data'

interface ProfileDrawerProps {
  member: D15Member
  /** 그 사람이 맡은 일(할 일 카드의 사람 목록에서) */
  tasks: readonly D15Task[]
  /** 닫힘 움직임이 끝난 뒤 */
  onClosed: () => void
}

/**
 * 프로필 서랍(F420: 창 오른쪽 x497~657) — 막이 0.2초에 어두워지고(0.31) 판이 오른쪽에서 ease-out 0.28초에
 * 들어온다(F397~F406). 닫을 때는 ease-in 0.23초에 나간다(F438.5~F445).
 */
export function ProfileDrawer({ member, tasks, onClosed }: ProfileDrawerProps) {
  const id = useId()
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!leaving) return
    const t = window.setTimeout(onClosed, DRAWER_OUT_MS)
    return () => window.clearTimeout(t)
  }, [leaving, onClosed])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLeaving(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className={cx('d15-scrim is-drawer', leaving && 'is-out')}
      onPointerDown={(e) => e.target === e.currentTarget && setLeaving(true)}
    >
      <aside className="d15-drawer" role="dialog" aria-modal="true" aria-labelledby={`${id}-n`}>
        <button
          type="button"
          className="d15-drawer__close"
          aria-label="Close"
          onClick={() => setLeaving(true)}
          data-tour="drawer-close"
        >
          <X aria-hidden strokeWidth={2.2} />
        </button>
        <Avatar initials={member.initials} size="xl" />
        <h3 id={`${id}-n`} className="d15-drawer__name">
          {member.name}
        </h3>
        <p className="d15-drawer__role">{member.role}</p>
        <p className="d15-drawer__meta">
          <span>
            <MapPin aria-hidden strokeWidth={2} />
            {member.location}
          </span>
          <span>
            <Users aria-hidden strokeWidth={2} />
            {member.dept}
          </span>
          <span className={cx('d15-drawer__presence', `is-${member.presence}`)}>
            <i />
            {member.presence === 'online' ? 'Online' : member.presence === 'away' ? 'Away' : 'Offline'}
          </span>
        </p>
        <dl className="d15-drawer__stats">
          <div>
            <dd>{member.open}</dd>
            <dt>Open</dt>
          </div>
          <div>
            <dd>{member.completed}</dd>
            <dt>Done</dt>
          </div>
          <div>
            <dd>{member.workload}%</dd>
            <dt>Load</dt>
          </div>
        </dl>
        <h4 className="d15-drawer__section">Assigned tasks</h4>
        <ul className="d15-drawer__tasks">
          {tasks.slice(0, 4).map((t) => (
            <li key={t.id}>
              <i className={cx('d15-drawer__dot', t.stage === 'done' ? 'is-done' : 'is-doing')} />
              <span>{t.title}</span>
              <em>{STAGE_STATUS[t.stage]}</em>
            </li>
          ))}
          {tasks.length === 0 && <li className="is-empty">Nothing assigned yet</li>}
        </ul>
        <div className="d15-drawer__actions">
          <button type="button" className="d15-btn d15-btn--ghost">
            Message
          </button>
          <button type="button" className="d15-btn d15-btn--solid">
            <Plus aria-hidden strokeWidth={2.4} />
            Assign task
          </button>
        </div>
      </aside>
    </div>
  )
}
