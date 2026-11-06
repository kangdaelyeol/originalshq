import { cx } from '../../../lib/cx'

interface BrainStatusBarProps {
  /** 분당 신호 수 — 장면 안에서는 엔진이 600ms마다 글자를 바로 고친다 */
  signals?: number
  /** 날아가는 중인 신호 수 */
  inFlight?: number
  /** 오른쪽 알약(영상은 "AU…"까지만 보인다) — 자동 둘러보기 켜짐 */
  autoTour?: boolean
  onAutoTourChange?: (on: boolean) => void
  className?: string
}

const fmt = (n: number) => n.toLocaleString('en-US')

/**
 * 위 줄 — "BRAIN · ● LIVE · 2,078 SIGNALS/MIN · 56 IN FLIGHT"와 오른쪽 알약.
 * 영상 F200(t=6.6): 줄 높이 95px(#0b0908 띠), 글자 가운데 y=47, 숫자는 흰 고정폭, 단위는 회색.
 */
export function BrainStatusBar({
  signals = 2078,
  inFlight = 56,
  autoTour,
  onAutoTourChange,
  className,
}: BrainStatusBarProps) {
  return (
    <div className={cx('d14-bar', className)}>
      <div className="d14-bar__left">
        <span className="d14-bar__brand">BRAIN</span>
        <span className="d14-bar__live">
          <i aria-hidden="true" />
          LIVE
        </span>
        <span className="d14-bar__stat">
          <b data-d14-signals="">{fmt(signals)}</b> SIGNALS/MIN
        </span>
        <span className="d14-bar__sep" aria-hidden="true">
          ·
        </span>
        <span className="d14-bar__stat">
          <b data-d14-flight="">{fmt(inFlight)}</b> IN FLIGHT
        </span>
      </div>
      {onAutoTourChange && (
        <button
          type="button"
          className="d14-bar__pill"
          aria-pressed={!!autoTour}
          onClick={(e) => {
            e.stopPropagation()
            onAutoTourChange(!autoTour)
          }}
        >
          <i aria-hidden="true" />
          AUTO TOUR
        </button>
      )}
    </div>
  )
}
