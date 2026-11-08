// 신호 그래프(signal-graph.tsx)의 크기 — 노드 크기와 그림 틀 폭 재기. 그래프와
// 배치를 정하는 흐름 그림(flow-graphs.tsx)이 같이 쓴다.
import { useEffect, useState, type RefObject } from 'react'

/** 그림 좌표 1의 화면 픽셀 — 노드·글자 크기를 화면 폭과 상관없이 이 크기로
 * 둔다(본문이 1320px일 때 폭 1000 그림이 1290px로 그려지던 크기). */
export const GRAPH_SCALE = 1.29

/** 요소의 폭(px) — 크기가 바뀔 때마다(ResizeObserver) 다시 잰다. 재기 전에는 0. */
export const useElementWidth = (ref: RefObject<HTMLElement | null>): number => {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}
