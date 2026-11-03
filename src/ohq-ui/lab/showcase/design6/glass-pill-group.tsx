import { useCallback, useRef } from 'react'
import { GlassPill } from './glass-pill'
import { GlassPlate } from './glass-plate'
import { FOCUS_PILLS, PILL_PITCH, type FocusPillItem } from './glass-data'
import { animateBoard } from './glass-motion'
import { PillGlow } from './pill-glow'

export interface GlassDemoState {
  hover: string | null
  press: string | null
}

interface GlassPillGroupProps {
  value: string | null
  /** 누른 알약(이미 켜진 걸 누르면 null) */
  onChange: (key: string | null) => void
  items?: readonly FocusPillItem[]
  /** 다시 보기 대본 — 주면 마우스 대신 이 값으로 들리고 눌린다 */
  demo?: GlassDemoState | null
  ariaLabel?: string
}

/**
 * 유리 판 위 알약 묶음(Design 6) — 한 번에 하나만 켜진다(다시 누르면 꺼짐).
 * 알약이 들리거나 켜질 때 판 전체가 영상처럼 출렁인다(.d6-camera). 판 평면은 .d6-rig.
 */
export function GlassPillGroup({
  value,
  onChange,
  items = FOCUS_PILLS,
  demo,
  ariaLabel = '집중 모드',
}: GlassPillGroupProps) {
  const cameraRef = useRef<HTMLDivElement>(null)
  const onMotion = useCallback((kind: 'dip' | 'bounce') => {
    if (cameraRef.current) animateBoard(cameraRef.current, kind)
  }, [])
  const mid = (items.length - 1) / 2
  const slotOf = (i: number) => (i - mid) * PILL_PITCH

  return (
    <div className="d6-camera" ref={cameraRef}>
      <div className="d6-rig" role="group" aria-label={ariaLabel}>
        <GlassPlate rows={items.length} />
        {items.map((item, i) => (
          <PillGlow key={item.key} variant="halo" tone={item.tone} lit={value === item.key} slot={slotOf(i)} />
        ))}
        {items.map((item, i) => (
          <GlassPill
            key={item.key}
            item={item}
            slot={slotOf(i)}
            lit={value === item.key}
            onToggle={() => onChange(value === item.key ? null : item.key)}
            hovered={demo ? demo.hover === item.key : undefined}
            pressed={demo ? demo.press === item.key : undefined}
            onMotion={onMotion}
          />
        ))}
        {items.map((item, i) => (
          <PillGlow key={item.key} variant="bloom" tone={item.tone} lit={value === item.key} slot={slotOf(i)} />
        ))}
      </div>
    </div>
  )
}
