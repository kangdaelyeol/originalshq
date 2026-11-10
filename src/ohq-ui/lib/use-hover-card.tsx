import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { HoverCardPanel } from '../components/hover-card'
import { usePortalRoot } from './portal-root'

// 마우스를 올리고 이만큼 머물면 연다(표 위를 지나가며 스치는 칸마다 뜨지 않게).
const OPEN_DELAY = 250

export interface HoverCardAnchorProps {
  onPointerEnter: (event: PointerEvent<HTMLElement>) => void
  onPointerLeave: () => void
  onPointerDown: () => void
  /** pressable일 때만 — 누르면(탭·엔터) 열고 다시 누르면 닫는다 */
  onClick?: (event: MouseEvent<HTMLElement>) => void
  'aria-expanded'?: boolean
}

export interface HoverCardOptions {
  /**
   * 눌러도 연다 — 마우스가 없는 화면(태블릿)·키보드를 위해. 눌러 연 카드는 마우스가 떠나도 남고, 바깥을 누르거나
   * Esc·스크롤이면 닫힌다. 요소를 눌렀을 때 다른 일(편집 팝오버 등)을 하는 곳에는 쓰지 않는다.
   */
  pressable?: boolean
}

/**
 * 마우스를 올리면 뜨는 작은 설명 카드 — 요소 위에(자리가 없으면 아래) 화면 루트에 띄운다(스크롤되는 표 안에서
 * 잘리지 않게). 기본은 마우스로만 연다(터치는 누르면 편집 같은 다른 동작이 있다). 스크롤하거나 창 크기가 바뀌면
 * 닫는다. 카드는 누를 수 없는 설명이라 마우스가 요소를 떠나거나 요소를 누르면(편집 팝오버 등이 열린다) 바로
 * 닫힌다. pressable이면 누르는 것으로도 연다(options). content가 null이면 열지 않는다.
 *
 * 쓰는 법: 요소에 anchorProps를 펼치고 card를 그 안 어디든 그린다(포털이라 자리는 상관없다).
 */
export function useHoverCard(
  content: ReactNode | null,
  { pressable = false }: HoverCardOptions = {},
): { anchorProps: HoverCardAnchorProps; card: ReactNode } {
  const root = usePortalRoot()
  // pinned — 눌러서 연 카드(마우스가 떠나도 남는다)
  const [open, setOpen] = useState<{ anchor: HTMLElement; pinned: boolean } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(null)
    // 눌러 연 카드는 바깥을 누르거나 Esc면 닫는다 — 요소 자체를 누르면 onClick이 닫는다.
    const outside = (event: Event) => {
      if (!open.anchor.contains(event.target as Node)) close()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    if (open.pinned) {
      document.addEventListener('pointerdown', outside, true)
      document.addEventListener('keydown', escape)
    }
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const anchorProps: HoverCardAnchorProps = {
    onPointerEnter: (event) => {
      if (event.pointerType !== 'mouse' || content === null) return
      const anchor = event.currentTarget
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setOpen((s) => s ?? { anchor, pinned: false }), OPEN_DELAY)
    },
    onPointerLeave: () => {
      window.clearTimeout(timer.current)
      setOpen((s) => (s?.pinned ? s : null))
    },
    onPointerDown: () => {
      window.clearTimeout(timer.current)
      // 누르면 여는 요소는 onClick이 열고 닫는다.
      if (!pressable) setOpen(null)
    },
    ...(pressable
      ? {
          onClick: (event: MouseEvent<HTMLElement>) => {
            if (content === null) return
            const anchor = event.currentTarget
            setOpen((s) => (s?.pinned ? null : { anchor, pinned: true }))
          },
          'aria-expanded': open !== null,
        }
      : {}),
  }

  const card =
    open && content !== null
      ? createPortal(<HoverCardPanel anchor={open.anchor}>{content}</HoverCardPanel>, root ?? document.body)
      : null
  return { anchorProps, card }
}
