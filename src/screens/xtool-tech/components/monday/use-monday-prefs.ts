import { useCallback, useState } from 'react'
import type { TechBoardKey } from '@xtool-core/tech-boards'

// Monday 표에서 손으로 바꾼 것 — 칸 너비·칸 순서·접은 그룹·타임라인 펼치기. 보드마다 이 브라우저에 기억한다(직원마다
// 제 컴퓨터에서 쓰니 사람마다 따로다).

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const write = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 저장소를 못 쓰면 이번 방문 동안만 */
  }
}

/** 칸 너비(컬럼 id → px). 이름 칸은 'name'. */
export function useColumnWidths(boardKey: TechBoardKey): [Record<string, number>, (id: string, width: number) => void] {
  const key = `xtool-tech:monday-widths:${boardKey}`
  const [widths, setWidths] = useState<Record<string, number>>(() => read(key, {}))
  const setWidth = useCallback(
    (id: string, width: number) =>
      setWidths((prev) => {
        const next = { ...prev, [id]: Math.round(width) }
        write(key, next)
        return next
      }),
    [key],
  )
  return [widths, setWidth]
}

/** 칸 순서(칸 단위 id — xtool-core column-order) — null이면 기본 순서. null을 넣으면 기본 순서로 돌린다. */
export function useColumnOrder(boardKey: TechBoardKey): [string[] | null, (order: string[] | null) => void] {
  const key = `xtool-tech:monday-order:${boardKey}`
  const [order, setOrder] = useState<string[] | null>(() => read<string[] | null>(key, null))
  const set = useCallback(
    (next: string[] | null) => {
      setOrder(next)
      if (next) write(key, next)
      else {
        try {
          window.localStorage.removeItem(key)
        } catch {
          /* 저장소를 못 쓰면 이번 방문 동안만 */
        }
      }
    },
    [key],
  )
  return [order, set]
}

/** 접은 그룹 id */
export function useCollapsedGroups(boardKey: TechBoardKey): [ReadonlySet<string>, (ids: string[], collapsed: boolean) => void] {
  const key = `xtool-tech:monday-collapsed:${boardKey}`
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set(read<string[]>(key, [])))
  const set = useCallback(
    (ids: string[], on: boolean) =>
      setCollapsed((prev) => {
        const next = new Set(prev)
        for (const id of ids) {
          if (on) next.add(id)
          else next.delete(id)
        }
        write(key, [...next])
        return next
      }),
    [key],
  )
  return [collapsed, set]
}

/** 타임라인 펼치기(tech-timeline) — 처음에는 꺼져 있어 타임라인 칸들을 "타임라인" 칸 하나로 묶는다. */
export function useTimelineOpen(boardKey: TechBoardKey): [boolean, (open: boolean) => void] {
  const key = `xtool-tech:monday-timeline:${boardKey}`
  const [open, setOpen] = useState<boolean>(() => read(key, false))
  const set = useCallback(
    (next: boolean) => {
      setOpen(next)
      write(key, next)
    },
    [key],
  )
  return [open, set]
}

/** 고른 보기 id — null이면 메인 테이블. 보기 목록은 팀이 같이 쓰고, 어느 보기를 보는지는 사람마다 이 브라우저에. */
export function useSelectedView(boardKey: TechBoardKey): [string | null, (id: string | null) => void] {
  const key = `xtool-tech:monday-view:${boardKey}`
  const [selected, setSelected] = useState<{ key: string; id: string | null }>(() => ({ key, id: read<string | null>(key, null) }))
  const select = useCallback(
    (id: string | null) => {
      write(key, id)
      setSelected({ key, id })
    },
    [key],
  )
  // 보드를 옮기면(같은 화면에서 주소만 바뀐다) 그 보드의 기억을 읽는다
  return [selected.key === key ? selected.id : read<string | null>(key, null), select]
}
