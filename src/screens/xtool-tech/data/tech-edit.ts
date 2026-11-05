import type { TechCellValue, TechColumn, TechEditValue } from './tech-boards'

// 편집 칸 상태 — 컬럼 타입마다 다르다. Monday 값(value JSON) → 처음 상태, 상태 → 함수로
// 보낼 값(TechEditValue). 날짜 시간은 Monday에 UTC로 저장돼 있어 한국 시간으로 바꿔 보여 주고,
// 보낼 때는 한국 시간 그대로 보낸다(함수가 UTC로 바꾼다).

// 고칠 수 있는 타입 — functions-xtool/src/tech-boards/columns.ts의 WRITABLE_TYPES와 같게.
// 보드 정보의 writable 표시는 동기화 때 정해져서, 타입을 늘린 직후엔 옛값일 수 있다.
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
export const isWritable = (c: TechColumn) =>
  c.writable || WRITABLE_TYPES.has(c.type) || (c.type === 'board_relation' && !!c.linkedBoardKey)

// ── 담당자(엑스툴) 칸 ──────────────────────────────────────────────────────────
// 직원들이 Monday를 떠나면 Monday 사람 칸("담당자")에는 담당자를 넣을 수 없어서, 보드마다 따로 만든
// 글자 칸에 기술팀 구성원 이름을 ", "로 이어 쓴다(서버 tech-boards/assignees.ts). 이 칸이 있는
// 보드는 원래 사람 칸을 화면에서 숨기고, 이 칸을 "담당자"로 보여 준다.
const ASSIGNEE_TITLE = '담당자(엑스툴)'
const compactTitle = (title: string) => title.replace(/\s/g, '')

export const isAssigneeColumn = (c: Pick<TechColumn, 'type' | 'title'>): boolean =>
  c.type === 'text' && compactTitle(c.title) === ASSIGNEE_TITLE

/** 원래 담당자(Monday 사람 칸) */
const isLegacyAssigneeColumn = (c: Pick<TechColumn, 'type' | 'title'>): boolean =>
  c.type === 'people' && compactTitle(c.title) === '담당자'

/** 담당자(엑스툴) 칸이 있으면 원래 사람 칸은 뺀다. */
export const withoutLegacyAssignee = <T extends Pick<TechColumn, 'type' | 'title'>>(columns: T[]): T[] =>
  columns.some(isAssigneeColumn) ? columns.filter((c) => !isLegacyAssigneeColumn(c)) : columns


// ── 연락처 칸 ─────────────────────────────────────────────────────────────────
// 전화 칸과 제목이 연락처·전화번호·휴대폰인 글자 칸 — 칠 때는 010-1234-5678로 맞춰 보여 주고,
// 저장은 숫자만(하이픈 없이) 한다. 리드 매니저가 고객을 번호(숫자)로 찾는다. 번호 하나로 볼 수
// 없는 값(번호 두 개·+82·메모가 섞인 글)은 손대지 않고 적힌 그대로 둔다.
const PHONE_TITLE = /연락처|전화번호|휴대폰|핸드폰|phone/i

export const isPhoneColumn = (c: Pick<TechColumn, 'type' | 'title'>): boolean =>
  c.type === 'phone' || (c.type === 'text' && PHONE_TITLE.test(c.title.replace(/\s/g, '')))

// Monday 칸 제목 끝의 입력 안내 — "(- 하이픈 필수)"·"(- 필수)"·"(간략하게 체크)"처럼 Monday에서 적는 사람에게 남긴 말.
// "(대여자)"·"(SN)"처럼 뜻을 보태는 괄호는 둔다.
const INPUT_HINT = /\s*\([^()]*(?:-|필수|체크)[^()]*\)/g

/**
 * 화면에 보일 칸 이름 — 담당자(엑스툴)는 "담당자", 전화 칸은 "연락처"로 맞추고 입력 안내 괄호는 뺀다. 화면에 보일
 * 글자만 바꾼다 — 칸을 알아보는 판단(담당자·전화 칸 등)은 Monday 제목 그대로(c.title)를 본다.
 */
