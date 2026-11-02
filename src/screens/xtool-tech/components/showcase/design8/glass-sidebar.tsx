import { animate, frame, motion, useMotionTemplate, useMotionValue } from 'motion/react'
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { SelectionPill } from './selection-pill'
import { D8SidebarContext, type D8DockEntry, type D8SidebarContextValue, type D8TipTarget } from './sidebar-context'
import { D8_DOCK, D8_EXPAND, D8_SECTIONS, D8_TOGGLE_KEY, D8_TOOLTIP, D8_WIDTH, D8_WORKSPACE } from './sidebar-data'
import { NightModeRow, SidebarProfile } from './sidebar-footer'
import { SidebarLogo } from './sidebar-logo'
import { slowSpring, slowTween } from './sidebar-motion'
import { SidebarNavItem } from './sidebar-nav-item'
import { SidebarSearch } from './sidebar-search'
import { SidebarSection } from './sidebar-section'
import { SidebarSubList } from './sidebar-sub-list'
import { SidebarToggle } from './sidebar-toggle'
import { SidebarTooltip } from './sidebar-tooltip'

interface GlassSidebarProps {
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  /** 고른 메뉴 key */
  value: string
  onValueChange: (key: string) => void
  nightMode?: boolean
  onNightModeChange?: (on: boolean) => void
  /** 시간 배율(1 = 영상 속도, 0.1 = 10배 느리게) */
  timeScale?: number
}

const noop = () => {}

/**
 * Design 8 유리 사이드바 — 접힘(7.8em 알약)·펼침(32.6em) 두 모양을 한 덩어리로 오간다.
 * 가운데 자리는 그대로 두고 폭은 양옆으로, 높이는 하위 메뉴만큼 위아래로 함께 자란다(F74~F86).
 * 접혔을 땐 커서 근처 아이콘이 독처럼 커지고 툴팁이 따라붙는다. 부모는 자리만 잡아 주면 된다.
 */
