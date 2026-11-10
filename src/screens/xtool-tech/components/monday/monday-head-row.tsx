import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { TechColumn } from '@xtool-core/tech-boards'
import { isTimelineColumn, TIMELINE_ID } from '@xtool-core/tech-timeline'
import { cx } from '@/ohq-ui/lib/cx'
import { ResizeHandle, SortButton } from './monday-table-controls'
import type { MonSort } from './monday-values'

// Monday 표 칸 머리글 줄 — 이름 칸(children)·칸 머리글(정렬 단추·너비 손잡이)·끝 칸. 머리글을 1초 꾹 누르면 칸 순서
// 바꾸기가 켜지고(그 손가락·마우스 그대로) 끌어 옮긴다. 켜져 있는 동안은 아무 머리글이나 누르면 바로 끌린다. 놓을 자리는
// 머리글 사이 세로 선으로 보이고, 표 가장자리로 끌면 옆으로 굴러간다. 순서는 칸 단위로 — 타임라인 칸들은 한 덩이로
// 옮긴다(xtool-core column-order). 이름 칸은 옮기지 않는다.

// 꾹 누르는 시간
const LONG_PRESS_MS = 1000
// 누르는 동안 이만큼 움직이면 꾹 누르기가 아니다(옆으로 굴리기·너비 바꾸기 등)
const MOVE_SLOP = 6
// 이 안쪽으로 끌면 옆으로 굴린다(표 가장자리·이름 칸 오른쪽에서)
const SCROLL_EDGE = 48
const MAX_SCROLL_STEP = 24

/** 칸 순서 바꾸기 — MondaySection이 준다 */
export interface ColumnReorder {
  /** 순서 바꾸는 중 */
  active: boolean
  /** 꾹 눌러 켠다 */
  start: () => void
  /** 칸 id → 칸 단위(타임라인 칸은 TIMELINE_ID) */
  unitOf: (columnId: string) => string
  /** 칸 단위를 before 앞으로(null이면 맨 끝으로) */
  move: (unit: string, before: string | null) => void
}

interface Press {
  el: HTMLElement
  pointerId: number
  x: number
  y: number
  lastX: number
  unit: string
  title: string
  dragging: boolean
  timer?: number
}

/** 끄는 동안 보이는 것 — 놓을 자리 선(line)과 따라오는 이름표(x), 줄 왼쪽에서 잰 px */
interface DragView {
  unit: string
  title: string
  x: number
  line: number
  before: string | null
}

const ariaSort = (sort: MonSort, id: string) =>
  sort?.columnId === id ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined

interface HeadRowProps {
  columns: TechColumn[]
  sort: MonSort
  onSort: (columnId: string) => void
  widthOf: (id: string) => number
  onResize: (id: string, width: number) => void
  reorder: ColumnReorder
  /** 이름 칸 머리글 */
  children: ReactNode
}

