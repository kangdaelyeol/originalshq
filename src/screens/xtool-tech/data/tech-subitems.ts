import type { TechColumn, TechEditInput, TechSubitemDoc } from './tech-boards'
import { emptyState, initialState, sameState, toEditValue, type EditState } from './tech-edit'

// 하위 줄(출장 설치 품목·AS 청구 부품) 편집 상태 — 화면의 줄 목록 ↔ 함수로 보낼 변경.

/** 하위 줄 묶음의 이름 — 서버(functions-xtool tech-boards/edits.ts)의 SUBITEM_LABEL과 같게. */
export const SUBITEM_LABEL: Partial<Record<string, string>> = {
  fieldService: '설치 품목',
  repair: '청구 부품·공임',
}

export interface SubRow {
  /** 화면 key — 새 줄은 임시 값 */
  key: string
  /** Monday 하위 아이템 id — 새 줄은 없음 */
  id?: string
  name: string
  values: Record<string, EditState>
  /** Monday 화면 글자(연결 칸의 부품 이름, 미러·수식 값 등) */
  texts?: Record<string, string>
  /** 지울 줄(저장 전까지 되돌릴 수 있다) */
  removed?: boolean
}

const compact = (title: string) => title.replace(/\s/g, '')

/** 줄에서 고칠 칸 — 쓸 수 있는 칸 중 "품명"(이름·수량으로 서버가 맞춤)은 뺀다. */
export const editableSubColumns = (columns: TechColumn[]): TechColumn[] =>
  columns.filter((c) => c.writable && !(compact(c.title) === '품명' && c.type === 'text'))

/** 줄에 보여만 줄 칸 — 미러·수식(부품 SKU·합계 등) */
export const readonlySubColumns = (columns: TechColumn[]): TechColumn[] =>
  columns.filter((c) => !c.writable && (c.type === 'mirror' || c.type === 'formula'))

/** 연결 칸(부품명)이 있으면 줄 이름은 고른 것의 이름으로 맞추고 따로 입력받지 않는다. */
export const relationColumn = (columns: TechColumn[]): TechColumn | undefined =>
  columns.find((c) => c.type === 'board_relation' && c.writable)

/** 금액 칸 — 부품을 고르면 비어 있을 때 부품 비용으로 채운다. */
export const priceColumn = (columns: TechColumn[]): TechColumn | undefined =>
  columns.find((c) => c.type === 'numbers' && /금액|단가|비용/.test(compact(c.title)))

export function initialRows(columns: TechColumn[], subitems: TechSubitemDoc[]): SubRow[] {
  return subitems.map((s) => ({
    key: s.id,
    id: s.id,
    name: s.name,
    values: Object.fromEntries(columns.map((c) => [c.id, initialState(c, s.values[c.id])])),
    texts: Object.fromEntries(columns.map((c) => [c.id, s.values[c.id]?.text ?? ''])),
  }))
}

let newKey = 0
export const newRow = (columns: TechColumn[]): SubRow => ({
  key: `new-${++newKey}`,
  name: '',
  values: Object.fromEntries(columns.map((c) => [c.id, emptyState(c)])),
})

/** 바뀐 것만 함수로 — 없으면 null */
export function subitemEdits(
  columns: TechColumn[],
  initial: SubRow[],
  rows: SubRow[],
): TechEditInput['subitems'] | null {
  const before = new Map(initial.map((r) => [r.id, r]))
  const create = rows
    .filter((r) => !r.id && !r.removed)
    .map((r) => ({
      name: r.name.trim(),
      columns: Object.fromEntries(
        columns.filter((c) => !sameState(r.values[c.id], emptyState(c))).map((c) => [c.id, toEditValue(c, r.values[c.id])]),
      ),
    }))
  const update = rows
    .filter((r) => r.id && !r.removed)
    .flatMap((r) => {
      const old = before.get(r.id)
      if (!old) return []
      const changed = columns.filter((c) => !sameState(r.values[c.id], old.values[c.id]))
      const nameChanged = r.name.trim() !== old.name
      if (!changed.length && !nameChanged) return []
      return [
        {
          id: r.id,
          ...(nameChanged ? { name: r.name.trim() } : {}),
          columns: Object.fromEntries(changed.map((c) => [c.id, toEditValue(c, r.values[c.id])])),
        },
      ]
    })
  const remove = rows.filter((r) => r.id && r.removed).map((r) => r.id as string)
  if (!create.length && !update.length && !remove.length) return null
  return { create, update, remove }
}
