import { useLayoutEffect, useRef, useState } from 'react'

// 크기를 재는 요소마다 감시자(ResizeObserver)를 따로 만들지 않고 하나를 같이
// 쓴다 — 작은 추이 그래프(Sparkline)가 한 화면에 수십 개라, 감시자가 하나면
// 크기가 바뀔 때 브라우저가 콜백을 한 번에 모아 부른다.
type Listener = (size: { width: number; height: number }) => void
const listeners = new Map<Element, Listener>()
let shared: ResizeObserver | null = null

const observe = (element: Element, listener: Listener) => {
  shared ??= new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.target.getBoundingClientRect()
      listeners.get(entry.target)?.({ width, height })
    }
  })
  listeners.set(element, listener)
  shared.observe(element)
  return () => {
    listeners.delete(element)
    shared?.unobserve(element)
  }
}

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
    const update = ({ width, height }: { width: number; height: number }) =>
      setSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      )
    update(element.getBoundingClientRect())
    return observe(element, update)
  }, [])

  return [ref, size] as const
}
