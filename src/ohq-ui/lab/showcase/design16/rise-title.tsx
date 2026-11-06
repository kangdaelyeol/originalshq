import { useLayoutEffect, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { D16_T, EASE, play } from './d16-motion'

interface RiseTitleProps {
  text: string
  /** 오르기 시작(초) — null이면 바로 */
  delay?: number | null
  className?: string
}

/**
 * 큰 제목(16.8px) — 글자마다 가림 아래에서 올라온다(F80 'O' 윗부분 → F86 다 보임 → F90 제자리).
 * 가림 아래 끝은 글자 바닥선보다 3.5px 아래(F80~F85 글자 아래 끝이 y 61에서 잘린다).
 */
export function RiseTitle({ text, delay = D16_T.titleDelay, className }: RiseTitleProps) {
  const ref = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    if (delay === null) return
    const chars = ref.current?.querySelectorAll<HTMLElement>('.d16-rise__char') ?? []
    const anims = Array.from(chars, (ch, i) =>
      play(ch, [{ translate: '0 110%' }, { translate: '0 0' }], {
        duration: D16_T.titleRise,
        delay: delay + i * D16_T.titleStagger,
        easing: EASE.quartOut,
      }),
    )
    return () => anims.forEach((a) => a?.cancel())
  }, [delay, text])

  return (
    <h2 ref={ref} className={cx('d16-rise', className)} aria-label={text}>
      {Array.from(text, (ch, i) => (
        <span key={i} className="d16-rise__char" aria-hidden>
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </h2>
  )
}
