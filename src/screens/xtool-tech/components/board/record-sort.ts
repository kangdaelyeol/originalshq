// 기록 표의 정렬 — 대시보드 표(record-table.tsx)·물 표(components/water/board/record-table.tsx)와 둘이 같이 쓰는
// 줄 고르기(use-record-rows.ts)가 쓴다.

export type SortDir = 'asc' | 'desc'

/** 머리글 정렬 — 칸 열쇠와 방향 */
export interface RecordSort {
  key: string
  dir: SortDir
}

const isBlank = (v: unknown) => v === null || v === undefined || v === ''

/** 빈 값은 늘 뒤로, 숫자는 크기, 글자는 한국어 순서 */
export function compareValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  dir: SortDir,
): number {
  if (isBlank(a) || isBlank(b))
    return isBlank(a) === isBlank(b) ? 0 : isBlank(a) ? 1 : -1
  const diff =
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), 'ko', { numeric: true })
  return dir === 'asc' ? diff : -diff
}

/** 처음에 보여 줄 줄 수 — 완료 목록은 수백 건이라 "더 보기"로 늘린다. */
export const RECORD_PAGE = 30

/** 머리글 하나의 정렬 표시 — 이 칸의 방향(아니면 null), aria-sort, 누르면 어떻게 되는지(title) */
export function sortHeader(
  sort: RecordSort | null,
  key: string,
): { dir: SortDir | null; ariaSort: 'ascending' | 'descending' | undefined; title: string } {
  const dir = sort?.key === key ? sort.dir : null
  return {
    dir,
    ariaSort: dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined,
    title: dir === 'asc' ? '내림차순으로' : dir === 'desc' ? '정렬 해제' : '오름차순으로',
  }
}
