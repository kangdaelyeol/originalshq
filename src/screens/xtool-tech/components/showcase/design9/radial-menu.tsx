import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { cx } from '../../../lib/cx'
import { CenterToggle } from './radial-center-toggle'
import { LabelPill } from './radial-label'
import {
  RADIAL_ITEMS,
  satellitePlacement,
  satelliteVars,
  type RadialMenuItem,
  type ReplayHover,
} from './radial-menu-data'
import { SatelliteButton } from './radial-satellite'

interface RadialMenuProps {
  items?: readonly RadialMenuItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 고른 항목 key(없으면 null) */
  value: string | null
  onSelect: (key: string) => void
  /** 재생용 — 주면 마우스·포커스 대신 이 대상('center' 또는 항목 key, null=없음)이 올려진 것으로 그린다 */
  hoverKey?: ReplayHover
  ariaLabel?: string
  className?: string
}

const CENTER = 'center'

/**
 * 뉴모피즘 방사형 메뉴(Design 9 — sample/design9.mp4).
 * 가운데 버튼을 누르면 위성 버튼들이 위에서부터 시계 방향으로 40ms씩 늦게 튀어나왔다가 제자리로 돌아오고,
 * 다시 누르면 같은 순서로 가운데로 빨려 들어간다. 위성에 올리면 이름표가 뜨고, 누르면 그 항목이 골라진다.
 * 키보드: 가운데에서 Enter/Space로 열면 첫(또는 고른) 항목으로 가고, 화살표로 돌며 Esc로 닫는다.
 */
export function RadialMenu({
  items = RADIAL_ITEMS,
  open,
  onOpenChange,
  value,
  onSelect,
  hoverKey,
  ariaLabel = '빠른 메뉴',
  className,
}: RadialMenuProps) {
  const menuId = useId()
  const [pointerKey, setPointerKey] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, items.findIndex((it) => it.key === value)))
  const toggleRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  // 닫힌 동안 항목은 inert라 바로 포커스할 수 없다 — 열린 뒤(effect)에 옮긴다.
  const pendingFocus = useRef<number | null>(null)

  const hovered = hoverKey !== undefined ? hoverKey : (pointerKey ?? focusKey)

  useEffect(() => {
    if (!open || pendingFocus.current === null) return
    const index = pendingFocus.current
    pendingFocus.current = null
    itemRefs.current[index]?.focus()
  }, [open])

  const setMenuOpen = (next: boolean, focusIndex?: number) => {
    if (!next) {
      // 닫히면 항목이 pointer-events를 잃어 pointerleave가 안 올 수 있다 — 가운데 것만 남긴다.
      setPointerKey((k) => (k === CENTER ? k : null))
      setFocusKey((k) => (k === CENTER ? k : null))
    }
    pendingFocus.current = next && focusIndex !== undefined ? focusIndex : null
    onOpenChange(next)
  }

  const focusItem = (index: number) => {
    const i = (index + items.length) % items.length
    setActiveIndex(i)
    itemRefs.current[i]?.focus()
  }

  const startIndex = () => {
    const selected = items.findIndex((it) => it.key === value)
    return selected >= 0 ? selected : activeIndex
  }

  const onToggleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      setMenuOpen(false)
    } else if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) {
      e.preventDefault()
      const back = e.key === 'ArrowUp' || e.key === 'ArrowLeft'
      const index = open ? startIndex() : back ? items.length - 1 : startIndex()
      if (open) focusItem(index)
      else setMenuOpen(true, index)
    }
  }

  const onItemKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: items.length - 1,
    }
    if (e.key in moves) {
      e.preventDefault()
      focusItem(moves[e.key])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setMenuOpen(false)
      toggleRef.current?.focus()
    }
  }

  // 키보드 포커스(:focus-visible)일 때만 올린 것처럼 — 마우스로 누를 때 생기는 포커스는 뺀다.
  const focusHandlers = (key: string) => ({
    onFocus: (e: FocusEvent<HTMLButtonElement>) => {
      if (e.currentTarget.matches(':focus-visible')) setFocusKey(key)
    },
    onBlur: () => setFocusKey((k) => (k === key ? null : k)),
  })

  return (
    <div className={cx('d9-menu', open && 'is-open', className)}>
      <ul id={menuId} className="d9-menu__items" role="menu" aria-label={ariaLabel} inert={!open}>
        {items.map((item, i) => {
          const placement = satellitePlacement(i, items.length)
          const isHovered = open && hovered === item.key
          const selected = item.key === value
          return (
            <li
              key={item.key}
              role="none"
              className={cx('d9-item', `d9-item--${placement.labelSide}`)}
              style={satelliteVars(placement, i)}
              onPointerEnter={() => setPointerKey(item.key)}
              onPointerLeave={() => setPointerKey((k) => (k === item.key ? null : k))}
            >
              <SatelliteButton
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                item={item}
                role="menuitemradio"
                aria-checked={selected}
                tabIndex={i === activeIndex ? 0 : -1}
                hovered={isHovered}
                selected={selected}
                onClick={() => {
                  setActiveIndex(i)
                  onSelect(item.key)
                }}
                onKeyDown={(e) => onItemKeyDown(e, i)}
                {...focusHandlers(item.key)}
              />
              <LabelPill text={item.label} visible={isHovered} className="d9-item__label" />
            </li>
          )
        })}
      </ul>
      <CenterToggle
        ref={toggleRef}
        open={open}
        hovered={hovered === CENTER}
        aria-controls={menuId}
        aria-haspopup="menu"
        // 키보드로 누르면(detail 0) 열면서 항목으로 포커스를 옮긴다.
        onClick={(e) => setMenuOpen(!open, !open && e.detail === 0 ? startIndex() : undefined)}
        onKeyDown={onToggleKeyDown}
        onPointerEnter={() => setPointerKey(CENTER)}
        onPointerLeave={() => setPointerKey((k) => (k === CENTER ? null : k))}
        {...focusHandlers(CENTER)}
      />
    </div>
  )
}
