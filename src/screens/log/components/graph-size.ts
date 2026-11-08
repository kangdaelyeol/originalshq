// 신호 그래프(signal-graph.tsx)의 크기 — 노드 크기와 그림 틀 폭 재기. 그래프와
// 배치를 정하는 흐름 그림(flow-graphs.tsx)이 같이 쓴다.
import { useEffect, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'

/** 그림 좌표 1의 화면 픽셀 — 노드·글자 크기를 화면 폭과 상관없이 이 크기로
 * 둔다(본문이 1320px일 때 폭 1000 그림이 1290px로 그려지던 크기). */
export const GRAPH_SCALE = 1.29

/** 요소의 폭(px) — 크기가 바뀔 때마다(ResizeObserver) 다시 잰다. 재기 전에는 0.
 * 바뀐 폭은 그 자리에서 다시 그린다(flushSync): 그림(SVG)은 틀 폭을 따라 바로
 * 늘었다 줄었다 하는데, 새 배치를 다음 프레임으로 미루면 그 한두 프레임 동안
 * 노드가 늘어난 채 보였다가 제자리로 튀어 늦게 따라오는 것처럼 보인다.
 * ResizeObserver는 그리기 전에 불려서 여기서 그리면 같은 프레임에 맞는다. */
export const useElementWidth = (ref: RefObject<HTMLElement | null>): number => {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width)
      flushSync(() => setWidth(next))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}
