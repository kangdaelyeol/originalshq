import type { TechBoardKey, TechColumn } from './tech-boards'

// 타임라인 칸 — 상태 단계마다 그날 날짜를 남기는 날짜 칸들(대개 서버 보드 규칙이 채운다, functions-xtool
// tech-boards/rules.ts). Monday 표는 평소 이 칸들을 "타임라인" 칸 하나로 묶어 "보기"만 쓰고(누르거나 마우스를
// 올리면 단계별 날짜 카드), "타임라인 펼치기"를 켜면 그 자리에 칸마다 펼친다. 자리는 기본 맨 오른쪽이고 칸 순서를
// 바꾸면 한 덩이로 옮긴다(column-order.ts). 제목은 단계 순서대로 적는다(카드·펼친 칸도 이 순서). 접수일·방문일정처럼
// 자주 보거나 사람이 고치는 날짜는 넣지 않는다. 다른 보드는 줄을 더하면 켜진다.
export const TIMELINE_TITLES: Partial<Record<TechBoardKey, readonly string[]>> = {
  fieldService: [
    '일정 조율 시작일',
    '1차 안내',
    '최신 연락 일자 (일정 조율)',
    '일정 확정일',
    '완료일',
    '보류 시작일',
    '보류 종료일',
  ],
  repair: ['수령 후 1차 체크', '수리 중', '완료 후 견적 안내', '발송 완료', '완료일', '보류 시작일', '보류 종료일'],
}

/** 묶은 칸의 id — Monday 칸 id와 겹치지 않는 이름(칸 너비도 이 id로 기억한다) */
export const TIMELINE_ID = '__timeline'
const TIMELINE_TYPE = 'timeline'

/** 묶은 "타임라인" 칸 — 화면 전용 가짜 칸. parts는 묶인 날짜 칸(단계 순서) */
export interface TimelineColumn extends TechColumn {
  parts: TechColumn[]
}

// 제목 비교 — 공백·보이지 않는 글자를 빼고, 한글 조합 방식(NFC/NFD) 차이도 없앤다(서버 rules.ts와 같다).
export const titleKey = (title: string) => title.normalize('NFC').replace(/[\s\u200B-\u200D\uFEFF]/g, '')

/**
 * 보드의 타임라인 칸(날짜 칸만, 단계 순서) — 제목이 같은 날짜 칸, 없으면 제목을 포함하는 날짜 칸이 하나뿐일 때
 * 그것(예: "1차 안내일" — 서버 rules.ts findDateColumn과 같다). 목록에 없는 보드거나 칸을 못 찾으면 빈 목록.
 */
export function timelineColumns(boardKey: TechBoardKey, columns: readonly TechColumn[]): TechColumn[] {
  const taken = new Set<string>()
  return (TIMELINE_TITLES[boardKey] ?? []).flatMap((title) => {
    const dates = columns.filter((c) => c.type === 'date' && !taken.has(c.id))
    const near = dates.filter((c) => titleKey(c.title).includes(titleKey(title)))
    const column = dates.find((c) => titleKey(c.title) === titleKey(title)) ?? (near.length === 1 ? near[0] : undefined)
    if (!column) return []
    taken.add(column.id)
    return [column]
  })
}

export const isTimelineColumn = (column: TechColumn): column is TimelineColumn => column.type === TIMELINE_TYPE

/** 묶은 "타임라인" 칸 하나 — parts는 단계 순서의 타임라인 칸 */
export const timelineBundle = (parts: TechColumn[]): TimelineColumn => ({
  id: TIMELINE_ID,
  title: '타임라인',
  type: TIMELINE_TYPE,
  writable: false,
  parts,
})
