import type { CSSProperties } from 'react'
import { initialsOf } from '@/xtool-auth/use-xtool-session'
import { cx } from '@/ohq-ui/lib/cx'
import { WaterBar } from '@/ohq-ui/water/charts/water-bar'
import { WaterCard } from '@/ohq-ui/water/surfaces/water-card'
import { WaterEmpty } from '@/ohq-ui/water/surfaces/water-empty'
import { WaterSkeletonBlock } from '@/ohq-ui/water/surfaces/water-skeleton'
import type { TeamMemberStatus, WorkBoard } from '../../../data/team-status'
import { usePhotoOf } from '../../../data/tech-profiles'

const BOARD_SHORT: Record<WorkBoard, string> = {
  fieldService: '출장',
  repair: 'AS',
  techInquiry: '아톡',
  techTask: '기타',
  records: '자료',
}

/** 사람 동그라미 — 불투명 유리 단추(D7) 속 이니셜, 나는 어두운 표시 알약 속 흰 이니셜. 사진이 있으면 사진 */
function Face({ name, me, photo }: { name: string; me: boolean; photo?: string }) {
  return (
    <span className={cx('water-team__face', me && 'is-me', photo && 'has-photo')} aria-hidden>
      {photo ? <img src={photo} alt="" /> : initialsOf(name, name)}
    </span>
  )
}

/**
 * 팀 현황(D7) — TeamCard와 같은 props. 사람마다 테두리만 있는 유리 판(판 안의 판) — 진행 중(보드별)·오늘 방문·
 * 이번 주 처리, 진행 중 막대는 홈 안의 어두운 알약(사람 차례대로 21ms 간격 extend 스프링). 나는 이름 옆 어두운
 * "나" 칩과 어두운 동그라미. 불러오는 동안은 빈 홈 판 + 유리 위 빛.
 */
export function WaterTeamCard({
  members,
  me,
  loading,
}: {
  members: TeamMemberStatus[]
  me: ReadonlySet<string>
  loading: boolean
}) {
  const max = Math.max(1, ...members.map((m) => m.openTotal))
  const photoOf = usePhotoOf()
  const waiting = loading && members.length === 0
  return (
    <WaterCard title="팀 현황" subtitle={loading ? '불러오는 중…' : `${members.length}명`} busy={waiting}>
      {waiting ? (
        <ul className="water-team" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="water-team__member">
              <div className="water-team__head">
                <WaterSkeletonBlock shape="circle" width={30} height={30} />
                <WaterSkeletonBlock width={[64, 52, 72][i]} />
              </div>
              <WaterSkeletonBlock width="100%" />
              <WaterSkeletonBlock width="60%" />
            </li>
          ))}
        </ul>
      ) : members.length === 0 ? (
        <WaterEmpty title="최근 담당자로 나온 사람이 없어요." />
      ) : (
        <ul className="water-team">
          {members.map((m, i) => {
            const mine = me.has(m.name)
            return (
              <li
                key={m.name}
                className={cx('water-team__member', 'water-reveal', mine && 'is-me')}
                style={{ '--w-i': i } as CSSProperties}
              >
                <div className="water-team__head">
                  <Face name={m.name} me={mine} photo={photoOf(m.name)} />
                  <div className="water-team__name">
                    <strong>{m.name}</strong>
                    {mine && <span>나</span>}
                  </div>
                </div>
                <div className="water-team__load">
                  <span className="water-team__open">
                    진행 중 <strong>{m.openTotal}</strong>
                  </span>
                  <WaterBar value={m.openTotal / max} index={i} size="sm" />
                </div>
                <p className="water-team__boards">
                  {(Object.keys(BOARD_SHORT) as WorkBoard[])
                    .filter((b) => m.open[b] > 0)
                    .map((b) => `${BOARD_SHORT[b]} ${m.open[b]}`)
                    .join(' · ') || '진행 중인 건 없음'}
                </p>
                <dl className="water-team__stats">
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
            )
          })}
        </ul>
      )}
    </WaterCard>
  )
}
