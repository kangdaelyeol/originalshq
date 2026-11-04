import { ChevronLeft, ChevronUp, LogOut, ShieldCheck } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { signOutXtool } from '@/xtool-auth/auth-actions'
import type { XtoolMember } from '@/xtool-auth/members'
import { initialsOf } from '@/xtool-auth/use-xtool-session'
import { XMark } from '@/ohq-ui/brand/brand-mark'
import { cx } from '@/ohq-ui/lib/cx'
import { WaterAvatar } from '@/ohq-ui/water/controls'
import { useReducedMotion, useWaterIndicator, useWaterRipple } from '@/ohq-ui/water/hooks'
import type { IndicatorPose } from '@/ohq-ui/water/indicator'
import { round3, waterClock } from '@/ohq-ui/water/motion'
import { pressPoint, rippleAt } from '@/ohq-ui/water/ripple'
import { useProfilePhoto } from '../data/tech-profiles'
import { useSidebarPeople } from '../data/use-my-work'
import { personColor } from '../lib/person-color'
import { SIDEBAR_TOGGLE_KEY } from '../lib/use-sidebar-collapsed'
import { NAV_SECTIONS, type NavItem } from '../nav'
import { MY_WORK_PATH, myWorkPath, XT_BASE } from '../paths'

// 관리자 화면(구성원 등록·권한) — 팀 페이지 밖, 모든 팀이 같이 쓴다.
const ADMIN_PATH = '/admin/xtool'
// 표시 알약이 움직이는 동안 — 이 안에 크기가 바뀌면(직원 목록 펼침 등) 끊지 않고 새 자리로 이어 간다
const SETTLE = 0.9

interface WaterSidebarProps {
  member: XtoolMember
  collapsed: boolean
  onToggle: () => void
}

/** 지금 주소의 메뉴 — 개요는 정확히, 나머지는 앞부분으로 찾는다(상단바 제목과 같은 규칙). */
const activeOf = (pathname: string, items: readonly NavItem[]) => {
  const path = pathname.replace(/\/$/, '')
  return items.find((item) => (item.to === XT_BASE ? path === XT_BASE : path.startsWith(item.to)))?.to ?? null
}

/**
 * 물 레이아웃의 왼쪽 메뉴 — 유리 판 위 메뉴 줄. 지금 보는 메뉴 뒤에 D7 표시 알약(어두운 알약)이 깔리고, 메뉴를
 * 옮기면 알약이 스프링으로 미끄러지며 달리는 만큼 늘었다 준다(WaterIndicatorEngine 세로). 지나가는 줄은
 * 알약을 따라가는 창(.wl-nav__window — 같은 메뉴를 흰 글자로 한 벌 더)으로 희게 보인다(D7 고르기와 같은 방법).
 * 오른쪽 테두리의 유리 단추로 아이콘 줄 ↔ 펼침을 오간다.
 */
export function WaterSidebar({ member, collapsed, onToggle }: WaterSidebarProps) {
  const id = useId()
  const photo = useProfilePhoto(member.email)
  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.adminOnly || member.isAdmin),
  }))
  return (
    <div className="wl-sidebar-wrap">
      <aside id={id} className="wl-sidebar">
        <div className="wl-sidebar__brand">
          <span className="wl-brand" aria-hidden>
            <XMark className="wl-brand__x" />
          </span>
          <div className="wl-sidebar__brand-text">
            <strong>xtool tech</strong>
            <span>TECH BOARD</span>
          </div>
        </div>

        <WaterNav sections={sections} collapsed={collapsed} />

        <div className="wl-sidebar__footer">
          <WaterAvatar
            initials={initialsOf(member.name, member.email)}
            color="#3f3e43"
            size="md"
            photo={photo}
            className="wl-sidebar__avatar"
          />
          <div className="wl-sidebar__user" title={member.email}>
            <strong>{member.name || member.email}</strong>
            <span>{member.isAdmin ? '관리자' : member.email}</span>
          </div>
          {member.isAdmin && (
            <Link to={ADMIN_PATH} className="wl-sidebar__tool" aria-label="구성원 관리" title="구성원 관리">
              <ShieldCheck size={15} aria-hidden />
            </Link>
          )}
          {/* 로그아웃하면 화면 잠금(AppLayout)이 로그인 화면으로 보낸다. */}
          <button type="button" className="wl-sidebar__tool" onClick={() => void signOutXtool()} aria-label="로그아웃" title="로그아웃">
            <LogOut size={15} aria-hidden />
          </button>
        </div>
      </aside>

      <button
        type="button"
        className="wl-sidebar-toggle"
        aria-expanded={!collapsed}
        aria-controls={id}
        aria-keyshortcuts={SIDEBAR_TOGGLE_KEY}
        aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        title={`${collapsed ? '펼치기' : '접기'} (${SIDEBAR_TOGGLE_KEY})`}
        onClick={onToggle}
      >
        <ChevronLeft size={14} strokeWidth={2.6} className="wl-sidebar-toggle__icon" aria-hidden />
      </button>
    </div>
  )
}

