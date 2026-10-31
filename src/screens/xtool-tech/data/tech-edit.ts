import type { TechCellValue, TechColumn, TechEditValue } from './tech-boards'

// 편집 칸 상태 — 컬럼 타입마다 다르다. Monday 값(value JSON) → 처음 상태, 상태 → 함수로
// 보낼 값(TechEditValue). 날짜 시간은 Monday에 UTC로 저장돼 있어 한국 시간으로 바꿔 보여 주고,
// 보낼 때는 한국 시간 그대로 보낸다(함수가 UTC로 바꾼다).

export type EditState = string | string[] | boolean | { date: string; time: string } | { url: string; text: string }

const parse = (value: string | null): Record<string, unknown> | null => {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/** UTC 날짜·시각(HH:MM:SS) → 한국 날짜·시각(HH:MM) */
export function utcToKorea(date: string, time: string): { date: string; time: string } {
  const iso = new Date(Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}Z`) + 9 * 3600_000).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

/** 빈 상태 — 새로 만들 때 */
export function emptyState(column: TechColumn): EditState {
  switch (column.type) {
    case 'dropdown':
    case 'people':
      return []
    case 'checkbox':
      return false
    case 'date':
      return { date: '', time: '' }
    case 'link':
      return { url: '', text: '' }
    default:
      return ''
  }
}

/** Monday에 적힌 값 → 편집 칸의 처음 상태 */
export function initialState(column: TechColumn, cell: TechCellValue | undefined): EditState {
  if (!cell) return emptyState(column)
  const json = parse(cell.value)
  switch (column.type) {
    case 'dropdown':
      return cell.text ? cell.text.split(', ').filter(Boolean) : []
    case 'people': {
      const people = (json?.personsAndTeams ?? []) as { id: number | string; kind: string }[]
      return people.filter((p) => p.kind === 'person').map((p) => String(p.id))
    }
    case 'checkbox':
      return json?.checked === true || json?.checked === 'true' || cell.text === 'v'
    case 'date': {
      const date = typeof json?.date === 'string' ? json.date : ''
      const time = typeof json?.time === 'string' ? json.time : ''
      if (!date) return { date: cell.text.slice(0, 10), time: '' }
      return time ? utcToKorea(date, time) : { date, time: '' }
    }
    case 'link':
      return { url: String(json?.url ?? ''), text: String(json?.text ?? '') }
    case 'phone':
      return String(json?.phone ?? cell.text ?? '')
    case 'email':
      return String(json?.email ?? cell.text ?? '')
    default:
      return cell.text ?? ''
  }
}

/** 편집 상태 → 함수로 보낼 값(빈 값은 지우기) */
export function toEditValue(column: TechColumn, state: EditState): TechEditValue {
  switch (column.type) {
    case 'dropdown':
    case 'people':
      return state as string[]
    case 'checkbox':
      return state as boolean
    case 'date': {
      const { date, time } = state as { date: string; time: string }
      return date ? { date, time: time || null } : null
    }
    case 'link': {
      const { url, text } = state as { url: string; text: string }
      return url ? { url, text } : null
    }
    case 'status':
      return (state as string) || null
    default:
      return (state as string).trim()
  }
}

export const sameState = (a: EditState, b: EditState): boolean => JSON.stringify(a) === JSON.stringify(b)
