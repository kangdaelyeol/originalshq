import type { CSSProperties } from 'react'
import type { TechCellValue, TechColumn } from '../../data/tech-boards'
import type { EditState, LocationState } from '../../data/tech-edit'
import { cx } from '../../lib/cx'
import { koreaToday } from '../../lib/dates'
import { labelColor } from './monday-colors'

// Monday 표 칸의 값 다루기 — 칸 너비·정렬값·날짜 글자·미리 보기 값. 값은 캐시에 적힌 그대로
// (text: Monday 화면 글자, value: 원본 JSON)라 보드마다 따로 정하지 않는다.

/** 표에 아예 안 그리는 타입 — 하위 아이템 칸은 이름 칸의 펼치기·개수로, 버튼은 할 일이 없다. */
export const HIDDEN_TYPES = new Set(['subtasks', 'button'])

const WIDTH_BY_TYPE: Record<string, number> = {
  status: 140,
  dropdown: 150,
  people: 96,
  date: 116,
  numbers: 100,
  checkbox: 76,
  long_text: 220,
  location: 230,
  mirror: 240,
  lookup: 240,
  board_relation: 180,
  link: 160,
  phone: 136,
  email: 180,
  file: 96,
  item_id: 110,
}
export const NAME_WIDTH = 300
export const MIN_WIDTH = 64
export const defaultWidth = (column: TechColumn): number => WIDTH_BY_TYPE[column.type] ?? 150

// 글이 길어 왼쪽부터 읽는 칸 — 나머지는 Monday처럼 가운데
const LEFT_TYPES = new Set(['long_text', 'location', 'mirror', 'lookup', 'link', 'board_relation'])

export const parseJson = (value: string | null | undefined): Record<string, unknown> | null => {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export const splitText = (text: string) => text.split(', ').map((s) => s.trim()).filter(Boolean)

/** Monday 날짜 글자("2026-09-02 14:00") → "9월 2" · 다른 해면 "2025년 9월 2" */
export function mondayDate(text: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2}))?/.exec(text)
  if (!m) return text
  const day = `${Number(m[2])}월 ${Number(m[3])}`
  const year = m[1] === koreaToday().slice(0, 4) ? '' : `${m[1]}년 `
  return `${year}${day}${m[4] ? ` ${m[4]}` : ''}`
}

export const isChecked = (cell: TechCellValue | undefined) => {
  const checked = parseJson(cell?.value)?.checked
  return checked === true || checked === 'true' || cell?.text === 'v'
}

export const fileCount = (cell: TechCellValue | undefined) => {
  const files = parseJson(cell?.value)?.files
  if (Array.isArray(files)) return files.length
  return cell?.text ? splitText(cell.text).length : 0
}

/** 정렬에 쓰는 값 — 빈 칸은 null(언제나 맨 아래) */
export function sortValue(column: TechColumn, cell: TechCellValue | undefined): string | number | null {
  if (column.type === 'checkbox') return isChecked(cell) ? 1 : 0
  if (column.type === 'file') return fileCount(cell) || null
  const text = cell?.text?.trim() ?? ''
  if (!text) return null
  if (column.type === 'numbers') {
    const n = Number(text.replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return text
}

/** 칸 정렬·모양 클래스 */
export const cellClass = (column: TechColumn): string =>
  cx('mon-cell', `mon-cell--${column.type}`, LEFT_TYPES.has(column.type) && 'is-left')

/** 상태 칸은 칸 전체를 라벨 색으로 칠한다. */
export const cellStyle = (column: TechColumn, cell: TechCellValue | undefined): CSSProperties | undefined =>
  column.type === 'status' ? ({ '--label': labelColor(cell?.text) } as CSSProperties) : undefined

/** 한국 날짜·시각 → Monday 원본 JSON(UTC) — 저장이 끝나기 전 미리 보여 줄 값을 원본과 같은 모양으로. */
const dateJson = (date: string, time: string) => {
  if (!time) return JSON.stringify({ date })
  const iso = new Date(Date.parse(`${date}T${time}:00+09:00`)).toISOString()
  return JSON.stringify({ date: iso.slice(0, 10), time: iso.slice(11, 19) })
}

/**
 * 고친 값 → 저장이 끝나기 전 칸에 미리 보여 줄 값(캐시와 같은 모양). names는 사람·연결 칸의
 * id에 맞는 이름(편집 칸이 알고 있다).
 */
export function previewCell(column: TechColumn, state: EditState, names: string[] = []): TechCellValue {
  switch (column.type) {
    case 'dropdown':
      return { text: (state as string[]).join(', '), value: null }
    case 'people':
      return {
        text: names.join(', '),
        value: JSON.stringify({ personsAndTeams: (state as string[]).map((id) => ({ id: Number(id), kind: 'person' })) }),
      }
    case 'board_relation':
      return {
        text: names.join(', '),
        value: JSON.stringify({ linkedPulseIds: (state as string[]).map((id) => ({ linkedPulseId: Number(id) })) }),
      }
    case 'checkbox':
      return state ? { text: 'v', value: JSON.stringify({ checked: 'true' }) } : { text: '', value: null }
    case 'date': {
      const { date, time } = state as { date: string; time: string }
      return date ? { text: time ? `${date} ${time}` : date, value: dateJson(date, time) } : { text: '', value: null }
    }
    case 'link': {
      const { url, text } = state as { url: string; text: string }
      return url ? { text: text || url, value: JSON.stringify({ url, text: text || url }) } : { text: '', value: null }
    }
    case 'location': {
      const { address, detail, lat, lng } = state as LocationState
      const full = detail.trim() ? `${address}, ${detail.trim()}` : address
      return full ? { text: full, value: JSON.stringify({ address: full, lat, lng }) } : { text: '', value: null }
    }
    case 'phone':
      return { text: (state as string).trim(), value: JSON.stringify({ phone: (state as string).replace(/\D/g, '') }) }
    case 'email':
      return { text: (state as string).trim(), value: JSON.stringify({ email: (state as string).trim() }) }
    default:
      return { text: String(state).trim(), value: null }
  }
}

/** 바로 고쳐 쓰는 칸 — 칸 안에 입력 칸이 그대로 열린다(나머지는 팝오버). */
export const INLINE_TYPES = new Set(['text', 'numbers', 'phone', 'email'])
