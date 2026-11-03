import { ChevronUp } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState, type CSSProperties } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { buildWorkPeople } from '../../data/my-work'
import { useMyIdentity, useWorkSources } from '../../data/use-my-work'
import { cx } from '../../lib/cx'
import { koreaToday } from '../../lib/dates'
import type { NavItem } from '../../nav'
import { MY_WORK_PATH, myWorkPath } from '../../paths'

// 사람 구분용 장식 색 — 이름으로 정해져서 어느 화면에서 봐도 같은 사람은 같은 색. 나는 강조색.
const PERSON_COLORS = ['#3a9ae6', '#de6a30', '#1fa878', '#9a7cf2', '#eda12a', '#e5609a', '#38b6c4', '#b8c24a']
const colorOf = (name: string) => {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PERSON_COLORS[h % PERSON_COLORS.length]
}

// Design 8 하위 메뉴와 같은 곡선(0.33, 1, 0.68, 1) — 높이와 갈매기가 함께 움직인다
const EASE = [0.33, 1, 0.68, 1] as const

/**
 * 내 업무 메뉴 — 누르면 내 업무로 가며 아래로 직원 목록이 펼쳐진다(Design 8 SidebarSubList처럼
 * 아이콘 밑 줄기에서 둥글게 꺾인 가지 + 색 점 + 이름). 오른쪽 갈매기는 목록만 접고 편다.
 * 사이드바를 접으면 목록은 숨는다.
 */
export function SidebarPeopleItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { pathname } = useLocation()
  const onMyWork = pathname.startsWith(MY_WORK_PATH)
  const [open, setOpen] = useState(onMyWork)
  // 다른 곳(개요 카드 등)에서 내 업무로 들어와도 목록을 편다 — 렌더 중에 이전 값과 비교
  const [wasOnMyWork, setWasOnMyWork] = useState(onMyWork)
  if (onMyWork !== wasOnMyWork) {
    setWasOnMyWork(onMyWork)
    if (onMyWork) setOpen(true)
  }
  const shown = open && !collapsed
  const Icon = item.icon

  return (
    <li className={cx('nav-people', shown && 'is-open')}>
      <div className="nav-people__row">
        <NavLink
          to={item.to}
          title={item.label}
          className={({ isActive }) => cx('nav-item', isActive && 'is-active')}
          onClick={() => setOpen(true)}
        >
          <Icon size={16} strokeWidth={2} className="nav-item__icon" aria-hidden />
          <span className="nav-item__label">{item.label}</span>
        </NavLink>
        <button
          type="button"
          className="nav-people__caret"
          aria-expanded={shown}
          aria-label={`직원 목록 ${shown ? '접기' : '펼치기'}`}
          onClick={() => setOpen((v) => !v)}
        >
          <motion.span
            className="nav-people__caret-icon"
            initial={false}
            animate={{ rotate: shown ? 0 : 180 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <ChevronUp size={14} strokeWidth={2.2} aria-hidden />
          </motion.span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {shown && (
          <motion.div
            key="people"
            className="nav-sub"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <PeopleList />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

/** 직원 목록 — 펼쳤을 때만 그려서, 닫혀 있으면 보드를 구독하지 않는다. 나는 맨 위. */
function PeopleList() {
  const { pathname, search } = useLocation()
  const me = useMyIdentity()
  const { sources, loading } = useWorkSources()
  const today = koreaToday()
  const people = useMemo(() => buildWorkPeople(sources, today), [sources, today])

  const who = pathname.startsWith(MY_WORK_PATH) ? new URLSearchParams(search).get('who') : undefined
  const viewingMe = who === null || (!!who && me.names.has(who))
  const myOpen = people.filter((p) => me.names.has(p.name)).reduce((sum, p) => sum + p.open, 0)
  const others = people.filter((p) => !me.names.has(p.name))

  return (
    <>
      <span className="nav-sub__trunk" aria-hidden />
      <ul className="nav-sub__list" aria-label="직원별 업무">
        <PersonRow to={myWorkPath()} label={me.name ? `나 · ${me.name}` : '나'} color="var(--accent)" count={myOpen} active={viewingMe} />
        {others.map((p) => (
          <PersonRow key={p.name} to={myWorkPath(p.name)} label={p.name} color={colorOf(p.name)} count={p.open} active={who === p.name} />
        ))}
        {loading && others.length === 0 && <li className="nav-sub__note">불러오는 중…</li>}
      </ul>
    </>
  )
}

function PersonRow({ to, label, color, count, active }: { to: string; label: string; color: string; count: number; active: boolean }) {
  return (
    <li>
      <Link
        to={to}
        className={cx('nav-sub__btn', active && 'is-active')}
        aria-current={active ? 'page' : undefined}
        title={`${label} — 진행 중 ${count}건`}
      >
        <span className="nav-sub__branch" aria-hidden />
        <span className="nav-sub__dot" style={{ '--dot': color } as CSSProperties} aria-hidden />
        <span className="nav-sub__label">{label}</span>
        {count > 0 && <span className="nav-sub__count">{count}</span>}
      </Link>
    </li>
  )
}
