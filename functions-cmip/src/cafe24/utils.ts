import { addDays, diffDays, fromISO } from '../channel/utils'
import type { ISODate } from '../types'

export interface DateRange {
  start: ISODate
  end: ISODate
}

/** 주차 경계 — monday-crm/utils.ts와 완전히 같은 알고리즘(조회 구간을 시작일
 * 기준 7일씩, 나머지는 첫 구간에 몰아준다)을 이 통합 전용으로 다시 둔다.
 * 모듈 독립성 우선(이 코드베이스의 channel/meta·naver·monday-crm이 전부 같은
 * 이유로 각자 복사본을 갖고 있다) — cafe24가 monday-crm을 참조할 이유가
 * 없어서다. */
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

/** Cafe24 주문 목록 API는 한 번 조회에 최대 3개월(대략 92일)까지만 허용한다
 * — 그보다 긴 범위(과거 백필 등)는 이 함수로 3개월 이하 구간들로 잘라
 * 순서대로 호출해야 한다. 안전하게 90일로 자른다(월별 일수 차이 고려). */
export const chunkDateRangeForCafe24 = (
  startDate: ISODate,
  endDate: ISODate,
  maxDaysPerChunk = 90,
): DateRange[] => {
  const ranges: DateRange[] = []
  let cursor = startDate

  while (cursor <= endDate) {
    const chunkEnd = addDays(cursor, maxDaysPerChunk - 1)
    const rangeEnd = chunkEnd < endDate ? chunkEnd : endDate
    ranges.push({ start: cursor, end: rangeEnd })
    cursor = addDays(rangeEnd, 1)
  }

  return ranges
}
