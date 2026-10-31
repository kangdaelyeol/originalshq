import { TechEditError } from './errors'
import { TechColumn, TechEditValue } from './types'
import { TechRawColumn } from './monday-api'

// 컬럼 타입별 쓰기 — 화면이 보낸 값(TechEditValue)을 Monday가 받는 column_values
// 모양으로 바꾼다. 여기 없는 타입(미러·연결·파일·버튼·주소 등)은 읽기만 한다.
// 주소(location)는 위도·경도가 있어야 써져서, 주소 검색(지오코딩)을 붙일 때까지
// 읽기만 한다.

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
])

/** 상태·드롭다운 라벨 — 설정 JSON에서 화면에 보이는 순서대로. */
export function parseOptions(column: TechRawColumn): string[] | undefined {
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

/** 보드 컬럼 → 화면용 컬럼 정의. 이름 칸(name)은 따로 다뤄서 뺀다. */
export const toTechColumns = (columns: TechRawColumn[]): TechColumn[] =>
  columns
    .filter((column) => column.id !== 'name')
    .map((column) => {
      const options = parseOptions(column)
      return {
        id: column.id,
        title: column.title,
        type: column.type,
        writable: WRITABLE_TYPES.has(column.type),
        ...(options ? { options } : {}),
      }
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
  if (!column.writable) {
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