export function GlassSidebar({
  expanded,
  onExpandedChange,
  value,
  onValueChange,
  nightMode = false,
  onNightModeChange,
  timeScale = 1,
}: GlassSidebarProps) {
  const navId = useId()
  const width = useMotionValue(expanded ? D8_WIDTH.expanded : D8_WIDTH.collapsed)
  const widthEm = useMotionTemplate`${width}em`
  const labels = useMotionValue(expanded ? 1 : 0)
  const rail = useMotionValue(expanded ? 0 : 1)
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [tip, setTip] = useState<D8TipTarget | null>(null)

  const wrapRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const docks = useRef(new Map<string, D8DockEntry>())
  const items = useRef(new Map<string, HTMLElement>())
  const subs = useRef(new Set<() => void>())
  const hideTimer = useRef<number | null>(null)
  const scaleRef = useRef(timeScale)
  const expandedRef = useRef(expanded)
  useEffect(() => {
    scaleRef.current = timeScale
    expandedRef.current = expanded
  }, [timeScale, expanded])

  const getScale = useCallback(() => scaleRef.current, [])
  const runLayout = useCallback(() => subs.current.forEach((cb) => cb()), [])
  // 같은 함수를 한 프레임에 여러 번 걸어도 motion frame이 한 번만 돌린다
  const notifyLayout = useCallback(() => frame.read(runLayout), [runLayout])
  const subscribeLayout = useCallback((cb: () => void) => {
    subs.current.add(cb)
    return () => {
      subs.current.delete(cb)
    }
  }, [])
  const registerDock = useCallback((key: string, entry: D8DockEntry | null) => {
    if (entry) docks.current.set(key, entry)
    else docks.current.delete(key)
  }, [])
  const registerItem = useCallback((key: string, el: HTMLElement | null) => {
    if (el) items.current.set(key, el)
    else items.current.delete(key)
  }, [])
  const itemEl = useCallback((key: string) => items.current.get(key), [])
  const showTip = useCallback((target: D8TipTarget | null) => {
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current)
    hideTimer.current = null
    if (target) setTip(target)
    else {
      hideTimer.current = window.setTimeout(() => {
        hideTimer.current = null
        setTip(null)
      }, (D8_TOOLTIP.hideDelay * 1000) / scaleRef.current)
    }
  }, [])
  useEffect(
    () => () => {
      if (hideTimer.current != null) window.clearTimeout(hideTimer.current)
    },
    [],
  )

  /**
   * 독 — 커서 y(px)에서 항목 가운데까지 거리(지금 자리)로 목표 증가를 정하고 스프링으로 간다.
   * 항목이 커지며 자리가 밀리면 거리가 바뀌므로, 움직이는 동안 매 프레임 목표를 다시 잰다
   * (F1~F74를 맞춘 시뮬레이션과 같은 방식). null이면 모두 0.
   */
  const pointerY = useRef<number | null>(null)
  const retarget = useCallback(() => {
    const panel = panelRef.current
    if (!panel) return
    const em = parseFloat(getComputedStyle(panel).fontSize)
    // 펼쳐져 있으면 독은 늘 쉼
    const y = expandedRef.current ? null : pointerY.current
    for (const entry of docks.current.values()) {
      let target = 0
      if (y != null) {
        const r = entry.el.getBoundingClientRect()
        const d = Math.abs(y - (r.top + r.height / 2)) / em
        target = Math.max(0, 1 - d / D8_DOCK.range) * entry.max
      }
      if (Math.abs(target - entry.target) > 0.004) {
        entry.target = target
        animate(entry.grow, target, slowSpring(D8_DOCK.spring, scaleRef.current))
      }
    }
  }, [])
  const dockTo = useCallback(
    (clientY: number | null) => {
      pointerY.current = clientY
      retarget()
    },
    [retarget],
  )
  useEffect(() => subscribeLayout(retarget), [subscribeLayout, retarget])

  // 펼침·접힘 — 폭, 글자, 접힘 장식을 함께 움직인다(첫 렌더에선 이미 제자리라 그대로)
  useEffect(() => {
    const s = scaleRef.current
    const runs = [
      animate(width, expanded ? D8_WIDTH.expanded : D8_WIDTH.collapsed, slowTween(D8_EXPAND.width, s)),
      animate(labels, expanded ? 1 : 0, slowTween(expanded ? D8_EXPAND.labelsIn : D8_EXPAND.labelsOut, s)),
      animate(rail, expanded ? 0 : 1, slowTween(expanded ? D8_EXPAND.railOut : D8_EXPAND.railIn, s)),
    ]
    return () => runs.forEach((r) => r.stop())
  }, [expanded, width, labels, rail])

  // 글자 크기(무대 폭)가 바뀌면 알약·툴팁 자리를 다시 잰다
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const ro = new ResizeObserver(() => notifyLayout())
    ro.observe(panel)
    return () => ro.disconnect()
  }, [notifyLayout])

  const toggle = () => {
    dockTo(null)
    onExpandedChange(!expanded)
  }
  const openSearch = () => {
    if (!expanded) {
      dockTo(null)
      onExpandedChange(true)
    }
    searchRef.current?.focus({ preventScroll: true })
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const typing = e.target instanceof HTMLInputElement
    if (e.key === D8_TOGGLE_KEY && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      toggle()
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      openSearch()
    }
  }

  const ctx = useMemo<D8SidebarContextValue>(
    () => ({
      expanded,
      timeScale,
      getScale,
      labels,
      rail,
      registerDock,
      registerItem,
      itemEl,
      showTip,
      notifyLayout,
      subscribeLayout,
    }),
    [expanded, timeScale, getScale, labels, rail, registerDock, registerItem, itemEl, showTip, notifyLayout, subscribeLayout],
  )

  // 메뉴 툴팁은 접혔을 때만, 토글 툴팁은 늘
  const visibleTip = tip && (tip.anchor === 'toggle' || !expanded) ? tip : null

  return (
    <D8SidebarContext value={ctx}>
      <div
        ref={wrapRef}
        className="d8-sidebar"
        data-expanded={expanded || undefined}
        style={{ '--d8-time': timeScale } as CSSProperties}
        onKeyDown={onKeyDown}
      >
        <motion.nav
          ref={panelRef}
          id={navId}
          className="d8-panel"
          aria-label={`${D8_WORKSPACE.name} 사이드바`}
          style={{ width: widthEm }}
          onPointerMove={(e) => {
            if (!expanded && e.pointerType === 'mouse') dockTo(e.clientY)
          }}
          onPointerLeave={() => dockTo(null)}
        >
          <header className="d8-head">
            <SidebarLogo />
            <motion.div className="d8-head__text" style={{ opacity: labels }}>
              <strong className="d8-head__name">{D8_WORKSPACE.name}</strong>
              <span className="d8-head__caption">{D8_WORKSPACE.caption}</span>
            </motion.div>
          </header>

          <SidebarSearch inputRef={searchRef} onOpen={openSearch} />

          <div ref={listRef} className="d8-list">
            <SelectionPill value={value} listRef={listRef} />
            {D8_SECTIONS.map((section) => (
              <div key={section.key} className="d8-group" role="group" aria-labelledby={`${navId}-${section.key}`}>
                <SidebarSection id={`${navId}-${section.key}`} label={section.label} />
                {section.items.map((item) => (
                  <Fragment key={item.key}>
                    <SidebarNavItem
                      item={item}
                      selected={item.key === value}
                      onSelect={onValueChange}
                      open={item.children ? projectsOpen : undefined}
                      onOpenChange={item.children ? setProjectsOpen : undefined}
                    />
                    {item.children && <SidebarSubList items={item.children} open={expanded && projectsOpen} />}
                  </Fragment>
                ))}
              </div>
            ))}
          </div>

          <div className="d8-foot">
            <NightModeRow on={nightMode} onChange={onNightModeChange} />
            <span className="d8-foot__rule" aria-hidden="true" />
            <SidebarProfile />
          </div>
        </motion.nav>

        <SidebarToggle controls={navId} onToggle={toggle} />
        <SidebarTooltip target={visibleTip} width={width} wrapRef={wrapRef} />
      </div>
    </D8SidebarContext>
  )
}