export function HeadRow({ columns, sort, onSort, widthOf, onResize, reorder, children }: HeadRowProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const press = useRef<Press | null>(null)
  const dragRef = useRef<DragView | null>(null)
  const frame = useRef(0)
  const [drag, setDrag] = useState<DragView | null>(null)

  useEffect(
    () => () => {
      window.clearTimeout(press.current?.timer)
      cancelAnimationFrame(frame.current)
    },
    [],
  )

  // 머리글 자리를 재어 놓을 자리를 정한다 — 칸 단위마다 왼쪽·오른쪽 끝(타임라인을 펼쳤으면 여러 칸이 한 단위)
  const measure = (clientX: number) => {
    const row = rowRef.current
    const p = press.current
    if (!row || !p) return
    const spans = new Map<string, { left: number; right: number }>()
    row.querySelectorAll<HTMLElement>('[data-unit]').forEach((el) => {
      const unit = el.dataset.unit as string
      const rect = el.getBoundingClientRect()
      const span = spans.get(unit)
      spans.set(
        unit,
        span
          ? { left: Math.min(span.left, rect.left), right: Math.max(span.right, rect.right) }
          : { left: rect.left, right: rect.right },
      )
    })
    let before: string | null = null
    let line: number | null = null
    for (const [unit, span] of spans) {
      if (unit === p.unit) continue
      if (clientX < (span.left + span.right) / 2) {
        before = unit
        line = span.left
        break
      }
    }
    if (line === null) line = Math.max(0, ...[...spans.values()].map((span) => span.right))
    const left = row.getBoundingClientRect().left
    const view = { unit: p.unit, title: p.title, x: clientX - left, line: line - left, before }
    dragRef.current = view
    setDrag(view)
  }

  // 표 가장자리(왼쪽은 붙어 있는 이름 칸 오른쪽)로 끌면 옆으로 굴린다 — 멈춰 있어도 계속
  const autoScroll = () => {
    frame.current = 0
    const p = press.current
    const row = rowRef.current
    const scroller = row?.closest<HTMLElement>('.mon-scroll')
    if (!p?.dragging || !row || !scroller) return
    const rect = scroller.getBoundingClientRect()
    const leftEdge = row.querySelector<HTMLElement>('.mon-cell--name')?.getBoundingClientRect().right ?? rect.left
    const over =
      p.lastX < leftEdge + SCROLL_EDGE
        ? p.lastX - (leftEdge + SCROLL_EDGE)
        : p.lastX > rect.right - SCROLL_EDGE
          ? p.lastX - (rect.right - SCROLL_EDGE)
          : 0
    if (over === 0) return
    const before = scroller.scrollLeft
    scroller.scrollLeft += Math.max(-MAX_SCROLL_STEP, Math.min(MAX_SCROLL_STEP, Math.round(over / 3)))
    if (scroller.scrollLeft === before) return
    measure(p.lastX)
    frame.current = requestAnimationFrame(autoScroll)
  }

  const end = (commit: boolean) => {
    const p = press.current
    if (!p) return
    window.clearTimeout(p.timer)
    press.current = null
    cancelAnimationFrame(frame.current)
    frame.current = 0
    if (p.el.hasPointerCapture(p.pointerId)) p.el.releasePointerCapture(p.pointerId)
    const view = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (commit && p.dragging && view) reorder.move(p.unit, view.before)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>, unit: string, title: string) => {
    if (e.button !== 0 || press.current) return
    // 정렬 단추·너비 손잡이는 제 일만
    if ((e.target as HTMLElement).closest('.mon-sort, .mon-resize')) return
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const p: Press = {
      el,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      unit,
      title,
      dragging: false,
    }
    press.current = p
    if (reorder.active) {
      p.dragging = true
      measure(e.clientX)
      return
    }
    p.timer = window.setTimeout(() => {
      if (press.current !== p) return
      reorder.start()
      p.dragging = true
      measure(p.lastX)
    }, LONG_PRESS_MS)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const p = press.current
    if (!p || p.pointerId !== e.pointerId) return
    p.lastX = e.clientX
    if (!p.dragging) {
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_SLOP) end(false)
      return
    }
    measure(e.clientX)
    if (!frame.current) frame.current = requestAnimationFrame(autoScroll)
  }

  return (
    <div ref={rowRef} className={cx('mon-row mon-row--head', reorder.active && 'is-reordering')} role="row">
      {children}
      {columns.map((c) => {
        const unit = reorder.unitOf(c.id)
        const title = unit === TIMELINE_ID ? '타임라인' : c.title
        return (
          <div
            key={c.id}
            className={cx('mon-cell', reorder.active && 'is-reorderable', drag?.unit === unit && 'is-dragging')}
            role="columnheader"
            title={reorder.active ? `${title} — 끌어서 옮기기` : `${c.title} — 꾹 누르면 칸 순서 바꾸기`}
            aria-sort={ariaSort(sort, c.id)}
            data-unit={unit}
            onPointerDown={(e) => onPointerDown(e, unit, title)}
            onPointerMove={onPointerMove}
            onPointerUp={() => end(true)}
            onPointerCancel={() => end(false)}
            onLostPointerCapture={() => end(false)}
            // 터치로 꾹 누르면 뜨는 메뉴(복사 등)를 막는다
            onContextMenu={(e) => {
              if (press.current) e.preventDefault()
            }}
          >
            {/* 묶은 타임라인 칸은 정렬하지 않는다(펼치면 칸마다 정렬된다). 순서를 바꾸는 동안은 정렬·너비를 숨긴다 */}
            {!reorder.active && !isTimelineColumn(c) && (
              <SortButton id={c.id} title={c.title} sort={sort} onSort={onSort} />
            )}
            <span className="mon-text">{c.title}</span>
            {!reorder.active && <ResizeHandle id={c.id} width={widthOf(c.id)} onResize={onResize} />}
          </div>
        )
      })}
      <div className="mon-cell mon-cell--end" aria-hidden />
      {drag && (
        <>
          <span className="mon-reorder-line" style={{ left: drag.line }} aria-hidden />
          <span className="mon-reorder-ghost" style={{ left: drag.x }} aria-hidden>
            {drag.title}
          </span>
        </>
      )}
    </div>
  )
}
