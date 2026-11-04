// 기록 표(물)의 정렬 — 기존 record-table.tsx와 같은 규칙(그쪽은 내보내지 않아 옮겨 둔다).

export type SortDir = 'asc' | 'desc'

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

/** 처음에 보여 줄 줄 수 — 완료 목록은 수백 건이라 "더 보기"로 늘린다(기존과 같다). */
export const RECORD_PAGE = 30