/**
 * 진열용 껍데기 — 부품 하나를 사이드바 맥락(펼침 여부·글자 불투명도) 안에 놓아 보여 준다.
 * 독·툴팁·알약은 움직이지 않는다.
 */
export function SidebarPreview({
  expanded,
  width,
  children,
}: {
  expanded: boolean
  /** 미리보기 판 폭(em) — 기본은 실제 패널 폭 */
  width?: number
  children: ReactNode
}) {
  const labels = useMotionValue(expanded ? 1 : 0)
  const rail = useMotionValue(expanded ? 0 : 1)
  const ctx = useMemo<D8SidebarContextValue>(
    () => ({
      expanded,
      timeScale: 1,
      getScale: () => 1,
      labels,
      rail,
      registerDock: noop,
      registerItem: noop,
      itemEl: () => undefined,
      showTip: noop,
      notifyLayout: noop,
      subscribeLayout: () => noop,
    }),
    [expanded, labels, rail],
  )
  const w = width ?? (expanded ? D8_WIDTH.expanded : D8_WIDTH.collapsed)
  return (
    <D8SidebarContext value={ctx}>
      <div className="d8-sidebar d8-sidebar--preview" data-expanded={expanded || undefined}>
        <div className="d8-panel d8-panel--preview" style={{ width: `${w}em` }}>
          {children}
        </div>
      </div>
    </D8SidebarContext>
  )
}
