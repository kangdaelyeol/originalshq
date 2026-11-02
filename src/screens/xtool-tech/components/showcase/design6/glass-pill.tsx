import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { cx } from '../../../lib/cx'
import { FocusDotsIcon } from './focus-icons'
import type { FocusPillItem } from './glass-data'
import { animatePill, type PillPose } from './glass-motion'

interface GlassPillProps {
  item: FocusPillItem
  /** 켜짐(액체가 차고 빛남) — aria-pressed */
  lit: boolean
  /** 누르고 뗐을 때(마우스·키보드 Space/Enter) */
  onToggle?: () => void
  /** 판 위 자리(알약 중심의 국소 y, em) */
  slot?: number
  /** 견본·다시 보기용 강제 상태 — 주면 마우스·키보드 대신 이 값을 쓴다 */
  hovered?: boolean
  pressed?: boolean
  /** 영상처럼 판 전체를 같이 흔들 때(들림 = dip, 켜짐 = bounce) */
  onMotion?: (kind: 'dip' | 'bounce') => void
  disabled?: boolean
}

/**
 * 유리 알약 버튼(Design 6) — 판 평면(.d6-rig) 안에 놓는다.
 * - 마우스를 올리면(키보드 포커스도) 살짝 가라앉았다가 튀어 올라 뜨고, 바닥 모서리에 자기 색이 돈다.
 * - 누르면 판 속으로 눌렸다가, 떼면 튀어 오르며 하얗게 비고 → 옅은 색 → 짙은 색 → 빛 순서로 찬다.
 * - 다시 누르면 꺼진다(5프레임에 걸쳐 빠짐). 움직임은 glass-motion.ts, 색 순서는 _design6.scss.
 */
export function GlassPill({ item, lit, onToggle, slot = 0, hovered, pressed, onMotion, disabled }: GlassPillProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [hover, setHover] = useState(false)
  const [focusLift, setFocusLift] = useState(false)
  const [pressing, setPressing] = useState(false)
  // 떼는 순간 직접 켰으면, 뒤따르는 click은 건너뛴다(마우스 click의 detail ≥ 1, 키보드 click은 0)
  const handledRef = useRef(false)
  const last = useRef<{ pose: PillPose; litAtPress: boolean }>({ pose: 'rest', litAtPress: lit })
  const Icon = item.icon

  const isPressed = pressed ?? pressing
  const isHovered = hovered ?? (hover || focusLift)
  const pose: PillPose = isPressed ? 'pressed' : isHovered && !lit ? 'lifted' : 'rest'

  // 레이아웃 효과 — 클래스(색 순서 CSS 애니메이션)가 바뀌는 바로 그 프레임에 움직임도 시작한다
  useLayoutEffect(() => {
    const el = ref.current
    const prev = last.current
    if (!el || prev.pose === pose) return
    if (pose === 'pressed') prev.litAtPress = lit
    const activated = prev.pose === 'pressed' && lit && !prev.litAtPress
    const kind = animatePill(el, pose, prev.pose, activated)
    prev.pose = pose
    if (kind) onMotion?.(kind)
  }, [pose, lit, onMotion])

  const release = () => {
    setPressing(false)
    handledRef.current = true
    onToggle?.()
  }

  return (
    <button
      ref={ref}
      type="button"
      className={cx(
        'd6-pill',
        `d6-tone--${item.tone}`,
        lit && 'is-lit',
        pose === 'lifted' && 'is-lifted',
        pose === 'pressed' && 'is-pressed',
      )}
      style={{ '--d6-slot': `${slot}em`, '--d6-icon': `${item.iconSize}em` } as CSSProperties}
      aria-pressed={lit}
      disabled={disabled}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => {
        setHover(false)
        setPressing(false)
      }}
      onPointerDown={(e: PointerEvent) => {
        if (e.button !== 0) return
        handledRef.current = false
        setPressing(true)
      }}
      onPointerUp={(e: PointerEvent) => {
        if (e.button === 0 && pressing) release()
      }}
      onPointerCancel={() => setPressing(false)}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key !== ' ' && e.key !== 'Enter') return
        // 기본 동작(Enter의 즉시 click)을 막고, 뗄 때 켠다 — 마우스와 같은 순서(눌림 → 튀어 오름)
        e.preventDefault()
        if (!e.repeat) {
          handledRef.current = false
          setPressing(true)
        }
      }}
      onKeyUp={(e: KeyboardEvent) => {
        if ((e.key === ' ' || e.key === 'Enter') && pressing) {
          e.preventDefault()
          release()
        }
      }}
      onClick={() => {
        // 보조 기술의 click처럼 누름 없이 온 것만 여기서 켠다
        if (handledRef.current) handledRef.current = false
        else onToggle?.()
      }}
      onFocus={(e) => {
        if (e.currentTarget.matches(':focus-visible')) setFocusLift(true)
      }}
      onBlur={() => {
        setFocusLift(false)
        setPressing(false)
      }}
    >
      <span className="d6-pill__shadow" aria-hidden />
      <span className="d6-pill__under" aria-hidden />
      <span className="d6-pill__wall" aria-hidden />
      <span className="d6-pill__wall d6-pill__wall--tint" aria-hidden />
      <span className="d6-pill__walls-lit" aria-hidden>
        <span className="d6-pill__wall d6-pill__wall--deep" />
        <span className="d6-pill__wall d6-pill__wall--glow" />
      </span>
      <span className="d6-pill__top">
        <span className="d6-pill__fx d6-pill__glass" aria-hidden />
        <span className="d6-pill__liquid" aria-hidden>
          <span className="d6-pill__fx d6-pill__pale" />
          <span className="d6-pill__fx d6-pill__deep" />
          <span className="d6-pill__fx d6-pill__glow" />
          <span className="d6-pill__fx d6-pill__hot" />
        </span>
        <span className="d6-pill__fx d6-pill__lift" aria-hidden />
        <span className="d6-pill__fx d6-pill__shade" aria-hidden />
        <span className="d6-pill__fx d6-pill__flash" aria-hidden />
        <span className="d6-pill__fx d6-pill__veil" aria-hidden />
        <span className="d6-pill__fx d6-pill__rim" aria-hidden />
        <span className="d6-pill__fx d6-pill__tintline" aria-hidden />
        <span className="d6-pill__content">
          <Icon className="d6-pill__icon" />
          <span className="d6-pill__label">{item.label}</span>
          <FocusDotsIcon className="d6-pill__dots" />
        </span>
      </span>
    </button>
  )
}
