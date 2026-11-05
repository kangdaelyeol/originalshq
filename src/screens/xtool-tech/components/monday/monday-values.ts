import type { CSSProperties } from 'react'
import type { TechBoardKey, TechBoardMeta, TechCellValue, TechColumn, TechItemDoc } from '../../data/tech-boards'
import { columnLabel, isAssigneeColumn, withoutLegacyAssignee, type EditState, type LocationState } from '../../data/tech-edit'
import { cx } from '@/ohq-ui/lib/cx'
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
  assignee: 110,
  date: 116,
  numbers: 100,
  checkbox: 76,
  long_text: 220,
  location: 230,
  mirror: 240,
  lookup: 240,
  board_relation: 180,
  link: 160,
  phone: 164,
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

/** 이름 칸 머리글 — Monday 이름 칸 제목은 캐시에 없어서 보드마다 정한다. */
export const NAME_TITLE: Record<TechBoardKey, string> = {
  fieldService: '고객명',
  repair: '고객명',
  records: '업무',
  techInquiry: '고객명',
  techTask: '업무',
  asRequests: '고객명',
  parts: '부품',
  rentals: '대여품',
  serials: 'SN',
}

/** 하위 아이템 이름 칸 머리글 */
export const SUB_NAME_TITLE: Partial<Record<TechBoardKey, string>> = {
  fieldService: '품목명',
  repair: '부품명',
}

export const splitNames = (text: string | undefined): string[] =>
  (text ?? '').split(', ').map((s) => s.trim()).filter(Boolean)

/** 검색어(소문자)·사람으로 거르기 — 이름과 모든 칸 글자에서 찾고, 사람은 담당자 칸에서. */
export function matchesItem(item: TechItemDoc, peopleColumns: TechColumn[], needle: string, person: string | null): boolean {
  if (person && !peopleColumns.some((c) => splitNames(item.values[c.id]?.text).includes(person))) return false
  if (!needle) return true
  return item.name.toLowerCase().includes(needle) || Object.values(item.values).some((v) => v.text?.toLowerCase().includes(needle))
}

/** Monday에서 그룹이 바뀐 뒤 아직 보드 정보가 다시 동기화되지 않은 항목을 모으는 그룹 */
export const OTHER_GROUP = '__other'

/** 그 항목이 들어갈 그룹 id */
/** 줄 열쇠 — 이 탭에서 만든 항목은 처음 임시 id(만들어진 뒤에도 줄·편집·선택이 이어지게) */
export const rowKey = (item: TechItemDoc): string => item.localKey ?? item.itemId

export const groupIdOf = (meta: TechBoardMeta, item: TechItemDoc): string =>
  item.groupId && meta.groups.some((g) => g.id === item.groupId) ? item.groupId : OTHER_GROUP

/**
 * 보드에서 보이는 칸 — 하위 아이템·버튼 칸은 뺀다. 담당자(엑스툴) 글자 칸은 "담당자"라는 이름의
 * 화면 전용 칸 종류('assignee' — 기술팀 이름을 동그라미로 보여 주고 명단에서 고른다)로 바꾸고, 그
 * 칸이 있으면 원래 Monday 사람 칸("담당자")은 숨긴다.
 */
export const visibleColumns = (meta: TechBoardMeta): TechColumn[] =>
  withoutLegacyAssignee(meta.columns)
    .filter((c) => !HIDDEN_TYPES.has(c.type))
    // 머리글·편집 칸에 보일 이름으로(columnLabel) — 바꾼 이름도 연락처 칸 판단(isPhoneColumn)에 그대로 걸린다
    .map((c) => ({ ...c, title: columnLabel(c), ...(isAssigneeColumn(c) ? { type: 'assignee' } : {}) }))

/** 머리글 정렬 — 1 오름차순 · -1 내림차순 */
export type MonSort = { columnId: string; dir: 1 | -1 } | null

/** 머리글 정렬 단추 — 누를 때마다 오름차순 → 내림차순 → 해제 */
export const nextSort = (current: MonSort, id: string): MonSort =>
  current?.columnId !== id ? { columnId: id, dir: 1 } : current.dir === 1 ? { columnId: id, dir: -1 } : null

// ── 이름에 적힌 전화번호(출장 "장성진 010-5060-1512") ─────────────────────────────
// 전화번호 칸이 따로 있는 보드는 이름 칸에 번호를 떼고 보여 준다. Monday 이름은 그대로 두고
// (고객 통합이 이름에서 번호를 읽는다) 화면에서만 뗀다.
export const PHONE_IN_NAME_BOARDS: ReadonlySet<TechBoardKey> = new Set(['fieldService'])

// 숫자 9~12자리에 -·.·공백·괄호가 섞인 덩어리
const PHONE_IN_TEXT = /\+?\d[\d\s().-]{7,}\d/g

/** 이름 → 보일 이름과 떼어 낸 번호 글자(이름을 고칠 때 다시 붙인다) */
export function splitNamePhone(name: string): { label: string; phones: string } {
  const found = (name.match(PHONE_IN_TEXT) ?? []).filter((p) => {
    const digits = p.replace(/\D/g, '').length
    return digits >= 9 && digits <= 12
  })
  if (found.length === 0) return { label: name, phones: '' }
  let label = name
  for (const phone of found) label = label.replace(phone, ' ')
  label = label
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s:,/-]+|[\s:,/-]+$/g, '')
  return { label: label || name, phones: found.map((p) => p.trim()).join(' ') }
}

/** 업데이트(Monday 댓글) 말풍선이 있는 보드 — 서버 TECH_BOARDS의 updates와 같게 */
export { UPDATE_BOARDS } from '../../data/use-item-updates'
