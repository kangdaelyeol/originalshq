import { useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

// viewBox 크기를 실제 렌더 픽셀 크기에 맞춰 1 유닛 = 1px로 둔다 — 고정 논리
// 크기(예: 1000×220)를 쓰고 preserveAspectRatio="none"으로 컨테이너에 맞춰
// 늘리면, 실제 렌더 비율이 그 논리 크기의 가로세로 비율과 달라 SVG 좌표계
// 전체가 가로/세로로 다르게 늘어난다 — stroke-width는 그대로인데 폭만 늘어난
// 것처럼 보여 글자·선이 옆으로 퍼져 보인다(use-index-line-chart-view-model.ts가
// 이미 같은 이유로 쓰고 있는 방식을 그대로 가져온다). 치수 측정 전(최초 렌더)
// 잠깐 쓰는 기본값일 뿐, 측정되는 즉시 실제 크기로 바뀐다.
const DEFAULT_VB_W = 600
const DEFAULT_VB_H = 200

/** roas-panel.tsx의 RoasTrendChart 전용 — SVG 캔버스의 실제 렌더 크기를 측정해
 * viewBox로 그대로 쓴다. 컨테이너 폭이 바뀌어도(사이드바 접힘, 창 크기 변경 등)
 * 폰트·여백 같은 절대 크기 요소는 그대로 유지되고 막대 간격만 늘어난다. */
export const useRoasTrendChartViewModel = () => {
  const ref = useRef<HTMLDivElement>(null)
  const [vbWidth, setVbWidth] = useState(DEFAULT_VB_W)
  const [vbHeight, setVbHeight] = useState(DEFAULT_VB_H)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = (rect: DOMRectReadOnly) => {
      if (rect.width > 0) setVbWidth(rect.width)
      if (rect.height > 0) setVbHeight(rect.height)
    }
    measure(el.getBoundingClientRect())
    // ResizeObserver 콜백의 setState는 React가 통제하는 이벤트 밖이라 비동기로
    // 커밋된다 — flushSync 없이 두면 viewBox가 한 프레임 뒤처진 채로 그려져
    // preserveAspectRatio="none"이 그 차이를 가로로 늘려버린다(use-index-line
    // -chart-view-model.ts와 같은 이유로 같은 방식으로 막는다).
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return
      flushSync(() => measure(entry.contentRect))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return { ref, vbWidth, vbHeight }
}
