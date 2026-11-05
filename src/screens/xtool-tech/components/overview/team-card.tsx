import { initialsOf } from '@/xtool-auth/use-xtool-session'
import type { TeamMemberStatus, WorkBoard } from '@xtool-core/team-status'
import { usePhotoOf } from '../../data/tech-profiles'
import { cx } from '@/ohq-ui/lib/cx'
import { Avatar } from '@/ohq-ui/components/avatar'
import { GlassCard } from '@/ohq-ui/components/glass-card'

const BOARD_SHORT: Record<WorkBoard, string> = {
  fieldService: '출장',
  repair: 'AS',
  techInquiry: '아톡',
  techTask: '기타',
}

/** 팀 현황 — 사람마다 진행 중(보드별)·오늘 방문·이번 주 처리. 나는 강조. */
export function TeamCard({ members, me, loading }: { members: TeamMemberStatus[]; me: ReadonlySet<string>; loading: boolean }) {
  const max = Math.max(1, ...members.map((m) => m.openTotal))
  const photoOf = usePhotoOf()
  return (
    <GlassCard
      title="팀 현황"
      subtitle={loading ? '불러오는 중…' : `${members.length}명`}
    >
      {!loading && members.length === 0 ? (
        <p className="bar-list__empty">보일 기술팀원이 없어요.</p>
      ) : (
        <ul className="team-grid">
          {members.map((m) => (
            <li key={m.name} className={cx('team-member', me.has(m.name) && 'is-me')}>
              <div className="team-member__head">
                <Avatar initials={initialsOf(m.name, m.name)} color={me.has(m.name) ? 'var(--accent)' : 'rgba(255, 255, 255, 0.14)'} ink={me.has(m.name) ? 'var(--accent-ink)' : undefined} photo={photoOf(m.name)} />
                <div className="team-member__name">
                  <strong>{m.name}</strong>
                  {me.has(m.name) && <span>나</span>}
                </div>
              </div>
              <div className="team-member__load">
                <span className="team-member__open">
                  진행 중 <strong>{m.openTotal}</strong>
                </span>
                <span className="king-rank__bar" aria-hidden>
                  <span style={{ width: `${(m.openTotal / max) * 100}%` }} />
                </span>
              </div>
              <p className="team-member__boards">
                {(Object.keys(BOARD_SHORT) as WorkBoard[])
                  .filter((b) => m.open[b] > 0)
                  .map((b) => `${BOARD_SHORT[b]} ${m.open[b]}`)
                  .join(' · ') || '진행 중인 건 없음'}
              </p>
              <dl className="team-member__stats">
                <div>
                  <dt>오늘 방문</dt>
                  <dd className={m.visitsToday ? 'is-on' : undefined}>{m.visitsToday}</dd>
                </div>
                <div>
                  <dt>이번 주 처리</dt>
                  <dd>{m.doneThisWeek}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  )
}
