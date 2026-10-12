import { MondayItem } from './types'

// 컬럼은 id가 아니라 제목으로 찾는다 — 같은 뜻의 컬럼이라도 보드마다 id가
// 다르고(전화번호만 해도 넷), 띄어쓰기도 제각각("콜백 1단계 진행일" /
// "콜백1단계일")이라서다. 제목에서 공백을 뺀 뒤 패턴과 맞춰 본다.
export const squash = (title: string): string => title.replace(/\s/g, '')

/** item에서 제목이 패턴에 맞는 첫 컬럼의 값 — 없거나 비었으면 null. */
export const pick = (item: MondayItem, pattern: RegExp): string | null => {
  for (const column of Object.values(item.columns)) {
    if (pattern.test(squash(column.title)) && column.text.trim()) {
      return column.text.trim()
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
