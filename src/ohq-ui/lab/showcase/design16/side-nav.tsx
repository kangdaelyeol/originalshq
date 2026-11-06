import { Moon } from 'lucide-react'
import { Fragment, useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { D16_T, EASE, play } from './d16-motion'
import { D16_NAV_ICONS } from './d16-icons'
import type { NavSection } from './design16-data'
import { BrandBadge } from './brand-badge'
import { GlassPanel } from './glass-panel'
import { NavItem } from './nav-item'
import { SearchField } from './search-field'
import { spanOf, StretchIndicator } from './stretch-indicator'
import { ToggleSwitch } from './toggle-switch'
import { UserChip } from './user-chip'

/** 목록 안 줄의 위·아래(px) */
const navSpan = (list: HTMLElement | null, key: string) => {
  const el = list?.querySelector<HTMLElement>(`[data-nav="${key}"]`)
  return list && el ? spanOf(el, list, 'y') : null
}

interface SideNavProps {
  brand: { name: string; shop: string }
  user: { name: string; email: string; initials: string }
  sections: NavSection[]
  /** 고른 줄 key */
  active: string
  /** 'to-pack' 숫자 칸에 넣을 값 */
  toPack: number
  dark: boolean
  onDarkChange?: (next: boolean) => void
  onNavigate?: (key: string) => void
  /** 열 때 줄이 차례로 들어오고 표시가 Customers 자리에서 날아온다(영상 F−6 ~ F14) */
  intro?: boolean
  /** 표시가 처음 날아올 자리 */
  introFrom?: string
  className?: string
}

/**
 * 사이드바 판(116×350, 창에서 8px 안쪽) — 머리·검색·SHOP/MONEY/TALK·Settings·Dark mode·사용자.
 * 고른 줄의 파란 알약은 StretchIndicator가 움직인다(늘어나며 옮기기).
 */
export function SideNav({
  brand,
  user,
  sections,
  active,
  toPack,
  dark,
  onDarkChange,
  onNavigate,
  intro = false,
  introFrom = 'customers',
  className,
}: SideNavProps) {
  const rootRef = useRef<HTMLElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const indRef = useRef<HTMLSpanElement>(null)
  const engineRef = useRef<StretchIndicator | null>(null)

  // 처음 — 표시를 놓고(또는 날아오게 하고) 줄을 차례로 들인다
  const onMount = useEffectEvent(() => {
    const ind = indRef.current
    if (!ind) return
    const engine = new StretchIndicator(ind, 'y')
    engineRef.current = engine
    const to = navSpan(listRef.current, active)
    const from = navSpan(listRef.current, introFrom)
    if (to && intro && from) engine.enterFrom(from[0], from[1], to[0], to[1], D16_T.navIndicatorDelay)
    else if (to) engine.place(to[0], to[1])
    if (!intro) return
    const rows = rootRef.current?.querySelectorAll<HTMLElement>('[data-row]') ?? []
    rows.forEach((row, i) =>
      play(
        row,
        [
          { opacity: 0, translate: 'calc(-3 * var(--d16-px)) 0' },
          { opacity: 1, translate: '0 0' },
        ],
        { duration: D16_T.navFade, delay: D16_T.navDelay + i * D16_T.navStagger, easing: EASE.cubicOut },
      ),
    )
  })

  useLayoutEffect(() => {
    onMount()
    return () => engineRef.current?.destroy()
  }, [])

  // 고른 줄이 바뀌면 늘어나며 옮긴다
  useLayoutEffect(() => {
    const span = navSpan(listRef.current, active)
    if (span) engineRef.current?.moveTo(span[0], span[1])
  }, [active])

  // 크기가 바뀌면(무대 폭) 그 자리에 다시 놓는다
  const onResize = useEffectEvent(() => {
    const span = navSpan(listRef.current, active)
    if (span) engineRef.current?.place(span[0], span[1])
  })
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    let first = true
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false
        return
      }
      onResize()
    })
    ro.observe(list)
    return () => ro.disconnect()
  }, [])

  return (
    <GlassPanel as="aside" ref={rootRef} className={cx('d16-side', className)} aria-label="Main navigation">
      <div data-row>
        <BrandBadge name={brand.name} shop={brand.shop} />
      </div>
      <div data-row>
        <SearchField className="d16-side__search" placeholder="Search..." kbd="⌘K" />
      </div>
      <div className="d16-side__list" ref={listRef}>
        <span className="d16-side__indicator" ref={indRef} aria-hidden />
        {sections.map((section, s) => (
          <Fragment key={s}>
            {section.title ? (
              <p className="d16-side__label" data-row>
                {section.title}
              </p>
            ) : (
              <span className="d16-side__gap" aria-hidden />
            )}
            {section.items.map((item) => (
              <div key={item.key} data-row className="d16-side__row">
                <NavItem
                  navKey={item.key}
                  icon={D16_NAV_ICONS[item.icon]}
                  label={item.label}
                  badge={item.badge === 'to-pack' ? toPack : item.badge}
                  active={item.key === active}
                  onClick={() => onNavigate?.(item.key)}
                />
              </div>
            ))}
          </Fragment>
        ))}
      </div>
      <div className="d16-side__foot">
        <div className="d16-side__dark" data-row>
          <Moon className="d16-side__dark-icon" strokeWidth={1.8} aria-hidden />
          <span className="d16-side__dark-label">Dark mode</span>
          <ToggleSwitch checked={dark} onChange={onDarkChange} label="Dark mode" bare />
        </div>
        <div data-row>
          <UserChip name={user.name} email={user.email} initials={user.initials} />
        </div>
      </div>
    </GlassPanel>
  )
}
