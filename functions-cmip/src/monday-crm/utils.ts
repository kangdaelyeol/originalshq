import { addDays, diffDays, fromISO } from '../channel/utils'
import type { ISODate } from '../types'

export interface DateRange {
  start: ISODate
  end: ISODate
}

export const round2 = (n: number): number => Math.round(n * 100) / 100

/** 주차 경계 — channel/meta/utils.ts·channel/naver/utils.ts의 buildWeekRanges와
 * 같은 알고리즘(조회 구간을 시작일 기준으로 7일씩 자르되, 나머지 일수는 맨
 * 앞 구간에 몰아준다)을 UTC-safe 날짜 primitive(channel/utils/dates.ts) 위에
 * 다시 구현했다 — 전체 앱에서 "주차" 라벨이 어떤 채널이든 같은 기준으로
 * 잘려야 하기 때문에 로직은 그대로 두고, 원본(meta/naver 쪽)이 로컬 타임존
 * Date 메서드를 쓰던 부분만 UTC 기준으로 바꿨다. */
export const buildWeekRanges = (
  startDate: ISODate,
  endDate: ISODate,
): DateRange[] => {
  const totalDays = diffDays(startDate, endDate) + 1
  const remainder = totalDays % 7

  const ranges: DateRange[] = []
  let cursor = startDate

  if (remainder > 0) {
    const rangeEnd = addDays(cursor, remainder - 1)
    ranges.push({ start: cursor, end: rangeEnd })
    cursor = addDays(cursor, remainder)
  }

  while (cursor <= endDate) {
    const rangeEnd = addDays(cursor, 6)
    ranges.push({ start: cursor, end: rangeEnd })
    cursor = addDays(cursor, 7)
  }

  return ranges
}

export const formatMD = (iso: ISODate): string => {
  const d = fromISO(iso)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
}
