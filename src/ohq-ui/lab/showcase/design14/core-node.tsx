import { cx } from '../../../lib/cx'
import { CORE } from './design14-data'

interface CoreNodeProps {
  name?: string
  sub?: string
  /** 원 안 글자 */
  label?: string
  /** 부서나 YOU에 초점일 때 흐리게 */
  dim?: boolean
  onSelect?: () => void
  tabIndex?: number
  className?: string
}

/** 지식 코어 — 금빛 원(반지름 16w, t=2.0 F61) 안에 "CORE", 아래에 이름. 가운데가 (0,0). */
export function CoreNode({
  name = CORE.name,
  sub = CORE.sub,
  label = CORE.label,
  dim = false,
  onSelect,
  tabIndex,
  className,
}: CoreNodeProps) {
  return (
    <button
      type="button"
      className={cx('d14-core', className)}
      data-dim={dim || undefined}
      tabIndex={tabIndex}
      aria-label={`${name} — ${sub}`}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.()
      }}
    >
      <span className="d14-core__halo" aria-hidden="true" />
      <span className="d14-core__disc" aria-hidden="true">
        {label}
      </span>
      <span className="d14-core__label" aria-hidden="true">
        <span className="d14-core__name">{name}</span>
        <span className="d14-core__sub">{sub}</span>
      </span>
    </button>
  )
}
