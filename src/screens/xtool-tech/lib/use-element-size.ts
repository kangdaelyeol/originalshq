import { useEffect, useRef, useState, type RefObject } from 'react'

export interface ElementSize {
  width: number
  height: number
}

/** 요소의 레이아웃 크기(테두리 상자, transform 영향 없음)를 따라간다 — SVG 차트를 픽셀
 * 그대로 그리거나, 크기에 맞춘 clip-path·외곽선을 만들 때 쓴다. */
export function useElementSize<T extends HTMLElement>(): [RefObject<T | null>, ElementSize] {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // observe()는 시작하자마자 현재 크기로 콜백을 한 번 부른다 — 첫 크기도 여기서 받는다.
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.borderBoxSize?.[0]
      const width = Math.round(box ? box.inlineSize : entry.contentRect.width)
      const height = Math.round(box ? box.blockSize : entry.contentRect.height)
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, size]
}
