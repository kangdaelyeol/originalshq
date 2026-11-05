import { ChevronUp } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Link, NavLink } from 'react-router-dom'
import { initialsOf } from '@/xtool-auth/use-xtool-session'
import { useSidebarPeople } from '../../data/use-my-work'
import { cx } from '@/ohq-ui/lib/cx'
import { personColor } from '../../lib/person-color'
import { usePeopleOpen } from '../../lib/use-people-open'
import type { NavItem } from '../../nav'
import { myWorkPath } from '../../paths'
import { Avatar } from '@/ohq-ui/components/avatar'

// Design 8 하위 메뉴와 같은 곡선(0.33, 1, 0.68, 1) — 높이와 갈매기가 함께 움직인다
const EASE = [0.33, 1, 0.68, 1] as const

/**
 * 내 업무 메뉴 — 누르면 내 업무로 가며 아래로 직원 목록이 펼쳐진다(Design 8 SidebarSubList처럼
 * 아이콘 밑 줄기에서 둥글게 꺾인 가지 + 프로필 사진 + 이름). 오른쪽 갈매기는 목록만 접고 편다.
 * 사이드바를 접으면 목록은 숨는다.
 */
export function SidebarPeopleItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  // 펼침 — 물 사이드바와 같은 규칙(내 업무로 들어오면 편다)
  const { shown, setOpen } = usePeopleOpen(collapsed)
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

/** 직원 목록 — 펼쳤을 때만 그려서, 닫혀 있으면 보드를 구독하지 않는다. 나는 맨 위(물 사이드바와 같은 목록 — useSidebarPeople). */
function PeopleList() {
  const { me, isTech, myPhoto, photoOf, loading, who, viewingMe, myOpen, others } = useSidebarPeople()

  return (
    <>
      <span className="nav-sub__trunk" aria-hidden />
      <ul className="nav-sub__list" aria-label="직원별 업무">
        {/* 프로필 사진 — 없으면 이니셜(사람마다 이름으로 정한 색, 나는 강조색) */}
        {isTech && (
          <PersonRow
            to={myWorkPath()}
            label={me.name ? `나 · ${me.name}` : '나'}
            avatar={{ name: me.name ?? '나', color: 'var(--accent)', ink: 'var(--accent-ink)', photo: myPhoto }}
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
        {loading && others.length === 0 && <li className="nav-sub__note">불러오는 중…</li>}
      </ul>
    </>
  )
}

interface RowAvatar {
  name: string
  color: string
  ink?: string
  photo?: string
}

function PersonRow({ to, label, avatar, count, active }: { to: string; label: string; avatar: RowAvatar; count: number; active: boolean }) {
  return (
    <li>
      <Link
        to={to}
        className={cx('nav-sub__btn', active && 'is-active')}
        aria-current={active ? 'page' : undefined}
        title={`${label} — 진행 중 ${count}건`}
      >
        <span className="nav-sub__branch" aria-hidden />
        <Avatar
          initials={initialsOf(avatar.name, '')}
          color={avatar.color}
          ink={avatar.ink}
          size="xs"
          photo={avatar.photo}
          className="nav-sub__avatar"
        />
        <span className="nav-sub__label">{label}</span>
        {count > 0 && <span className="nav-sub__count">{count}</span>}
      </Link>
    </li>
  )
}
