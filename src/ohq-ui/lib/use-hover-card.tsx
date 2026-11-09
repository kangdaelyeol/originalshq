import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { HoverCardPanel } from '../components/hover-card'
import { usePortalRoot } from './portal-root'

// 마우스를 올리고 이만큼 머물면 연다(표 위를 지나가며 스치는 칸마다 뜨지 않게).
const OPEN_DELAY = 250

export interface HoverCardAnchorProps {
  onPointerEnter: (event: PointerEvent<HTMLElement>) => void
  onPointerLeave: () => void
  onPointerDown: () => void
}

/**
 * 마우스를 올리면 뜨는 작은 설명 카드 — 요소 위에(자리가 없으면 아래) 화면 루트에 띄운다(스크롤되는 표 안에서
 * 잘리지 않게). 마우스로만 연다(터치는 누르면 편집 같은 다른 동작이 있다). 스크롤하거나 창 크기가 바뀌면 닫는다.
 * 카드는 누를 수 없는 설명이라 마우스가 요소를 떠나거나 요소를 누르면(편집 팝오버 등이 열린다) 바로 닫힌다.
 * content가 null이면 열지 않는다.
 *
 * 쓰는 법: 요소에 anchorProps를 펼치고 card를 그 안 어디든 그린다(포털이라 자리는 상관없다).
 */
export function useHoverCard(content: ReactNode | null): { anchorProps: HoverCardAnchorProps; card: ReactNode } {
  const root = usePortalRoot()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (!anchor) return
    const close = () => setAnchor(null)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [anchor])

  const close = () => {
    window.clearTimeout(timer.current)
    setAnchor(null)
  }
  const anchorProps: HoverCardAnchorProps = {
    onPointerEnter: (event) => {
      if (event.pointerType !== 'mouse' || content === null) return
      const el = event.currentTarget
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setAnchor(el), OPEN_DELAY)
    },
    onPointerLeave: close,
    onPointerDown: close,
  }

  const card =
    anchor && content !== null
      ? createPortal(<HoverCardPanel anchor={anchor}>{content}</HoverCardPanel>, root ?? document.body)
      : null
  return { anchorProps, card }
}
