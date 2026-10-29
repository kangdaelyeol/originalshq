import { useLayoutEffect, useRef, useState } from 'react'

/**
 * 요소의 실제 크기(px) — 그래프를 그 크기 그대로의 좌표로 그리려고. viewBox를
 * 늘려 맞추면(preserveAspectRatio="none") 가로세로가 다르게 늘어나 곡선이
 * 찌그러지고 굽는 곳이 각져 보인다.
 */
export const useElementSize = <T extends Element>() => {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => {
      const { width, height } = element.getBoundingClientRect()
      setSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, size] as const
}
