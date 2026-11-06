import { Smartphone } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { stretchMove, type Span } from './d15-motion'
import { D15_NAV_GENERAL, D15_NAV_MENU, type D15NavItem, type D15Page } from './design15-data'
import { FernlyMark, NavIcon } from './d15-icons'

interface AppSidebarProps {
  /** 고른 쪽 — 누르자마자 바뀐다(표시 막대가 바로 출발, 쪽은 0.18초 뒤 바뀐다) */
  page: D15Page
  onNavigate: (page: D15Page) => void
  /** Tasks 옆 숫자(끝나지 않은 일 — 끌어서 Done에 넣으면 10 → 9) */
  openTasks: number
}

const BAR_EM = 1.4 // 표시 막대 높이(F846: 14px)

/**
 * 사이드바(F205 x64~159) — 표·MENU·GENERAL·앱 받기 카드. 왼쪽 끝 강조색 막대가 고른 칸으로 늘어나며 옮겨 간다
 * (F855~F865: 앞 끝 easeInOutCubic 0.317초, 뒤 끝 0.017초 늦게 — 가운데에서 14px → 40px).
 */
export function AppSidebar({ page, onNavigate, openTasks }: AppSidebarProps) {
  const nav = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLSpanElement>(null)
  const span = useRef<Span | null>(null)

  const target = () => {
    const box = nav.current
    const item = box?.querySelector<HTMLElement>(`[data-page="${page}"]`)
    if (!box || !item) return null
    const em = parseFloat(getComputedStyle(box).fontSize) || 16
    return { start: (item.offsetTop + item.offsetHeight / 2) / em - BAR_EM / 2, size: BAR_EM }
  }

  useLayoutEffect(() => {
    const el = bar.current
    const next = target()
    if (!el || !next) return
    if (span.current) stretchMove(el, 'y', span.current, next, 'em')
    else Object.assign(el.style, { top: `${next.start}em`, height: `${next.size}em` })
    span.current = next
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // 글꼴이 늦게 오면 줄 높이가 바뀔 수 있다 — 한 번 다시 맞춘다
  useEffect(() => {
    let live = true
    document.fonts?.ready.then(() => {
      const el = bar.current
      const next = target()
      if (!live || !el || !next) return
      span.current = next
      Object.assign(el.style, { top: `${next.start}em`, height: `${next.size}em` })
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const item = (it: D15NavItem) => (
    <button
      key={it.label}
      type="button"
      className={cx('d15-nav__item', it.page === page && 'is-active')}
      data-page={it.page ?? undefined}
      data-tour={`nav-${it.label.toLowerCase()}`}
      aria-current={it.page === page ? 'page' : undefined}
      onClick={() => it.page && onNavigate(it.page)}
    >
      <NavIcon icon={it.icon} />
      <span>{it.label}</span>
      {it.page === 'tasks' && <b className="d15-nav__badge">{openTasks}</b>}
    </button>
  )

  return (
    <aside className="d15-side">
      <div className="d15-side__brand">
        <FernlyMark className="d15-mark" />
        <span>Fernly</span>
      </div>
      <div ref={nav} className="d15-nav">
        <span ref={bar} className="d15-nav__bar" aria-hidden />
        <p className="d15-nav__label">Menu</p>
        {D15_NAV_MENU.map(item)}
        <p className="d15-nav__label is-general">General</p>
        {D15_NAV_GENERAL.map(item)}
      </div>
      <div className="d15-app-card">
        <svg className="d15-app-card__rings" viewBox="0 0 82 77" preserveAspectRatio="none" aria-hidden>
          {[14, 24, 34, 44, 54, 64, 74].map((r) => (
            <circle key={r} cx="78" cy="74" r={r} />
          ))}
        </svg>
        <span className="d15-app-card__icon">
          <Smartphone aria-hidden strokeWidth={2.2} />
        </span>
        <p className="d15-app-card__title">Fernly for iOS &amp; Android</p>
        <p className="d15-app-card__sub">Your board, in your pocket.</p>
        <button type="button" className="d15-app-card__btn">
          Download
        </button>
      </div>
    </aside>
  )
}
