import type { HTMLAttributes } from 'react'
import { cx } from '../../../lib/cx'

interface ChipNodeProps extends HTMLAttributes<HTMLDivElement> {
  /** 가운데 큰 글자(영상: JEV) */
  label?: string
  /** 아래 번호 — 장면에서는 엔진이 사건마다 고친다 */
  serial?: number
  /** 둘레 핀·점 고리가 돌지 않게(정지 그림) */
  still?: boolean
}

const PINS = Array.from({ length: 12 }, (_, i) => i * 30)
const DOTS = Array.from({ length: 24 }, (_, i) => i * 15)

/**
 * 가운데 칩 — 분홍 테두리가 빛나는 둥근 네모, 둘레에 핀 12개(선 + 끝 점)와 바깥 작은 점 24개.
 * 칩은 숨쉬지 않는다(테두리 밝기 228프레임 내내 같다). 핀 고리는 시계 반대로 230°/초, 점 고리는 시계 방향
 * 158°/초로 돌고(둘 다 CSS 애니메이션), 둘 다 세로로 0.92배 눌려 있다(핀 끝: 옆 50px · 위아래 46px).
 */
export function ChipNode({ label = 'JEV', serial = 1, still, className, ...rest }: ChipNodeProps) {
  return (
    <div className={cx('d13-chip', still && 'is-still', className)} {...rest}>
      <div className="d13-chip__ring d13-chip__ring--dots" aria-hidden>
        <div className="d13-chip__spin">
          {DOTS.map((deg) => (
            <i key={deg} style={{ rotate: `${deg}deg` }} />
          ))}
        </div>
      </div>
      <div className="d13-chip__ring d13-chip__ring--pins" aria-hidden>
        <div className="d13-chip__spin">
          {PINS.map((deg) => (
            <i key={deg} style={{ rotate: `${deg}deg` }} />
          ))}
        </div>
      </div>
      <div className="d13-chip__body">
        <span className="d13-chip__label">{label}</span>
        <span className="d13-chip__serial" data-d13-serial>
          #{String(serial).padStart(3, '0')}
        </span>
      </div>
    </div>
  )
}
