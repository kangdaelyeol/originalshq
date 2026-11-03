import { useCallback, useState } from 'react'
import type { TechBoardKey } from '../../data/tech-boards'

// Monday 표에서 손으로 바꾼 것 — 칸 너비·접은 그룹. 보드마다 이 브라우저에 기억한다.

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
