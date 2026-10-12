import { normalizeDomesticPhone } from '../utils'
import { RawMondayBoard, RawMondayItem } from './client'
import { MondayColumn, MondayItem, MondayItemColumn } from './types'

// 제목만으로 휴대폰번호 컬럼이라고 볼 수 있는 말.
const MOBILE_TITLE_PATTERN = /휴대폰|핸드폰|휴대전화|mobile/i
// 전화번호이긴 한데 휴대폰인지는 알 수 없는 말("회사 전화" 등).
const PHONE_TITLE_PATTERN = /연락처|전화|phone/i

/** 보드에서 휴대폰번호 컬럼을 추정한다. 우선순위:
 *   1. 제목이 휴대폰/핸드폰인 컬럼 (Monday 'phone' 타입이면 먼저)
 *   2. Monday 'phone' 타입 컬럼
 *   3. 제목이 연락처/전화인 컬럼
 * 전용 'phone' 타입이 아니라 일반 텍스트나 미러 컬럼에 번호를 둔 보드도
 * 있어서 제목도 본다. 못 찾으면 null — 추정이 틀리는 보드는 등록할 때
 * phoneColumnId를 직접 지정한다. */
export const detectPhoneColumnId = (columns: MondayColumn[]): string | null => {
  const isPhoneType = (column: MondayColumn) => column.type === 'phone'
  const titled = (pattern: RegExp) => (column: MondayColumn) =>
    pattern.test(column.title)

  const mobileTitled = columns.filter(titled(MOBILE_TITLE_PATTERN))
  const column =
    mobileTitled.find(isPhoneType) ??
    mobileTitled[0] ??
    columns.find(isPhoneType) ??
    columns.find(titled(PHONE_TITLE_PATTERN))

  return column?.id ?? null
}

// 유효한 번호로 인정하는 형태는 둘뿐이다(숫자만 남긴 뒤 기준):
//   · 휴대폰 — 010으로 시작하는 11자리. 8210…으로 적힌 국제 표기는 010…으로
//     바꿨을 때 11자리면 같은 것으로 본다.
//   · 유선 — 지역번호(02, 031~064)나 070으로 시작하고 뒤가 7~8자리.
// 그 밖의 값(자릿수가 모자라거나 넘치는 번호, 앞자리 오타, 0이 빠진 번호,
// 011·016 같은 옛 번호)은 고쳐 쓰지 않고 결측으로 본다.
const VALID_MOBILE = /^010\d{8}$/
const VALID_LANDLINE = /^0(?:2|[3-6]\d|70)\d{7,8}$/

// 한 칸에 번호가 여러 개 적힌 경우("010-1111-2222 / 031-333-4444",
// "홍길동/01011112222")에서 번호 하나하나를 집어내는 패턴. 앞뒤가 숫자면 더
// 긴 숫자열의 일부이므로 집지 않는다 — 그래서 "010-27113-2881"처럼 자릿수가
// 넘치는 값에서 일부만 잘라 유효한 번호로 만드는 일이 없다.
const SEP = '[\\s.-]{0,2}'
const MOBILE_IN_TEXT = `(?:\\+?82${SEP}|0)10${SEP}\\d{4}${SEP}\\d{4}`
const LANDLINE_IN_TEXT = `0(?:2|[3-6]\\d|70)${SEP}\\d{3,4}${SEP}\\d{4}`
const PHONE_IN_TEXT_PATTERN = new RegExp(
  `(?<!\\d)(?:${MOBILE_IN_TEXT}|${LANDLINE_IN_TEXT})(?!\\d)`,
  'g',
)

/** 번호 하나를 중복 판단용 키로 정규화한다 — 숫자만 남기고 국제 표기(82...)는
 * 국내 표기(0...)로 맞춘다. 위의 두 형태가 아니면 null. */
const normalizeSinglePhone = (raw: string): string | null => {
  const digits = normalizeDomesticPhone(raw.replace(/\D/g, ''))
  return VALID_MOBILE.test(digits) || VALID_LANDLINE.test(digits)
    ? digits
    : null
}

/** 유효한 휴대폰번호(010 11자리)인지 — 대표 번호를 고를 때 유선보다 먼저
 * 쓰기 위한 구분. */
export const isMobilePhone = (phone: string): boolean =>
  VALID_MOBILE.test(phone)

/** 휴대폰 컬럼(또는 item 이름)에 적힌 값에서 번호를 전부 뽑아 정규화한다.
 * 적힌 순서를 지키고 같은 번호는 한 번만 담는다. 번호로 볼 수 있는 게
 * 하나도 없으면 빈 배열(= 결측)이다. */
export const extractMondayPhones = (raw: string | null): string[] => {
  if (!raw) return []
  const phones = (raw.match(PHONE_IN_TEXT_PATTERN) ?? [])
    .map(normalizeSinglePhone)
    .filter((phone): phone is string => phone !== null)
  return [...new Set(phones)]
}

const toItemColumns = (
  item: RawMondayItem,
  columnsById: Map<string, MondayColumn>,
): Record<string, MondayItemColumn> => {
  const columns: Record<string, MondayItemColumn> = {}
  for (const value of item.column_values) {
    columns[value.id] = {
      title: columnsById.get(value.id)?.title ?? value.id,
      type: value.type,
      text: value.display_value ?? value.text ?? '',
    }
  }
  return columns
}

// item 이름(보드의 첫 컬럼)은 column_values에 들어 있지 않아서 따로 읽는다 —
// 설문 폼으로 만든 보드처럼 "성함 / 연락처"를 이름 칸 하나에 받는 경우다.
const NAME_COLUMN_ID = 'name'

const readPhoneRaw = (
  item: RawMondayItem,
  columns: Record<string, MondayItemColumn>,
  phoneColumnId: string | null,
): string | null => {
  if (!phoneColumnId) return null
  if (phoneColumnId === NAME_COLUMN_ID) return item.name || null
  return columns[phoneColumnId]?.text || null
}

/** Monday에서 받은 보드를 mondayItems 문서들로 바꾼다. */
export const buildMondayItems = (
  board: RawMondayBoard,
  phoneColumnId: string | null,
  syncedAt: number,
): MondayItem[] => {
  const columnsById = new Map(
    board.columns.map((column) => [column.id, column]),
  )

  return board.items.map((item) => {
    const columns = toItemColumns(item, columnsById)
    const phoneRaw = readPhoneRaw(item, columns, phoneColumnId)
    const phones = extractMondayPhones(phoneRaw)

    return {
      id: item.id,
      boardId: board.id,
      boardName: board.name,
      name: item.name,
      groupId: item.group?.id ?? null,
      groupTitle: item.group?.title ?? null,
      url: item.url ?? null,
      // 휴대폰과 유선번호가 같이 적혀 있으면 적힌 순서와 상관없이 휴대폰을
      // 대표 번호로 쓴다 — 다른 보드와 겹치는 건 대개 휴대폰 쪽이다.
      phone: phones.find(isMobilePhone) ?? phones[0] ?? null,
      phones,
      phoneRaw,
      columns,
      createdAt: item.created_at ?? null,
      updatedAt: item.updated_at ?? null,
      syncedAt,
    }
  })
}
