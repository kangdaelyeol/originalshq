import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cx } from '../../../lib/cx'
import { LiquidDropShape } from './liquid-drop'
import { LiquidGlassBody } from './liquid-glass'
import { LiquidIndicator } from './liquid-indicator'
import { LiquidMenuEngine, liquidClock } from './liquid-menu-engine'
import { LiquidListIcon } from './liquid-menu-icons'
import { LIQUID_MENU_ITEMS } from './liquid-menu-items'
import {
  CLOSED_R,
  SPLASH_PARTICLES,
  liquidGeometry,
  restPose,
  type LiquidEffect,
  type LiquidMenuItem,
} from './liquid-menu-data'

interface LiquidMenuProps {
  items?: readonly LiquidMenuItem[]
  value: string
  onChange: (key: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 고를 때 떨어지는 물방울 — bounce: 튀어 올랐다 통통, splash: 떨어져 흩어짐 */
  effect?: LiquidEffect
  ariaLabel?: string
}

/**
 * 물처럼 펼쳐지는 햄버거 메뉴(Design 7, sample/design7.mp4).
 * 둥근 유리 버튼을 누르면 버튼에서 알약이 물처럼 뻗어 나와(15% 넘쳤다 돌아옴) 떨어져 나가고,
 * 다시 누르면 알약이 버튼으로 빨려 들어가며 버튼이 가운데로 돌아온다.
 * 원점(left/top 0)이 접힌 버튼의 가운데, 크기는 글자 크기(1em = 영상 10px)를 따른다.
 * 움직임은 LiquidMenuEngine이 rAF로 DOM에 직접 그린다 — React는 열림·선택 상태만 가진다.
 */
export function LiquidMenu({
  items = LIQUID_MENU_ITEMS,
  value,
  onChange,
  open,
  onOpenChange,
  effect = 'bounce',
  ariaLabel = '메뉴',
}: LiquidMenuProps) {
  const geo = useMemo(() => liquidGeometry(items.length), [items.length])
  const index = Math.max(0, items.findIndex((it) => it.key === value))
  // 첫 모양만 JSX에 쓴다 — 그 뒤 값은 엔진이 넣으므로 React가 덮어쓰지 않게 바뀌지 않는 값으로 둔다.
  const [initial] = useState(() => ({ open, index }))
  const pose0 = useMemo(() => restPose(initial.open, geo), [initial.open, geo])
  const menuId = useId()
  const blurId = `d7-decor-${useId().replace(/:/g, '')}`

  const circle = useRef<SVGCircleElement>(null)
  const solid = useRef<HTMLSpanElement>(null)
  const pill = useRef<SVGRectElement>(null)
  const track = useRef<SVGRectElement>(null)
  const rings = useRef<SVGGElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const decor = useRef<HTMLSpanElement>(null)
  const indicator = useRef<HTMLDivElement>(null)
  const label = useRef<HTMLParagraphElement>(null)
  const drop = useRef<SVGGElement>(null)
  const icons = useRef<(HTMLButtonElement | null)[]>([])
  const particles = useRef<(SVGGElement | null)[]>([])
  const engine = useRef<LiquidMenuEngine | null>(null)
  const latest = useRef({ open, index, effect })
  const focusOnOpen = useRef(false)
  // 누른 시각 — 엔진이 그 시각부터 움직임을 잰다(효과가 늦게 돌아도 영상과 같은 시간표)
  const pressedAt = useRef<number | undefined>(undefined)

  useEffect(() => {
    latest.current = { open, index, effect }
  })

  useLayoutEffect(() => {
    const [c, so, p, tr, ri, b, de, ind, lb, dr] = [
      circle.current,
      solid.current,
      pill.current,
      track.current,
      rings.current,
      button.current,
      decor.current,
      indicator.current,
      label.current,
      drop.current,
    ]
    if (!c || !so || !p || !tr || !ri || !b || !de || !ind || !lb || !dr) return
    const e = new LiquidMenuEngine(
      {
        circle: c,
        solid: so,
        pill: p,
        track: tr,
        rings: ri,
        button: b,
        decor: de,
        indicator: ind,
        label: lb,
        drop: dr,
        icons: icons.current.filter((el): el is HTMLButtonElement => !!el),
        particles: particles.current.filter((el): el is SVGGElement => !!el),
      },
      geo,
      latest.current.open,
      latest.current.index,
    )
    engine.current = e
    return () => {
      e.destroy()
      engine.current = null
    }
  }, [geo])

  useEffect(() => {
    engine.current?.setOpen(open, pressedAt.current)
    pressedAt.current = undefined
  }, [open])

  useEffect(() => {
    engine.current?.setIndex(index, effect, pressedAt.current)
    pressedAt.current = undefined
  }, [index, effect])

  // 키보드로 열었으면 아이콘이 나타날 즈음(0.26초) 고른 항목으로 포커스를 옮긴다
  useEffect(() => {
    if (!open || !focusOnOpen.current) return
    focusOnOpen.current = false
    const id = window.setTimeout(() => icons.current[latest.current.index]?.focus(), 260)
    return () => window.clearTimeout(id)
  }, [open])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape' || !open) return
    e.preventDefault()
    onOpenChange(false)
    button.current?.focus()
  }