interface NavGeometry {
  /** 메뉴 줄마다 가운데·높이(nav 좌표, px) */
  items: Map<string, { pos: number; size: number }>
  /** 알약 왼쪽·폭 — 창 안의 흰 메뉴를 제자리에 두는 데 쓴다 */
  left: number
  width: number
}

/** 메뉴 묶음들 + 표시 알약 + 흰 글자 창 */
function WaterNav({ sections, collapsed }: { sections: { label: string; items: NavItem[] }[]; collapsed: boolean }) {
  const { pathname } = useLocation()
  const reduced = useReducedMotion()
  const active = activeOf(
    pathname,
    sections.flatMap((s) => s.items),
  )
  const navRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLSpanElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const geo = useRef<NavGeometry | null>(null)
  const shown = useRef<string | null>(null)
  const movedAt = useRef(-Infinity)
  const pressedAt = useRef<number | undefined>(undefined)
  const latest = useRef({ active, reduced })

  // 직원 목록 펼침 — 실제 메뉴와 창 안의 흰 한 벌이 같이 쓴다(한 벌만 펴지면 줄이 어긋난다)
  const onMyWork = pathname.startsWith(MY_WORK_PATH)
  const [peopleOpen, setPeopleOpen] = useState(onMyWork)
  // 다른 곳(개요 카드 등)에서 내 업무로 들어와도 목록을 편다 — 렌더 중에 이전 값과 비교
  const [wasOnMyWork, setWasOnMyWork] = useState(onMyWork)
  if (onMyWork !== wasOnMyWork) {
    setWasOnMyWork(onMyWork)
    if (onMyWork) setPeopleOpen(true)
  }
  const people = { shown: peopleOpen && !collapsed, setOpen: setPeopleOpen }

  // 알약을 그릴 때마다(같은 프레임) 창을 같은 모양으로 옮기고, 창 안의 흰 메뉴는 거꾸로 옮겨 제자리에 둔다
  const follow = (pose: IndicatorPose) => {
    const win = windowRef.current
    const inner = innerRef.current
    const g = geo.current
    if (!win || !inner || !g) return
    const size = round3(pose.size)
    win.style.height = `${size}px`
    win.style.transform = `translate(0, ${round3(pose.pos - pose.size / 2)}px) scale(${round3(pose.across)}, ${round3(pose.along)})`
    inner.style.transformOrigin = `${round3(g.left + g.width / 2)}px ${round3(size / 2)}px`
    inner.style.transform = `scale(${round3(1 / pose.across)}, ${round3(1 / pose.along)}) translate(0, ${-round3(pose.pos - pose.size / 2)}px)`
  }
  const { ref: indicatorRef, engine: indicatorEngine } = useWaterIndicator<HTMLSpanElement>({ axis: 'y', onDraw: follow })

  useLayoutEffect(() => {
    latest.current = { active, reduced }
  })

  // 재기 — 처음과 크기가 바뀔 때(창 폭·접기·직원 목록 펼침). 알약이 움직이는 중이면 끊지 않고 새 자리로 이어 간다
  useLayoutEffect(() => {
    const nav = navRef.current
    const ind = indicatorRef.current
    const win = windowRef.current
    const inner = innerRef.current
    if (!nav || !ind || !win || !inner) return
    const measure = () => {
      const box = nav.getBoundingClientRect()
      const items = new Map<string, { pos: number; size: number }>()
      for (const el of nav.querySelectorAll<HTMLElement>('.wl-nav__list:not(.is-on) [data-nav]')) {
        const b = el.getBoundingClientRect()
        items.set(el.dataset.nav!, { pos: round3(b.top - box.top + b.height / 2), size: round3(b.height) })
      }
      const first = nav.querySelector<HTMLElement>('.wl-nav__list:not(.is-on) [data-nav]')
      const fb = first?.getBoundingClientRect()
      const left = fb ? round3(fb.left - box.left) : 0
      const width = fb ? round3(fb.width) : 0
      geo.current = { items, left, width }
      for (const el of [ind, win]) {
        el.style.left = `${left}px`
        el.style.width = `${width}px`
      }
      inner.style.left = `${-left}px`
      inner.style.width = `${round3(box.width)}px`
      const e = indicatorEngine.current
      const key = latest.current.active
      const t = key ? items.get(key) : undefined
      ind.classList.toggle('is-hidden', !t)
      win.classList.toggle('is-hidden', !t)
      if (!e || !t) return
      const moving = waterClock() - movedAt.current < SETTLE && !latest.current.reduced
      e.set(t, moving ? {} : { instant: true })
      shown.current = key
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(nav)
    return () => ro.disconnect()
  }, [indicatorRef, indicatorEngine])

  // 메뉴가 바뀌면 — 알약을 옮긴다(누른 시각부터 잰다)
  useLayoutEffect(() => {
    const e = indicatorEngine.current
    const g = geo.current
    const ind = indicatorRef.current
    const win = windowRef.current
    const prev = shown.current
    if (!e || !g || !ind || !win || prev === active) return
    const t = active ? g.items.get(active) : undefined
    ind.classList.toggle('is-hidden', !t)
    win.classList.toggle('is-hidden', !t)
    shown.current = active
    const at = pressedAt.current
    pressedAt.current = undefined
    if (!t) return
    if (prev === null || reduced) {
      e.set(t, { instant: true })
      return
    }
    e.set(t, { at })
    movedAt.current = at ?? waterClock()
  }, [active, reduced, indicatorEngine, indicatorRef])

  const onPress = () => {
    pressedAt.current = waterClock()
  }

  return (
    <div ref={navRef} className="wl-nav">
      <span ref={indicatorRef} className="wl-nav__indicator is-hidden" aria-hidden />
      <NavLists sections={sections} active={active} people={people} onPress={onPress} />
      {/* 알약을 따라가는 창 — 같은 메뉴를 흰 글자로 한 벌 더(읽어 주기·키보드에서는 빠진다) */}
      <span ref={windowRef} className="wl-nav__window is-hidden" aria-hidden>
        <div ref={innerRef} className="wl-nav__inner" inert>
          <NavLists sections={sections} active={active} people={people} on />
        </div>
      </span>
    </div>
  )
}

interface PeopleState {
  /** 직원 목록이 펼쳐져 있는지(사이드바를 접으면 숨는다) */
  shown: boolean
  setOpen: (update: boolean | ((open: boolean) => boolean)) => void
}

interface NavListsProps {
  sections: { label: string; items: NavItem[] }[]
  active: string | null
  people: PeopleState
  /** 창 안의 흰 한 벌 — 글자만 보이고 나머지(묶음 이름·직원 목록)는 자리만 차지한다 */
  on?: boolean
  onPress?: () => void
}

function NavLists({ sections, active, people, on = false, onPress }: NavListsProps) {
  return (
    <div className={cx('wl-nav__list', on && 'is-on')}>
      {sections.map((section) => (
        <nav key={section.label} className="wl-nav__section" aria-label={on ? undefined : section.label}>
          <p className="wl-nav__section-label">{section.label}</p>
          <ul>
            {section.items.map((item) =>
              item.people ? (
                <PeopleItem key={item.to} item={item} active={active === item.to} people={people} on={on} onPress={onPress} />
              ) : (
                <li key={item.to}>
                  <NavRow item={item} active={active === item.to} on={on} onPress={onPress} />
                </li>
              ),
            )}
          </ul>
        </nav>
      ))}
    </div>
  )
}

/** 메뉴 한 줄 — 잉크 글자 위에 흰 글자 겹(고른 줄에서만 떠오른다). 누르면 그 자리에서 물결이 퍼진다. */
function NavRow({ item, active, on, onPress }: { item: NavItem; active: boolean; on: boolean; onPress?: () => void }) {
  const { to, label, icon: Icon, badge } = item
  const { ref: rippleRef, engine: rippleEngine } = useWaterRipple()
  const face = (
    <>
      <Icon size={16} strokeWidth={2} className="wl-nav__icon" aria-hidden />
      <span className="wl-nav__label">{label}</span>
      {badge && <span className="wl-nav__badge">{badge}</span>}
    </>
  )
  if (on) {
    return (
      <span className="wl-nav__item" data-nav={to}>
        <span className="wl-nav__face">{face}</span>
      </span>
    )
  }
  const press = (e: MouseEvent<HTMLAnchorElement>) => {
    onPress?.()
    const svg = rippleRef.current
    if (svg && !active) rippleEngine.current?.play(rippleAt(svg, e.currentTarget, { point: pressPoint(e) }))
  }
  return (
    <NavLink
      to={to}
      end={to === XT_BASE}
      title={label}
      className={cx('wl-nav__item', active && 'is-active')}
      data-nav={to}
      onClick={press}
    >
      <span className="wl-nav__face wl-nav__face--ink">{face}</span>
      <span className="wl-nav__face wl-nav__face--on" aria-hidden>
        {face}
      </span>
      <svg ref={rippleRef} className="wl-nav__ripple" aria-hidden focusable="false" />
    </NavLink>
  )
}

/**
 * 내 업무 메뉴 — 누르면 내 업무로 가며 아래로 직원 목록이 펼쳐진다(사이드바를 접으면 숨는다). 오른쪽 갈매기는
 * 목록만 접고 편다. 펼침은 CSS 격자 줄 높이(0fr ↔ 1fr)를 D7 extend 스프링으로 — 창 안의 흰 한 벌도 같은
 * 규칙으로 같은 프레임에 움직여 줄이 어긋나지 않는다.
 */
function PeopleItem({
  item,
  active,
  people,
  on,
  onPress,
}: {
  item: NavItem
  active: boolean
  people: PeopleState
  on: boolean
  onPress?: () => void
}) {
  const { shown, setOpen } = people
  // 접는 동안에도 목록을 남겨 두었다가(줄 높이가 0으로 줄어드는 동안) 다 접히면 뗀다 — 닫혀 있으면 보드를
  // 구독하지 않는다
  const [mounted, setMounted] = useState(shown)
  if (shown && !mounted) setMounted(true)
  return (
    <li className={cx('wl-people', shown && 'is-open')}>
      <div className="wl-people__row">
        <NavRow
          item={item}
          active={active}
          on={on}
          onPress={() => {
            onPress?.()
            setOpen(true)
          }}
        />
        {!on && (
          <button
            type="button"
            className="wl-people__caret"
            aria-expanded={shown}
            aria-label={`직원 목록 ${shown ? '접기' : '펼치기'}`}
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronUp size={14} strokeWidth={2.2} className="wl-people__caret-icon" aria-hidden />
          </button>
        )}
      </div>
      <div
        className="wl-people__sub"
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && !shown) setMounted(false)
        }}
      >
        <div className="wl-people__clip">{mounted && <PeopleList on={on} />}</div>
      </div>
    </li>
  )
}

