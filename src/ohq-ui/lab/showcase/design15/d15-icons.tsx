import {
  BarChart3,
  Calendar,
  CircleHelp,
  LayoutGrid,
  LogOut,
  Settings,
  SquareCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { D15NavIcon, D15ProjectIcon } from './design15-data'

const NAV_ICONS: Record<D15NavIcon, LucideIcon> = {
  grid: LayoutGrid,
  tasks: SquareCheck,
  calendar: Calendar,
  analytics: BarChart3,
  team: Users,
  settings: Settings,
  help: CircleHelp,
  logout: LogOut,
}

/** 사이드바 아이콘(F205: 1.1em, 선 두께 얇게) */
export function NavIcon({ icon }: { icon: D15NavIcon }) {
  const Icon = NAV_ICONS[icon]
  return <Icon className="d15-nav__icon" strokeWidth={1.7} aria-hidden />
}

/** Fernly 표 — 강조색 둥근 네모 안 흰 새싹(F205 x 74~88) */
export function FernlyMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="6" className="d15-mark__bg" />
      <path
        d="M12 19.5v-6.2M12 13.3c0-3.4 2.4-6.1 6-6.6-.2 3.7-2.8 6.4-6 6.6Zm0 0c0-2.8-2-5.1-5-5.5.2 3.1 2.3 5.3 5 5.5Z"
        className="d15-mark__leaf"
      />
    </svg>
  )
}

/** 프로젝트 목록 아이콘(F205 3배 확대) — 결제 줄무늬·잎 원·네 색 더하기·주황 반달·세 동그라미·새 프로젝트 점 */
export function ProjectIcon({ icon }: { icon: D15ProjectIcon }) {
  switch (icon) {
    case 'stripes':
      return (
        <svg className="d15-picon" viewBox="0 0 16 16" aria-hidden>
          {[0, 4.5, 9].map((x) => (
            <path key={x} d={`M${x + 1} 14 L${x + 5.5} 2`} className="d15-picon__stripe" />
          ))}
        </svg>
      )
    case 'pie':
      return (
        <svg className="d15-picon" viewBox="0 0 16 16" aria-hidden>
          <circle cx="8" cy="8" r="7" fill="#1f9e8a" />
          <path d="M8 8 L8 1 A7 7 0 0 1 14.6 10.3 Z" fill="#7fd4c1" />
          <path d="M8 8 L14.6 10.3 A7 7 0 0 1 3.2 13.1 Z" fill="#14786a" />
        </svg>
      )
    case 'plus':
      return (
        <svg className="d15-picon" viewBox="0 0 16 16" aria-hidden>
          <rect x="6.6" y="1" width="2.8" height="6" rx="1" fill="#e5484d" />
          <rect x="6.6" y="9" width="2.8" height="6" rx="1" fill="#2f7bf6" />
          <rect x="1" y="6.6" width="6" height="2.8" rx="1" fill="#30a46c" />
          <rect x="9" y="6.6" width="6" height="2.8" rx="1" fill="#f5b014" />
        </svg>
      )
    case 'sun':
      return (
        <svg className="d15-picon" viewBox="0 0 16 16" aria-hidden>
          <path d="M8 8 L15 6.2 A7 7 0 1 1 11.6 2 Z" fill="#f59e0b" />
          <path d="M8 8 L11.6 2 A7 7 0 0 1 15 6.2 Z" fill="#fbd38d" />
        </svg>
      )
    case 'atoms':
      return (
        <svg className="d15-picon" viewBox="0 0 16 16" aria-hidden>
          <circle cx="8" cy="4.6" r="3.4" fill="#ef6c3a" />
          <circle cx="4.6" cy="11" r="3.4" fill="#4338ca" />
          <circle cx="11.4" cy="11" r="3.4" fill="#5b5bd6" />
        </svg>
      )
    default:
      return (
        <svg className="d15-picon" viewBox="0 0 16 16" aria-hidden>
          <circle cx="8" cy="8" r="7" className="d15-picon__halo" />
          <circle cx="8" cy="8" r="2.6" className="d15-picon__dot" />
        </svg>
      )
  }
}

/** 둘러보기 화살표(맥 기본 모양 — 검정 몸통·흰 테두리, 영상 F855 높이 12.5px) */
export function CursorArrow() {
  return (
    <svg className="d15-cursor__arrow" viewBox="0 0 16 22" aria-hidden>
      <path
        d="M1.5 1.2 L1.5 17.6 L5.4 13.9 L8 20.3 L10.9 19.1 L8.3 12.8 L13.9 12.8 Z"
        fill="#0b0b0b"
        stroke="#fff"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}
