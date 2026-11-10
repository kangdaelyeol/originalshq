import type { TechBoardKey, TechColumn } from './tech-boards'
import { TIMELINE_ID, timelineBundle, timelineColumns, titleKey } from './tech-timeline'

// Monday 표 칸 순서 — 기본은 Monday 순서에 보드별 기본 옮기기(DEFAULT_MOVES)를 더하고 타임라인(tech-timeline)은 맨
// 오른쪽. 직원이 머리글을 끌어 바꾼 순서(order — 칸 id 목록, 웹은 이 브라우저에 기억)가 있으면 그 순서로. 타임라인
// 칸들은 한 덩이(TIMELINE_ID)로 옮긴다 — 접었으면 "타임라인" 칸 하나, 펼쳤으면 그 자리에 단계 순서대로.
// 순서에 없는 칸(새로 생긴 칸)은 Monday 순서대로 끝에 붙인다(Monday도 새 칸을 끝에 만든다).

/** 보드별 기본 자리 옮기기 — title 칸을 after 칸 바로 오른쪽에(직원이 순서를 바꾸기 전 기본). 제목은 화면 이름 */
export const DEFAULT_MOVES: Partial<Record<TechBoardKey, readonly { title: string; after: string }[]>> = {
  // AS 2026 — 접수일을 연락처 오른쪽에(2026-11-10)
  repair: [{ title: '접수일', after: '연락처' }],
}

/** 기본 순서의 칸 단위(칸 id, 타임라인은 TIMELINE_ID 하나) */
function naturalUnits(boardKey: TechBoardKey, columns: readonly TechColumn[], parts: ReadonlySet<string>): string[] {
  const rest = columns.filter((c) => !parts.has(c.id))
  const ids = rest.map((c) => c.id)
  for (const move of DEFAULT_MOVES[boardKey] ?? []) {
    const moving = rest.find((c) => titleKey(c.title) === titleKey(move.title))
    const after = rest.find((c) => titleKey(c.title) === titleKey(move.after))
    if (!moving || !after || moving === after) continue
    ids.splice(ids.indexOf(moving.id), 1)
    ids.splice(ids.indexOf(after.id) + 1, 0, moving.id)
  }
  return parts.size > 0 ? [...ids, TIMELINE_ID] : ids
}

/** 칸 단위 순서 — 바꾼 순서(order)에 있는 것은 그 순서로, 없는 것은 기본 순서대로 끝에 */
export function columnUnits(
  boardKey: TechBoardKey,
  columns: readonly TechColumn[],
  order?: readonly string[] | null,
): string[] {
  const parts = new Set(timelineColumns(boardKey, columns).map((c) => c.id))
  const natural = naturalUnits(boardKey, columns, parts)
  if (!order?.length) return natural
  const known = new Set(natural)
  const placed = [...new Set(order)].filter((id) => known.has(id))
  const seen = new Set(placed)
  return [...placed, ...natural.filter((id) => !seen.has(id))]
}

export interface ColumnOrderOptions {
  /** 타임라인 펼치기 — 꺼져 있으면 "타임라인" 칸 하나로 묶는다 */
  open: boolean
  /** 직원이 바꾼 순서(칸 단위 id) — 없으면 기본 순서 */
  order?: readonly string[] | null
  /** 숨길 칸 id(고른 보기) — 순서는 숨긴 칸까지 셈해 정하고, 그린 뒤에 뺀다 */
  hidden?: readonly string[]
}

/** 그릴 칸 — 칸 단위 순서대로 펼치고 숨긴 칸을 뺀다. 타임라인 칸이 다 숨겨졌으면 타임라인 칸도 없다. */
export function orderColumns(
  boardKey: TechBoardKey,
  columns: readonly TechColumn[],
  { open, order, hidden }: ColumnOrderOptions,
): TechColumn[] {
  const hide = new Set(hidden ?? [])
  const parts = timelineColumns(boardKey, columns).filter((c) => !hide.has(c.id))
  const byId = new Map(columns.map((c) => [c.id, c]))
  return columnUnits(boardKey, columns, order).flatMap((id) => {
    if (id === TIMELINE_ID) return parts.length === 0 ? [] : open ? parts : [timelineBundle(parts)]
    const column = byId.get(id)
    return column && !hide.has(id) ? [column] : []
  })
}

/** 칸 단위 하나를 before 앞으로(before가 null이면 맨 끝으로) 옮긴 순서 */
export function moveUnit(units: readonly string[], unit: string, before: string | null): string[] {
  const rest = units.filter((id) => id !== unit)
  const at = before === null ? -1 : rest.indexOf(before)
  if (at < 0) return [...rest, unit]
  return [...rest.slice(0, at), unit, ...rest.slice(at)]
}