/** 직원 목록 — 나는 맨 위(대시보드 사이드바와 같은 목록 — useSidebarPeople). */
function PeopleList({ on }: { on: boolean }) {
  const { me, isTech, myPhoto, photoOf, loading, who, viewingMe, myOpen, others } = useSidebarPeople()

  return (
    <ul className="wl-people__list" aria-label={on ? undefined : '직원별 업무'}>
      {isTech && (
        <PersonRow
          to={myWorkPath()}
          label={me.name ? `나 · ${me.name}` : '나'}
          avatar={{ name: me.name ?? '나', color: '#3f3e43', photo: myPhoto }}
          count={myOpen}
          active={viewingMe}
        />
      )}
      {others.map((p) => (
        <PersonRow
          key={p.name}
          to={myWorkPath(p.name)}
          label={p.name}
          avatar={{ name: p.name, color: personColor(p.name), photo: photoOf(p.name) }}
          count={p.open}
          active={who === p.name}
        />
      ))}
      {loading && others.length === 0 && <li className="wl-people__note">불러오는 중…</li>}
    </ul>
  )
}

function PersonRow({
  to,
  label,
  avatar,
  count,
  active,
}: {
  to: string
  label: string
  avatar: { name: string; color: string; photo?: string }
  count: number
  active: boolean
}) {
  return (
    <li>
      <Link
        to={to}
        className={cx('wl-people__btn', active && 'is-active')}
        aria-current={active ? 'page' : undefined}
        title={`${label} — 진행 중 ${count}건`}
      >
        <WaterAvatar initials={initialsOf(avatar.name, '')} color={avatar.color} size="xs" photo={avatar.photo} />
        <span className="wl-people__label">{label}</span>
        {count > 0 && <span className="wl-people__count">{count}</span>}
      </Link>
    </li>
  )
}
