import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { cx } from '../../../lib/cx'
import { washScene } from './glass-motion'

interface LiquidGlassSceneProps {
  /** 어두운 장면(방해 금지가 켜졌을 때) — 4프레임에 걸쳐 넘어간다 */
  dark: boolean
  className?: string
  children: ReactNode
}

/**
 * 알약 무대(Design 6) — 밝은 회색 바탕(오른쪽에서 빛)과 어두운 바탕(오른쪽 아래에서 빛)을 겹쳐 두고
 * --d6-dark 하나로 바탕·판·알약 색을 함께 넘긴다. 크기는 글자 크기(1em = 영상 10px)를 따른다.
 */
export function LiquidGlassScene({ dark, className, children }: LiquidGlassSceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const first = useRef(true)

  // 밝기가 바뀌는 그 프레임에 알약을 잠깐 흐리게(처음 그릴 때는 건너뛴다)
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (ref.current) washScene(ref.current, dark)
  }, [dark])

  return (
    <div ref={ref} className={cx('d6-scene', dark && 'is-dark', className)}>
      <div className="d6-scene__bg d6-scene__bg--light" aria-hidden />
      <div className="d6-scene__bg d6-scene__bg--dark" aria-hidden />
      {children}
    </div>
  )
}
