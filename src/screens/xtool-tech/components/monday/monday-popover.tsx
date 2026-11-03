import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '@/ohq-ui/lib/cx'
import { usePortalRoot } from '@/ohq-ui/lib/portal-root'

// 화면 가장자리와 띄울 여백
const EDGE = 8
// 칸과 팝오버 사이
const GAP = 4

interface MonPopoverProps {
  /** 이 칸 아래(자리가 모자라면 위)에 띄운다. */
  anchor: HTMLElement
  width: number
  /** 바깥을 누르거나 Esc — commit이면 고친 값을 저장한다. */
  onClose: (commit: boolean) => void
  /** Esc로 닫을 때도 저장할지 — 고르는 칸(상태·사람 등)은 저장, 글을 쓰는 칸은 취소 */
  escapeCommits?: boolean
  className?: string
  children: ReactNode
}

/**
 * 칸 편집 팝오버 — 표는 자기 안에서 스크롤돼서(칸 밖이 잘린다) 화면 루트에 띄우고, 표가
 * 스크롤되거나 창 크기가 바뀌면 칸을 따라간다.
 */
export function MonPopover({ anchor, width, onClose, escapeCommits = true, className, children }: MonPopoverProps) {
  const root = usePortalRoot()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number } | null>(null)
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useLayoutEffect(() => {
    const place = () => {
      const rect = anchor.getBoundingClientRect()
      const left = Math.min(Math.max(EDGE, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - EDGE)
      const below = window.innerHeight - rect.bottom - GAP - EDGE
      const above = rect.top - GAP - EDGE
      // 아래 자리가 모자라고 위가 더 넓으면 위로
      if (below < 280 && above > below) setPos({ left, bottom: window.innerHeight - rect.top + GAP, maxHeight: above })
      else setPos({ left, top: rect.bottom + GAP, maxHeight: below })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [anchor, width])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target) || anchor.contains(target)) return
      onCloseRef.current(true)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCloseRef.current(escapeCommits)
      anchor.focus()
    }
    document.addEventListener('pointerdown', onDown)
    // 잡기 단계 — 팝오버 안 키 이벤트는 React 쪽에서 막아 버려서(아래 onKeyDown) 올라오지 않는다.
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [anchor, escapeCommits])

  // 처음 열릴 때 첫 입력 칸(없으면 첫 버튼)으로
  useEffect(() => {
    const el = ref.current
    const first = el?.querySelector<HTMLElement>('input:not([type="checkbox"]), textarea') ?? el?.querySelector<HTMLElement>('button')
    first?.focus({ preventScroll: true })
  }, [])

  return createPortal(
    <div
      ref={ref}
      className={cx('mon-popover', className)}
      role="dialog"
      // 포털이어도 React 이벤트는 칸으로 올라간다 — 칸의 클릭·엔터(편집 시작)가 다시 돌지 않게.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      style={{ width, left: pos?.left, top: pos?.top, bottom: pos?.bottom, maxHeight: pos?.maxHeight, visibility: pos ? 'visible' : 'hidden' }}
    >
      {children}
    </div>,
    root ?? document.body,
  )
}
