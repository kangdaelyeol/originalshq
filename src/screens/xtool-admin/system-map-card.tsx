import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { watchMembers, type XtoolMember } from '@xtool-core/members'
import type { BrainMapData, SeatStatus } from '@/ohq-ui/lab/showcase/design14/brain-map'
import { BrainScene } from '@/ohq-ui/lab/showcase/design14/brain-scene'
import { GlassCard, SegmentedControl } from '@/screens/xtool-tech/components/basic-parts'
import { firestoreErrorMessage } from './errors'
import type { MemberFilter } from './members-table'
import { buildSystemMap, systemFilter, systemRule } from './system-map-data'
import '@/ohq-ui/lab/styles/showcase/design14-map.scss'
import './system-map.scss'

type View = 'map' | 'list'

const VIEWS = [
  { value: 'map' as const, label: '지도' },
  { value: 'list' as const, label: '목록' },
]

// 폰 폭 — 지도 글자가 너무 작아져서 목록으로만 보인다
const NARROW = '(max-width: 640px)'
const subscribeNarrow = (cb: () => void) => {
  const mq = matchMedia(NARROW)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const useNarrow = () =>
  useSyncExternalStore(
    subscribeNarrow,
    () => matchMedia(NARROW).matches,
    () => false,
  )

interface SystemMapCardProps {
  /** 지금 로그인한 관리자 — 지도의 YOU */
  self: XtoolMember
  /** 자리를 누르면 — 구성원 탭에서 그 사람 줄 */
  onOpenMember: (email: string) => void
  /** +N을 누르면 — 구성원 탭을 그 허브의 필터로 */
  onOpenGroup: (filter: MemberFilter) => void
}

/**
 * 시스템 지도 — xtool 계정 하나로 들어가는 화면(허브)과 들어갈 수 있는 사람(자리)을 D14 두뇌 지도로. 구성원은 실시간.
 * 폰 폭이면 목록으로만, 그보다 넓으면 지도·목록을 고른다.
 */
export default function SystemMapCard({ self, onOpenMember, onOpenGroup }: SystemMapCardProps) {
  const [members, setMembers] = useState<XtoolMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<View>('map')
  const narrow = useNarrow()
  const view: View = narrow ? 'list' : picked
  // "3시간 전"·최근 7일 경계가 흐르게 — 1분마다
  const [now, setNow] = useState(() => Date.now())

  useEffect(
    () =>
      watchMembers(
        (list) => {
          setMembers(list)
          setError(null)
        },
        (e) => setError(firestoreErrorMessage(e)),
      ),
    [],
  )

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const map = useMemo(() => (members ? buildSystemMap(members, self, now) : null), [members, self, now])
  const people = members?.length ?? 0

  return (
    <GlassCard
      title="시스템 지도"
      subtitle={
        map
          ? `xtool 계정 ${people}명이 들어갈 수 있는 화면 — 사람 × 시스템 권한, 실시간`
          : error
            ? '구성원을 불러오지 못했어요'
            : '불러오는 중…'
      }
      actions={
        !narrow && (
          <SegmentedControl ariaLabel="보기 방식" size="sm" options={VIEWS} value={picked} onChange={setPicked} />
        )
      }
      className="system-map"
    >
      {error && (
        <p className="member-form__result member-form__result--crit" role="alert">
          {error}
        </p>
      )}
      {map && view === 'map' && (
        <div className="system-map__stage d14-theme">
          <BrainScene
            map={map}
            className="system-map__scene"
            onSeatSelect={(hubId, slot) => {
              if (slot.kind === 'seat' && slot.seat?.id) onOpenMember(slot.seat.id)
              else if (slot.kind === 'more') onOpenGroup(systemFilter(hubId))
              return true
            }}
          />
        </div>
      )}
      {map && view === 'list' && <SystemList map={map} onOpenMember={onOpenMember} />}
    </GlassCard>
  )
}

/** 목록 보기 — 같은 데이터를 허브마다 사람 줄로(폰 폭·스크린 리더). 판은 지도와 같은 어두운 별 판 색 */
function SystemList({ map, onOpenMember }: { map: BrainMapData; onOpenMember: (email: string) => void }) {
  const counts = map.hint.counts ?? {}
  return (
    <div className="system-map__stage system-map__stage--list d14-theme">
      <p className="d14-hint system-map-list__legend">
        {map.statusOrder.map((s: SeatStatus) => (
          <span key={s} className="d14-hint__item" data-status={s}>
            <i aria-hidden="true" />
            {map.statusText[s]}
            <b className="d14-hint__count">{counts[s] ?? 0}</b>
            <span className="d14-hint__sep" aria-hidden="true">
              {' · '}
            </span>
          </span>
        ))}
      </p>
      <div className="system-map-list">
        {map.hubs.map((hub) => (
          <section key={hub.id} className="system-map-list__hub" aria-label={`${hub.name} ${hub.seats.length}명`}>
            <header className="system-map-list__head">
              <span className="system-map-list__ring" aria-hidden="true">
                {hub.seats.length}
              </span>
              <div className="system-map-list__title">
                <strong>{hub.name}</strong>
                <span>{hub.sub}</span>
              </div>
            </header>
            <p className="system-map-list__rule">{systemRule(hub.id)}</p>
            {hub.seats.length === 0 ? (
              <p className="system-map-list__empty">{map.empty?.name ?? '아직 없음'}</p>
            ) : (
              <ul className="system-map-list__people">
                {hub.seats.map((seat) => (
                  <li key={seat.id ?? seat.name}>
                    <button
                      type="button"
                      className="system-map-list__person"
                      data-status={seat.status}
                      onClick={() => seat.id && onOpenMember(seat.id)}
                    >
                      <i className="system-map-list__dot" aria-hidden="true" />
                      <span className="system-map-list__name">{seat.name}</span>
                      <span className="system-map-list__note">{seat.note ?? map.statusText[seat.status]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
