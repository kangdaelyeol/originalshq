import './auto-height.scss'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 내용 높이를 따라 부드럽게 늘었다 줄었다 하는 상자 — 불러오는 중(짧은 자리)에서
 * 다 받은 내용(긴 목록)으로 바뀔 때 툭 튀지 않고 자라게 한다. 안의 높이를 재서
 * 바깥 높이로 주고, 그 사이를 transition으로 잇는다.
 *
 * 새로 나타나는 내용에 glass_reveal 클래스를 붙이면 높이가 자라는 동안 흐릿하게
 * 있다가 선명해진다(auto-height.scss).
 */
export const AutoHeight = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => {
  const innerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    const inner = innerRef.current
    if (!inner) return
    const measure = () => setHeight(inner.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      className={['glass_auto_height', className ?? ''].join(' ').trim()}
      style={height === null ? undefined : { height }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  )
}
