import { cx } from '../../../lib/cx'

export type NodeState = 'idle' | 'focused' | 'dim'

interface HubNodeProps {
  /** 자리 수(머리 포함) — 고리 안 숫자 */
  count: number
  name: string
  sub: string
  /**
   * idle = 전체 보기(주황 고리·어두운 속), focused = 초점(주황으로 채움·노을빛), dim = 다른 부서에 초점(흐리게).
   * 바뀔 때 110ms(t=30.40 한 프레임에 반쯤 바뀐다)
   */
  state?: NodeState
  onSelect?: () => void
  tabIndex?: number
  className?: string
}

/** 부서 고리 — 가운데가 자기 자리(0,0). 크기는 em(1em = 영상 10px), 부모가 위치·배율을 정한다. */
export function HubNode({ count, name, sub, state = 'idle', onSelect, tabIndex, className }: HubNodeProps) {
  return (
    <button
      type="button"
      className={cx('d14-hub', className)}
      data-state={state}
      tabIndex={tabIndex}
      aria-label={`${name} — ${sub}, ${count} seats`}
      aria-pressed={state === 'focused'}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.()
      }}
    >
      <span className="d14-hub__halo" aria-hidden="true" />
      <span className="d14-hub__glow" aria-hidden="true" />
      <span className="d14-hub__ring" aria-hidden="true" />
      <span className="d14-hub__count" aria-hidden="true">
        {count}
      </span>
      <span className="d14-hub__label" aria-hidden="true">
        <span className="d14-hub__name">{name}</span>
        <span className="d14-hub__sub">{sub}</span>
      </span>
    </button>
  )
}
