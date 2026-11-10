import { buildColumnValues } from './columns'
import { TechEditError } from './errors'
import {
  changeColumnValues,
  createSubitem,
  deleteItem,
} from './monday-api'
import {
  TechBoardMeta,
  TechChange,
  TechEditInput,
  TechSubitemDoc,
} from './types'

// 하위 아이템(출장 설치 품목·AS 청구 부품) 추가·수정·삭제. 하위 아이템은 Monday 안에서
// 부모와 다른 보드라 칸 정의(meta.subitems)도 따로다.
//
// 출장 설치 품목의 "품명" 칸은 "{이름} {수량}개"로 적혀 있다(95%가 이 규칙, Monday
// 자동화로 보인다). 이름·수량을 바꾸면 품명도 같은 규칙으로 맞춘다 — 비고만 고치면
// 사람이 따로 고쳐 둔 품명은 건드리지 않는다.

const titleIs = (title: string, name: string) =>
  title.replace(/\s/g, '') === name

/** "{이름} {수량}개" — 수량이 없으면 이름만. 하위 줄 규칙(rules.ts)도 쓴다. */
export function derivedLabel(name: string, quantity: string | null): string {
  return quantity ? `${name} ${quantity}개` : name
}

export interface SubitemPlan {
  create: Array<{ name: string; values: Record<string, unknown> }>
  update: Array<{ id: string; values: Record<string, unknown> }>
  remove: string[]
}

/** 화면이 보낸 변경 → Monday에 보낼 것. 잘못된 입력이면 throw. */
export function planSubitems(
  meta: TechBoardMeta,
  current: TechSubitemDoc[],
  edits: NonNullable<TechEditInput['subitems']>,
): SubitemPlan {
  const sub = meta.subitems
  if (!sub) throw new TechEditError('하위 항목이 없는 보드예요')
  const owned = new Map(current.map((s) => [s.id, s]))
  const labelColumn = sub.columns.find(
    (c) => titleIs(c.title, '품명') && c.type === 'text',
  )
  const quantityColumn = sub.columns.find(
    (c) => titleIs(c.title, '수량') && c.type === 'numbers',
  )

  const withLabel = (
    values: Record<string, unknown>,
    name: string,
    quantity: string | null,
  ) =>
    labelColumn ?
      { ...values, [labelColumn.id]: derivedLabel(name, quantity) } :
      values

  const quantityOf = (
    columns: TechEditInput['columns'],
    existing?: TechSubitemDoc,
  ): string | null => {
    if (!quantityColumn) return null
    if (columns && quantityColumn.id in columns) {
      const v = columns[quantityColumn.id]
      return typeof v === 'string' && v.trim() ? v.trim() : null
    }
    return existing?.values[quantityColumn.id]?.text || null
  }

  const create = (edits.create ?? []).map((row) => {
    const name = row.name?.trim()
    if (!name) throw new TechEditError('새 줄의 이름을 적어 주세요')
    const values = buildColumnValues(sub.columns, row.columns ?? {})
    return {
      name,
      values: withLabel(values, name, quantityOf(row.columns)),
    }
  })

  const update = (edits.update ?? []).map((row) => {
    const existing = row.id ? owned.get(row.id) : undefined
    if (!row.id || !existing) {
      throw new TechEditError('이 항목에 없는 하위 줄이에요')
    }
    let values = buildColumnValues(sub.columns, row.columns ?? {})
    const name = row.name?.trim()
    if (row.name !== undefined && !name) {
      throw new TechEditError('하위 줄 이름은 비울 수 없어요')
    }
    if (name && name !== existing.name) values.name = name
    const quantityChanged = !!quantityColumn && !!row.columns &&
      quantityColumn.id in row.columns
    if (values.name || quantityChanged) {
      values = withLabel(
        values,
        name ?? existing.name,
        quantityOf(row.columns, existing),
      )
    }
    return { id: row.id, values }
  })

  const remove = (edits.remove ?? []).map((id) => {
    if (!owned.has(id)) throw new TechEditError('이 항목에 없는 하위 줄이에요')
    return id
  })

  return { create, update, remove }
}

/** 계획대로 Monday에 쓴다 — 지우기 → 고치기 → 만들기 순. 만든 줄의 Monday id를 만든
 * 순서(plan.create 순서)대로 돌려준다 — 화면은 이것으로 "만드는 중" 줄에 고친 것을 이어 보낸다. */
export async function applySubitems(
  apiKey: string,
  meta: TechBoardMeta,
  parentId: string,
  plan: SubitemPlan,
): Promise<string[]> {
  const boardId = meta.subitems?.boardId
  if (!boardId) throw new TechEditError('하위 항목이 없는 보드예요')
  for (const id of plan.remove) await deleteItem(apiKey, id)
  for (const row of plan.update) {
    if (Object.keys(row.values).length > 0) {
      await changeColumnValues(apiKey, boardId, row.id, row.values)
    }
  }
  const created: string[] = []
  for (const row of plan.create) {
    created.push(await createSubitem(apiKey, parentId, row.name, row.values))
  }
  return created
}

/** 수정 기록용 — 하위 줄 목록 전후("이름 ×수량"을 " · "로 이어서). */
export function subitemChange(
  meta: TechBoardMeta,
  label: string,
  before: TechSubitemDoc[],
  after: TechSubitemDoc[],
): TechChange | null {
  const quantityId = meta.subitems?.columns.find((c) =>
    titleIs(c.title, '수량'),
  )?.id
  const text = (rows: TechSubitemDoc[]) =>
    rows
      .map((s) => {
        const quantity = quantityId ? s.values[quantityId]?.text : ''
        return quantity ? `${s.name} ×${quantity}` : s.name
      })
      .join(' · ') || null
  const b = text(before)
  const a = text(after)
  if (b === a) return null
  return { field: 'subitems', title: label, before: b, after: a }
}
