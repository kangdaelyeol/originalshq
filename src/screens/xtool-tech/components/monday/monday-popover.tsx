import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '@/ohq-ui/lib/cx'
import { usePortalRoot } from '@/ohq-ui/lib/portal-root'

// 화면 가장자리와 띄울 여백
const EDGE = 8
// 칸과 팝오버 사이
const GAP = 4

// 팝오버 안에서 연 팝오버(달력의 월·연도 드롭다운 등) — 둘 다 화면 루트에 따로 떠서, 바깥 팝오버는 안쪽을
// 누르거나 Esc가 와도 닫히지 않고 안쪽에 양보한다.
const NestedPopovers = createContext<Set<HTMLElement> | null>(null)

interface MonPopoverProps {
  /** 이 칸 아래(자리가 모자라면 위)에 띄운다. */
  anchor: HTMLElement
  width: number
  /** 바깥을 누르거나 Esc — commit이면 고친 값을 저장한다. */
  onClose: (commit: boolean) => void
  /** Esc로 닫을 때도 저장할지 — 고르는 칸(상태·사람 등)은 저장, 글을 쓰는 칸은 취소 */
  escapeCommits?: boolean
  /** 칸 가운데에 맞출지(기본), 왼쪽 끝에 맞출지(드롭다운) */
  align?: 'center' | 'start'
  className?: string
  children: ReactNode
}

/**
 * 칸 편집 팝오버 — 표는 자기 안에서 스크롤돼서(칸 밖이 잘린다) 화면 루트에 띄우고, 표가
 * 스크롤되거나 창 크기가 바뀌면 칸을 따라간다.
 */
export function MonPopover({
  anchor,
  width,
  onClose,
  escapeCommits = true,
  align = 'center',
  className,
  children,
}: MonPopoverProps) {
  const root = usePortalRoot()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number } | null>(null)
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  const parent = useContext(NestedPopovers)
  const [nested] = useState(() => new Set<HTMLElement>())
  useLayoutEffect(() => {
    const el = ref.current
    if (!parent || !el) return
    parent.add(el)
    return () => {
      parent.delete(el)
    }
  }, [parent])

  useLayoutEffect(() => {
    const place = () => {
      const rect = anchor.getBoundingClientRect()
      const start = align === 'start' ? rect.left : rect.left + rect.width / 2 - width / 2
      const left = Math.min(Math.max(EDGE, start), window.innerWidth - width - EDGE)
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
  }, [anchor, width, align])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target) || anchor.contains(target)) return
      for (const el of nested) if (el.contains(target)) return
      onCloseRef.current(true)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // 팝오버 안의 펼친 목록(주소 검색 결과 등)이나 안에서 연 팝오버가 있으면 그것만 닫히게 양보한다(편집 판
      // DrawerShell과 같은 규칙).
      if (nested.size > 0 || ref.current?.querySelector('[data-popover-open]')) return
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
  }, [anchor, escapeCommits, nested])

  // 처음 열릴 때 첫 입력 칸(없으면 첫 버튼)으로 — 자리를 잡아 보이게 된 뒤에 한 번(숨겨진 동안에는
  // visibility: hidden이라 초점이 들어가지 않는다)
  const focused = useRef(false)
  useEffect(() => {
    if (!pos || focused.current) return
    focused.current = true
    const el = ref.current
    const first = el?.querySelector<HTMLElement>('input:not([type="checkbox"]), textarea') ?? el?.querySelector<HTMLElement>('button')
    first?.focus({ preventScroll: true })
  }, [pos])

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
      <NestedPopovers.Provider value={nested}>{children}</NestedPopovers.Provider>
    </div>,
    root ?? document.body,
  )
}