export const columnLabel = (c: Pick<TechColumn, 'type' | 'title'>): string => {
  if (isAssigneeColumn(c)) return '담당자'
  if (isPhoneColumn(c)) return '연락처'
  return c.title.replace(INPUT_HINT, '').trim() || c.title
}

/** 번호 하나로 볼 수 있는 값인지 — 숫자·하이픈·공백·괄호·점만, 숫자는 11자리까지(빈 값도 참) */
export const isPhoneLike = (text: string): boolean =>
  /^[\d\s().-]*$/.test(text) && text.replace(/\D/g, '').length <= 11

/** 덜 적은 번호 — 숫자가 있지만 9자리가 안 된다(저장하지 않는다). */
export const isPartialPhone = (text: string): boolean => {
  const digits = text.replace(/\D/g, '').length
  return digits > 0 && digits < 9
}

/** 치는 중인 번호 → 하이픈을 넣은 모양(02 지역번호·10~11자리). 숫자가 아닌 글자는 버린다. */
export function formatPhoneTyping(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.startsWith('02')) {
    if (d.length <= 2) return d
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`
  }
  if (d.length <= 3) return d
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}

/** 주소 칸 — 좌표까지 있어야 Monday에 써진다(주소 검색으로 고른 값). Monday에는
 * "{주소}, {상세주소}" 한 줄로 적고, 읽을 때 첫 ", "에서 다시 나눈다(카카오 도로명·지번
 * 주소에는 쉼표가 없다). */
export interface LocationState {
  address: string
  detail: string
  lat: string
  lng: string
}

const splitAddress = (full: string): { address: string; detail: string } => {
  const i = full.indexOf(', ')
  return i < 0 ? { address: full, detail: '' } : { address: full.slice(0, i), detail: full.slice(i + 2) }
}

export type EditState =
  | string
  | string[]
  | boolean
  | { date: string; time: string }
  | { url: string; text: string }
  | LocationState

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
    case 'board_relation':
      return []
    case 'checkbox':
      return false
    case 'date':
      return { date: '', time: '' }
    case 'link':
      return { url: '', text: '' }
    case 'location':
      return { address: '', detail: '', lat: '', lng: '' }
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
    case 'board_relation': {
      const linked = (json?.linkedPulseIds ?? []) as { linkedPulseId: number | string }[]
      return linked.map((l) => String(l.linkedPulseId))
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
    case 'location':
      return {
        ...splitAddress(String(json?.address ?? cell.text ?? '')),
        lat: json?.lat != null ? String(json.lat) : '',
        lng: json?.lng != null ? String(json.lng) : '',
      }
    case 'phone': {
      const phone = String(json?.phone ?? cell.text ?? '')
      return isPhoneLike(phone) ? formatPhoneTyping(phone) : phone
    }
    case 'email':
      return String(json?.email ?? cell.text ?? '')
    default:
      return isPhoneColumn(column) && isPhoneLike(cell.text ?? '') ? formatPhoneTyping(cell.text ?? '') : (cell.text ?? '')
  }
}

/** 편집 상태 → 함수로 보낼 값(빈 값은 지우기) */
export function toEditValue(column: TechColumn, state: EditState): TechEditValue {
  switch (column.type) {
    case 'dropdown':
    case 'people':
    case 'board_relation':
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
    case 'location': {
      const { address, detail, lat, lng } = state as LocationState
      const full = detail.trim() ? `${address}, ${detail.trim()}` : address
      return lat && lng ? { address: full, lat, lng } : null
    }
    case 'status':
      return (state as string) || null
    default:
      // 연락처는 숫자만 저장한다.
      return isPhoneColumn(column) && isPhoneLike(state as string)
        ? (state as string).replace(/\D/g, '')
        : (state as string).trim()
  }
}

export const sameState = (a: EditState, b: EditState): boolean => JSON.stringify(a) === JSON.stringify(b)