  const onItemsKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = items.length
    const cur = icons.current.findIndex((el) => el === document.activeElement)
    if (cur < 0) return
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? (cur + 1) % n
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? (cur - 1 + n) % n
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? n - 1
              : -1
    if (next < 0) return
    e.preventDefault()
    icons.current[next]?.focus()
  }

  return (
    <div className="d7-menu" onKeyDown={onKeyDown}>
      <LiquidGlassBody className="d7-menu__glass" pose={pose0} geo={geo} refs={{ circle, pill, track, rings }} />

      <LiquidIndicator
        ref={indicator}
        className="d7-menu__indicator"
        style={{ transform: `translate(${geo.iconX(initial.index) / 10}em, 0)`, opacity: pose0.indicator }}
      />

      <div
        id={menuId}
        className="d7-menu__items"
        role="menu"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        inert={!open}
        onKeyDown={onItemsKeyDown}
      >
        {items.map((item, i) => {
          const Icon = item.icon
          return (
            <button
              key={item.key}
              ref={(el) => {
                icons.current[i] = el
              }}
              type="button"
              role="menuitemradio"
              aria-checked={i === index}
              aria-label={item.label}
              tabIndex={i === index ? 0 : -1}
              className={cx('d7-menu__item', i === index && 'is-active')}
              style={{ left: `${geo.iconX(i) / 10}em`, opacity: pose0.icons[i] }}
              onClick={() => {
                pressedAt.current = liquidClock()
                onChange(item.key)
              }}
            >
              <Icon className="d7-menu__icon" />
            </button>
          )
        })}
      </div>

      <svg className="d7-menu__fx" viewBox="-420 -200 840 400" aria-hidden focusable="false">
        <g ref={drop} opacity={0}>
          <LiquidDropShape />
        </g>
        {SPLASH_PARTICLES.map((_, i) => (
          <g
            key={i}
            ref={(el) => {
              particles.current[i] = el
            }}
            opacity={0}
          >
            <LiquidDropShape />
          </g>
        ))}
      </svg>

      <button
        ref={button}
        type="button"
        className="d7-menu__button"
        style={{ transform: `translate(${pose0.cx / 10}em, 0)` }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
        onClick={(e) => {
          // 키보드(Enter·Space)로 누르면 detail이 0 — 열린 뒤 메뉴 안으로 포커스를 옮긴다
          if (!open && e.detail === 0) focusOnOpen.current = true
          pressedAt.current = liquidClock()
          onOpenChange(!open)
        }}
      >
        {/* 원 크기를 따라 커지고 주는 장식 — 따로 선 버튼의 불투명 유리 + 반사광, 사선 윤광 */}
        <span ref={decor} className="d7-menu__decor" style={{ transform: `scale(${pose0.r / CLOSED_R})` }}>
          <span ref={solid} className="d7-menu__solid" style={{ opacity: pose0.solid }}>
            <svg className="d7-menu__shine" viewBox="-60.5 -60.5 121 121" aria-hidden focusable="false">
              <defs>
                <filter id={`${blurId}-a`} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="0.8" />
                </filter>
              </defs>
              {/* 왼쪽 위 테두리 안쪽의 가는 반사광(F49 210°~245°, 반지름 54.5에서 207) */}
              <path
                d="M-47.2-27.3A54.5 54.5 0 0 1-23-49.4"
                fill="none"
                stroke="#fff"
                strokeOpacity="0.55"
                strokeWidth="2.6"
                strokeLinecap="round"
                filter={`url(#${blurId}-a)`}
              />
            </svg>
          </span>
          <svg className="d7-menu__shine" viewBox="-60.5 -60.5 121 121" aria-hidden focusable="false">
            <defs>
              <filter id={`${blurId}-b`} x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="2.4" />
              </filter>
            </defs>
            {/* 왼쪽 아래 사선 윤광(F49: 338,680 → 358,664, 밝기 +27) — 한 덩어리일 때도 보인다(F24) */}
            <path
              d="M-19.5 34.5L2.5 16"
              stroke="#fff"
              strokeOpacity="0.5"
              strokeWidth="6"
              strokeLinecap="round"
              filter={`url(#${blurId}-b)`}
            />
          </svg>
        </span>
        <LiquidListIcon className="d7-menu__list" />
      </button>

      <p ref={label} className="d7-menu__label" aria-live="polite" style={{ opacity: pose0.label }}>
        {items[index]?.label}
      </p>
    </div>
  )
}
