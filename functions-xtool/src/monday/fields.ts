import { MondayItem } from './types'

// 컬럼은 id가 아니라 제목으로 찾는다 — 같은 뜻의 컬럼이라도 보드마다 id가
// 다르고(전화번호만 해도 넷), 띄어쓰기도 제각각("콜백 1단계 진행일" /
// "콜백1단계일")이라서다. 제목에서 공백을 뺀 뒤 패턴과 맞춰 본다.
export const squash = (title: string): string => title.replace(/\s/g, '')

// 값이 없다는 뜻으로 적힌 글자들 — 문의 폼이 빈 값을 글자 "null"로 넘긴 것이
// Monday에 그대로 저장돼 있다(fbc·fbp에 많다). 진짜 값이 아니므로 비어 있는
// 것과 똑같이 다룬다.
const EMPTY_TEXT = /^(null|undefined)$/i

/** item에서 제목이 패턴에 맞는 첫 컬럼의 값 — 없거나 비었으면(또는 "null"
 * 이라고 적혀 있으면) null. */
export const pick = (item: MondayItem, pattern: RegExp): string | null => {
  for (const column of Object.values(item.columns)) {
    const text = column.text.trim()
    if (pattern.test(squash(column.title)) && text && !EMPTY_TEXT.test(text)) {
      return text
    }
  }
  return null
}

/** 체크박스 컬럼 — 체크돼 있으면 값이 "v"로 온다. */
export const checked = (item: MondayItem, pattern: RegExp): boolean =>
  pick(item, pattern) !== null

/** item 이름에서 고객 이름만 남긴다 — 만족도 조사 보드처럼 "홍길동/010-…"로
 * 이름 칸에 연락처까지 받은 경우 번호와 구분 기호를 떼어낸다. */
export const cleanName = (name: string): string =>
  name
    .replace(/(?:\+?82[\s.-]*)?0?\d{1,2}[\s.-]*\d{3,4}[\s.-]*\d{4}/g, ' ')
    .replace(/[\s/,·|-]+$/g, '')
    .replace(/^[\s/,·|-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export const source = (item: MondayItem) => ({
  itemId: item.id,
  boardId: item.boardId,
  boardName: item.boardName,
  name: cleanName(item.name),
  url: item.url,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
})

/** Monday가 준 시각(ISO, UTC)을 한국 날짜(YYYY-MM-DD)로 — UTC 날짜를 그대로
 * 자르면 한국 시간 자정~오전 9시에 만들어진 기록이 전날로 잡힌다. 날짜만
 * 있는 값("2026-09-17")이나 시각이 붙어도 표준시 표기가 없는 값("2026-09-17
 * 14:00", 보드에 사람이 적은 한국 시간)은 앞 10자를 그대로 쓴다. */
export const koreaDate = (value: string | null): string | null => {
  if (!value) return null
  if (!/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)) return value.slice(0, 10)
  const time = Date.parse(value)
  if (Number.isNaN(time)) return value.slice(0, 10)
  return new Date(time + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
