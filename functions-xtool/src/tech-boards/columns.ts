import { TechEditError } from './errors'
import { TechBoardKey, TechColumn, TechEditValue } from './types'
import { TechRawColumn } from './monday-api'

// 컬럼 타입별 쓰기 — 화면이 보낸 값(TechEditValue)을 Monday가 받는 column_values
// 모양으로 바꾼다. 여기 없는 타입(미러·연결·파일·버튼 등)은 읽기만 한다. 주소
// (location)는 위도·경도가 있어야 써져서, 화면이 주소 검색(address.ts)으로 고른
// 좌표를 함께 보낸다.

const WRITABLE_TYPES = new Set([
  'text',
  'long_text',
  'numbers',
  'status',
  'dropdown',
  'date',
  'people',
  'checkbox',
  'phone',
  'email',
  'link',
  'location',
])

/** 새 설정(settings)의 상태 라벨 — 끈 라벨(is_deactivated)은 뺀다.
 * 새 설정이 없으면 undefined. */
function activeStatusLabels(column: TechRawColumn): string[] | undefined {
  let settings = column.settings
  if (typeof settings === 'string') {
    try {
      settings = JSON.parse(settings)
    } catch {
      return undefined
    }
  }
  const labels = (settings as { labels?: unknown } | null | undefined)?.labels
  if (!Array.isArray(labels)) return undefined
  type Label = { label?: string; index?: number; is_deactivated?: boolean }
  return (labels as Label[])
    .filter((l) => !l.is_deactivated && l.label?.trim())
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((l) => l.label as string)
}

/**
 * 상태·드롭다운 라벨 — 설정 JSON에서 화면에 보이는 순서대로. 상태는 Monday에서
 * 끈 라벨을 뺀다(고르면 Monday가 "label has been deactivated"로 거절한다).
 * 그 표시는 새 설정(settings)에만 있어서 있으면 그것을 쓴다.
 */
export function parseOptions(column: TechRawColumn): string[] | undefined {
  if (column.type === 'status') {
    const active = activeStatusLabels(column)
    if (active) return active
  }
  if (!column.settings_str) return undefined
  let settings: Record<string, unknown>
  try {
    settings = JSON.parse(column.settings_str)
  } catch {
    return undefined
  }
  if (column.type === 'status') {
    const labels = (settings.labels ?? {}) as Record<string, string>
    const positions = (settings.labels_positions_v2 ?? {}) as Record<
      string,
      number
    >
    return Object.entries(labels)
      .filter(([, label]) => label && label.trim())
      .sort(
        ([a], [b]) =>
          (positions[a] ?? Number(a)) - (positions[b] ?? Number(b)),
      )
      .map(([, label]) => label)
  }
  if (column.type === 'dropdown') {
    const labels = (settings.labels ?? []) as Array<{ name?: string }>
    return labels.map((label) => label.name ?? '').filter(Boolean)
  }
  return undefined
}

/** 연결 칸이 가리키는 보드 id(설정의 boardIds 첫 번째) */
const linkedBoardId = (column: TechRawColumn): string | null => {
  try {
    const ids = JSON.parse(column.settings_str ?? '{}').boardIds as
      | Array<number | string>
      | undefined
    return ids?.length ? String(ids[0]) : null
  } catch {
    return null
  }
}

/** 고칠 수 있는 칸인지 — 연결 칸은 가리키는 보드가 우리 캐시에 있을 때만
 * (거기서 골라야 해서). */
export const isWritableColumn = (column: {
  type: string
  linkedBoardKey?: string
}): boolean =>
  WRITABLE_TYPES.has(column.type) ||
  (column.type === 'board_relation' && !!column.linkedBoardKey)

/** 보드 컬럼 → 화면용 컬럼 정의. 이름 칸(name)은 따로 다뤄서 뺀다.
 * keyOfBoard: Monday 보드 id → 우리 보드 이름표(연결 칸이 가리키는 보드 찾기). */
export const toTechColumns = (
  columns: TechRawColumn[],
  keyOfBoard: (boardId: string) => TechBoardKey | undefined = () => undefined,
): TechColumn[] =>
  columns
    .filter((column) => column.id !== 'name')
    .map((column) => {
      const options = parseOptions(column)
      const linkedId =
        column.type === 'board_relation' ? linkedBoardId(column) : null
      const linkedBoardKey = linkedId ? keyOfBoard(linkedId) : undefined
      const result: TechColumn = {
        id: column.id,
        title: column.title,
        type: column.type,
        writable: false,
        ...(options ? { options } : {}),
        ...(linkedBoardKey ? { linkedBoardKey } : {}),
      }
      result.writable = isWritableColumn(result)
      return result
    })

