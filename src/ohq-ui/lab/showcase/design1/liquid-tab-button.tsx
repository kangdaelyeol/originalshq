import { useState, type CSSProperties } from 'react'
import { cx } from '../../../lib/cx'
import { LIQUID_BUBBLES, liquidToneVars, makeDrips, type LiquidDrip, type LiquidTabItem } from './liquid-tab-data'

interface LiquidTabButtonProps {
  item: LiquidTabItem
  selected?: boolean
  onSelect?: () => void
  /** 물 찬 상태로 고정(견본용) — 주면 마우스와 상관없이 이 값을 쓴다 */
  wet?: boolean
}

/**
 * 물이 차오르는 뉴모피즘 버튼(Design 1).
 * - 마우스를 올리거나 키보드로 포커스하면 버튼이 눌린 듯 들어가고, 둘레에 색 빛, 물이 80%까지 차오른다.
 * - 떠나면 물이 빠지고 안쪽 벽에 남은 방울 넷이 흘러내린다.
 * - 누르면(onSelect) 선택 — 아이콘이 버튼 색이 되고 아래에 빛나는 점이 생긴다.
 * 차오름·빠짐·흔들림은 CSS(_design1.scss)가 하고, 여기서는 상태와 방울 자리만 정한다.
 */
export function LiquidTabButton({ item, selected = false, onSelect, wet: forcedWet }: LiquidTabButtonProps) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [drips, setDrips] = useState<LiquidDrip[]>([])
  const wet = forcedWet ?? (hovered || focused)
  const Icon = item.icon

  // 마른 상태로 돌아갈 때만 방울을 흘린다(마우스·포커스 둘 다 떠났을 때).
  const dryOff = (stillWet: boolean) => {
    if (forcedWet === undefined && !stillWet) setDrips(makeDrips())
  }

  return (
    <button
      type="button"
      className={cx('d1-btn', wet && 'is-wet', selected && 'is-selected', item.fillOnWet && 'd1-btn--fill')}
      style={liquidToneVars(item.tone)}
      aria-label={item.label}
      aria-current={selected ? 'page' : undefined}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false)
        dryOff(focused)
      }}
      onFocus={(e) => {
        // 마우스로 누를 때 생기는 포커스는 빼고, 키보드 포커스만 물을 채운다(영상 코드의 :focus-visible).
        if (e.currentTarget.matches(':focus-visible')) setFocused(true)
      }}
      onBlur={() => {
        if (!focused) return
        setFocused(false)
        dryOff(hovered)
      }}
      onClick={onSelect}
    >
      <span
        className="d1-btn__face"
        onAnimationEnd={(e) => {
          // 마지막 방울이 다 흘러내리면 지운다(data-last-drip은 값이 빈 문자열이라 있는지로 본다).
          if ((e.target as HTMLElement).dataset.lastDrip !== undefined) setDrips([])
        }}
      >
        <span className="d1-btn__orb" aria-hidden />
        <span className="d1-btn__dot" aria-hidden />
        <span className="d1-water" aria-hidden>
          <span className="d1-water__back" />
          <span className="d1-water__front" />
        </span>
        {LIQUID_BUBBLES.map((b) => (
          <span
            key={b.x}
            className="d1-bubble"
            aria-hidden
            style={{ '--bx': `${b.x / 10}em`, '--bd': `${b.delay}s`, '--bt': `${b.duration}s` } as CSSProperties}
          />
        ))}
        <Icon className="d1-btn__icon" />
        {drips.map((d, i) => (
          <span
            key={d.id}
            className="d1-drip"
            aria-hidden
            data-last-drip={i === drips.length - 1 ? '' : undefined}
            style={
              { '--x': `${d.x}em`, '--y0': `${d.y0}em`, '--dx': `${d.dx}em`, '--dd': `${d.delay}s` } as CSSProperties
            }
          />
        ))}
      </span>
    </button>
  )
}
