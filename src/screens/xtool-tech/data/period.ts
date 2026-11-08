import { MY_WORK_PATH, xtPath } from '../paths'

import type { Period } from '@xtool-core/period'

export type { Period }

// 기간 고르는 단추·비교 이름은 앱과 같이 쓴다(@xtool-core/period).
export { PERIOD_COMPARE, PERIOD_OPTIONS } from '@xtool-core/period'

/**
 * 상단바에 기간 고르기를 보일 화면 — 보드·내 업무에서만(숫자 카드의 "… 완료"가 이 기간을 센다). 대시보드 상단바와
 * 물 상단바가 같이 쓴다. Monday 표 판 머리말은 숫자 카드가 없어 상단바가 따로 뺀다.
 */
export const showsPeriodPicker = (pathname: string): boolean =>
  pathname.startsWith(xtPath('/boards/')) || pathname.startsWith(MY_WORK_PATH)

const TODAY = new Date()

const daysAgo = (n: number): Date => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - n)
  return d
}

const monthDay = (d: Date): string => `${d.getMonth() + 1}/${d.getDate()}`

/** 기간별 x축 칸 — 오늘은 2시간, 7일은 하루, 30일은 3일, 1년은 한 달 단위. */
export function periodBuckets(period: Period): string[] {
  switch (period) {
    case 'today':
      return Array.from({ length: 12 }, (_, i) => `${String(i * 2).padStart(2, '0')}시`)
    case '7d':
      return Array.from({ length: 7 }, (_, i) => monthDay(daysAgo(6 - i)))
    case '30d':
      return Array.from({ length: 10 }, (_, i) => monthDay(daysAgo(29 - i * 3)))
    case '1y':
      return Array.from({ length: 12 }, (_, i) => `${((TODAY.getMonth() + 1 + i) % 12) + 1}월`)
  }
}
