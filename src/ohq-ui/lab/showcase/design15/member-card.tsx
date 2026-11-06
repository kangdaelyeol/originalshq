import { cx } from '../../../lib/cx'
import { Avatar } from './avatar'
import type { D15Member } from './design15-data'

interface MemberCardProps {
  member: D15Member
  onMessage?: () => void
  onProfile?: () => void
}

/**
 * 팀 카드(F358 113×147px) — 머리글자(상태 점)·이름·역할·부서 꼬리표·열린 일/끝낸 일·일 부담 막대·Message/Profile.
 * 일 부담이 85% 넘으면 막대가 호박색(Mateo 88%).
 */
export function MemberCard({ member, onMessage, onProfile }: MemberCardProps) {
  return (
    <article className="d15-card d15-member" data-member={member.id}>
      <Avatar initials={member.initials} size="lg" presence={member.presence} />
      <h3 className="d15-member__name">{member.name}</h3>
      <p className="d15-member__role">{member.role}</p>
      <span className="d15-member__dept">{member.dept}</span>
      <dl className="d15-member__stats">
        <div>
          <dt>Open tasks</dt>
          <dd>{member.open}</dd>
        </div>
        <div>
          <dt>Completed</dt>
          <dd>{member.completed}</dd>
        </div>
      </dl>
      <div className="d15-member__load">
        <span>Workload</span>
        <span>{member.workload}%</span>
      </div>
      <span className={cx('d15-member__bar', member.workload >= 85 && 'is-high')}>
        <i style={{ width: `${member.workload}%` }} />
      </span>
      <div className="d15-member__actions">
        <button type="button" className="d15-btn d15-btn--ghost d15-btn--sm" onClick={onMessage}>
          Message
        </button>
        <button
          type="button"
          className="d15-btn d15-btn--solid d15-btn--sm"
          onClick={onProfile}
          data-tour={`profile-${member.id}`}
        >
          Profile
        </button>
      </div>
    </article>
  )
}
