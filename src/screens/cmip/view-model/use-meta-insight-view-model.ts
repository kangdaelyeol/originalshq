import { useCallback, useState } from 'react'
import {
  getAllInsights,
  CallableError,
  type MetaInsightSummary,
} from '../client'
import { addDays, fromISO, toISO, todayISO } from '../utils'
import type { ISODate } from '../types'

/** 기본 조회 기간 — 최근 7일(오늘 포함). */
const DEFAULT_RANGE_DAYS = 6

/**
 * <input type="date">의 value는 이미 "YYYY-MM-DD" 문자열이지만, getAllInsights는
 * 이 포맷을 그대로 요구하는 쿼리 파라미터이므로 호출 직전에 한 번 더 정규화한다
 * (다른 입력 UI로 바뀌어도 이 지점만 고치면 되도록).
 */
const formatForApi = (value: string): ISODate => toISO(fromISO(value))

export const useMetaInsightViewModel = () => {
  const [dateStart, setDateStart] = useState<ISODate>(() =>
    addDays(todayISO(), -DEFAULT_RANGE_DAYS),
  )
  const [dateEnd, setDateEnd] = useState<ISODate>(() => todayISO())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<MetaInsightSummary | null>(null)

  const describeError = (err: unknown, fallback: string): string =>
    err instanceof CallableError || err instanceof Error ? err.message : fallback

  const load = useCallback(async () => {
    if (!dateStart || !dateEnd) {
      setError('시작일과 종료일을 모두 입력해주세요.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const result = await getAllInsights(
        formatForApi(dateStart),
        formatForApi(dateEnd),
      )
      setData(result)
    } catch (err) {
      setError(describeError(err, 'Meta 인사이트 조회 중 오류가 발생했습니다.'))
    } finally {
      setLoading(false)
    }
  }, [dateStart, dateEnd])

  return {
    // 입력
    dateStart,
    setDateStart,
    dateEnd,
    setDateEnd,
    // 진행 상태
    loading,
    error,
    // 결과
    data,
    // 액션
    load,
  }
}