/** 한국 날짜·시각(YYYY-MM-DD, HH:MM) → Monday가 받는 UTC 날짜·시각 */
export function koreaToUtc(
  date: string,
  time: string,
): { date: string; time: string } {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d, hh - 9, mm))
  return {
    date: utc.toISOString().slice(0, 10),
    time: `${utc.toISOString().slice(11, 16)}:00`,
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

/** 칸 하나의 새 값 → column_values에 넣을 값. 빈 값은 지우기(null).
 * 잘못된 값이면 throw(문구는 화면에 그대로 보인다). */
export function toColumnValue(
  column: TechColumn,
  value: TechEditValue,
): unknown {
  // 저장된 writable 표시가 아니라 타입으로 본다 — 쓰기 가능한 타입을 늘린 뒤 동기화
  // 전이어도 바로 쓸 수 있게.
  if (!isWritableColumn(column)) {
    throw new TechEditError(`'${column.title}' 칸은 여기서 고칠 수 없어요`)
  }
  const fail = (): never => {
    throw new TechEditError(`'${column.title}' 칸의 값이 올바르지 않아요`)
  }
  const options = column.options
  const isEmpty =
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)

  switch (column.type) {
    case 'text':
      if (value !== null && typeof value !== 'string') return fail()
      return value ?? ''
    case 'long_text':
      if (value !== null && typeof value !== 'string') return fail()
      return isEmpty ? null : { text: value }
    case 'numbers': {
      if (isEmpty) return null
      if (typeof value !== 'string') return fail()
      const n = Number(value.replace(/,/g, ''))
      if (!Number.isFinite(n)) return fail()
      return String(n)
    }
    case 'status':
      if (isEmpty) return null
      if (typeof value !== 'string') return fail()
      if (options && !options.includes(value)) return fail()
      return { label: value }
    case 'dropdown':
      if (isEmpty) return null
      if (!Array.isArray(value)) return fail()
      if (options && value.some((v) => !options.includes(v))) return fail()
      return { labels: value }
    case 'date': {
      if (isEmpty) return null
      if (typeof value !== 'object' || Array.isArray(value)) return fail()
      if (!('date' in value) || !DATE.test(value.date)) return fail()
      if (!value.time) return { date: value.date }
      if (!TIME.test(value.time)) return fail()
      return koreaToUtc(value.date, value.time)
    }
    case 'people':
      if (isEmpty) return null
      if (!Array.isArray(value) || value.some((id) => !/^\d+$/.test(id))) {
        return fail()
      }
      return {
        personsAndTeams: value.map((id) => ({
          id: Number(id),
          kind: 'person',
        })),
      }
    case 'checkbox':
      if (typeof value !== 'boolean' && value !== null) return fail()
      return value ? { checked: 'true' } : null
    case 'phone': {
      if (isEmpty) return null
      if (typeof value !== 'string') return fail()
      const digits = value.replace(/\D/g, '')
      if (digits.length < 8) return fail()
      return { phone: digits, countryShortName: 'KR' }
    }
    case 'email':
      if (isEmpty) return null
      if (typeof value !== 'string' || !/^\S+@\S+$/.test(value)) return fail()
      return { email: value, text: value }
    case 'link':
      if (isEmpty) return null
      if (typeof value !== 'object' || Array.isArray(value)) return fail()
      if (!('url' in value) || !/^https?:\/\//.test(value.url)) return fail()
      return { url: value.url, text: value.text || value.url }
    case 'board_relation':
      if (isEmpty) return null
      if (!Array.isArray(value) || value.some((id) => !/^\d+$/.test(id))) {
        return fail()
      }
      return { item_ids: value.map(Number) }
    case 'location': {
      if (isEmpty) return null
      if (typeof value !== 'object' || Array.isArray(value)) return fail()
      if (!('lat' in value) || !('lng' in value)) return fail()
      const lat = Number(value.lat)
      const lng = Number(value.lng)
      if (!(lat > -90 && lat < 90) || !(lng >= -180 && lng <= 180)) {
        return fail()
      }
      return { lat: String(lat), lng: String(lng), address: value.address }
    }
    default:
      return fail()
  }
}

/** 화면이 보낸 칸들 → column_values. 모르는 컬럼이면 throw. */
export function buildColumnValues(
  columns: TechColumn[],
  edits: Record<string, TechEditValue>,
): Record<string, unknown> {
  const byId = new Map(columns.map((column) => [column.id, column]))
  const result: Record<string, unknown> = {}
  for (const [id, value] of Object.entries(edits)) {
    const column = byId.get(id)
    if (!column) throw new TechEditError(`없는 칸이에요(${id})`)
    result[id] = toColumnValue(column, value)
  }
  return result
}
