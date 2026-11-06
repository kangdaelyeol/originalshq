import { cx } from '../../../lib/cx'
import { YOU } from './design14-data'
import type { NodeState } from './hub-node'

interface YouNodeProps {
  /** 기다리는 자리 수 — 금빛 배지(영상 3). 0이면 배지를 숨긴다 */
  badge?: number
  name?: string
  sub?: string
  state?: NodeState
  onSelect?: () => void
  tabIndex?: number
  className?: string
}

/** 창업자 — 밝은 회백 원 안에 "YOU", 오른쪽 위 금빛 배지, 아래 이름. 가운데가 (0,0). */
export function YouNode({
  badge = 0,
  name = YOU.name,
  sub = YOU.sub,
  state = 'idle',
  onSelect,
  tabIndex,
  className,
}: YouNodeProps) {
  return (
    <button
      type="button"
      className={cx('d14-you', className)}
      data-state={state}
      tabIndex={tabIndex}
      aria-label={`${name} — ${sub}${badge ? `, ${badge} waiting on you` : ''}`}
      aria-pressed={state === 'focused'}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.()
      }}
    >
      {/* 원·배지 — 초점이면 함께 1.63배(음성 화면 YOU 원 지름 3.9em, F660) */}
      <span className="d14-you__mark" aria-hidden="true">
        <span className="d14-you__halo" />
        <span className="d14-you__disc">YOU</span>
        {badge > 0 && <span className="d14-you__badge">{badge}</span>}
      </span>
      <span className="d14-you__label" aria-hidden="true">
        <span className="d14-you__name">{name}</span>
        <span className="d14-you__sub">{sub}</span>
      </span>
    </button>
  )
}
