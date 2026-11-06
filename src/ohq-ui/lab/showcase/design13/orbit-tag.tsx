import type { CSSProperties, HTMLAttributes } from 'react'
import { cx } from '../../../lib/cx'

interface OrbitTagProps extends HTMLAttributes<HTMLSpanElement> {
  /** 세 글자 — 판정 종류 앞 글자(SCO·CHO·NOU) */
  text: string
  /** 기울기(°) — 장면에서는 엔진이 ±7°로 까딱인다 */
  tilt?: number
}

/** 카드 바깥에 따라붙는 분홍 네모 이름표(13.5px, 1px 분홍 테두리, 5px 글자) */
export function OrbitTag({ text, tilt = 0, className, style, ...rest }: OrbitTagProps) {
  return (
    <span className={cx('d13-tag', className)} style={{ rotate: `${tilt}deg`, ...style } as CSSProperties} {...rest}>
      <span className="d13-tag__text">{text}</span>
    </span>
  )
}
