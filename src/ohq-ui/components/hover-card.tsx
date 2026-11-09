import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

// 화면 가장자리와 띄울 여백
const EDGE = 8
// 요소와 카드 사이
const GAP = 6

/** 마우스 오버 카드의 판 — 요소 위에(자리가 없으면 아래) 띄운다. 여는 쪽은 lib/use-hover-card. */
export function HoverCardPanel({ anchor, children }: { anchor: HTMLElement; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // 카드 크기를 재고 자리를 정한다 — 그 전에는 보이지 않게 그려 둔다.
  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current
      if (!el) return
      const rect = anchor.getBoundingClientRect()
      const width = el.offsetWidth
      const height = el.offsetHeight
      const center = rect.left + rect.width / 2 - width / 2
      const left = Math.min(Math.max(EDGE, center), window.innerWidth - width - EDGE)
      const above = rect.top - GAP - height
      setPos({ left, top: above >= EDGE ? above : rect.bottom + GAP })
    }
    place()
  }, [anchor])

  return (
    <div
      ref={ref}
      className="hover-card"
      role="tooltip"
      style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}
    >
      {children}
    </div>
  )
}
