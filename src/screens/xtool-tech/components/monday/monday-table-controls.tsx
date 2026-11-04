import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { cx } from '@/ohq-ui/lib/cx'
import { MIN_WIDTH, type MonSort } from './monday-values'

// Monday 표의 작은 부품 — 칸 너비 손잡이·정렬 단추(머리글), 줄 고르기 체크박스(머리글·줄).

/** 칸 머리글 오른쪽 끝을 끌어 너비를 바꾼다. */
export function ResizeHandle({ id, width, onResize }: { id: string; width: number; onResize: (id: string, width: number) => void }) {
  const start = useRef<{ x: number; width: number } | null>(null)
  return (
    <span
      className="mon-resize"
      aria-hidden
      onPointerDown={(e: ReactPointerEvent) => {
        e.preventDefault()
        e.stopPropagation()
        start.current = { x: e.clientX, width }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!start.current) return
        onResize(id, Math.max(MIN_WIDTH, start.current.width + e.clientX - start.current.x))
      }}
      onPointerUp={() => {
        start.current = null
      }}
      // 끌다가 포인터를 놓쳐도(창 밖·취소) 다음 움직임이 너비를 바꾸지 않게
      onPointerCancel={() => {
        start.current = null
      }}
      onLostPointerCapture={() => {
        start.current = null
      }}
    />
  )
}

/** 줄 고르기 체크박스(Monday) — 머리글은 그룹 전체, 일부만 골랐으면 가운데 선(indeterminate). */
export function RowCheck({ checked, mixed, label, onChange }: { checked: boolean; mixed?: boolean; label: string; onChange: (on: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(mixed)
  }, [mixed])
  return (
    <input
      ref={ref}
      type="checkbox"
      className="mon-check-row"
      checked={checked}
      aria-label={label}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

/** 머리글에 올리면 위 테두리에 걸쳐 뜨는 정렬 단추(Monday) — 정렬 중이면 늘 보이고 방향 삼각형이 밝다. */
export function SortButton({ id, title, sort, onSort }: { id: string; title: string; sort: MonSort; onSort: (id: string) => void }) {
  const dir = sort?.columnId === id ? sort.dir : 0
  return (
    <button
      type="button"
      className={cx('mon-sort', dir === 1 && 'is-asc', dir === -1 && 'is-desc')}
      aria-label={`${title} ${dir === 1 ? '내림차순으로' : dir === -1 ? '정렬 해제' : '오름차순으로'} 정렬`}
      title={dir === 1 ? '오름차순 — 누르면 내림차순' : dir === -1 ? '내림차순 — 누르면 정렬 해제' : '정렬'}
      onClick={() => onSort(id)}
    >
      <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden>
        <path className="mon-sort__up" d="M4 0.5 7.5 5H0.5z" />
        <path className="mon-sort__down" d="M4 11.5 0.5 7h7z" />
      </svg>
    </button>
  )
}
