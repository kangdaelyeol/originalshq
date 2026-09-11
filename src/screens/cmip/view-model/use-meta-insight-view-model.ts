import { useCallback, useState } from 'react'
import {
  getAllInsights,
  getGoogleInsightsMock,
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
  // 구글 인사이트는 아직 토큰 발급 전이라 실제 API 대신 목업으로 같은 조회 액션에
  // 묶어서 받는다 — functions는 건드리지 않고 프론트에서만 임시로 채워 넣는 것.
  // 나중에 실제 연동이 끝나면 getGoogleInsightsMock 호출부만 바꾸면 된다.
  const [googleData, setGoogleData] = useState<MetaInsightSummary | null>(null)

  const describeError = (err: unknown, fallback: string): string =>
    err instanceof CallableError || err instanceof Error
      ? err.message
      : fallback

  const load = useCallback(async () => {
    if (!dateStart || !dateEnd) {
      setError('시작일과 종료일을 모두 입력해주세요.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const apiStart = formatForApi(dateStart)
      const apiEnd = formatForApi(dateEnd)
      const [metaResult, googleResult] = await Promise.all([
        getAllInsights(apiStart, apiEnd),
        getGoogleInsightsMock(apiStart, apiEnd),
      ])
      setData(metaResult)
      setGoogleData(googleResult)
      console.log(metaResult)
      console.log(googleResult)
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
    googleData,
    // 액션
    load,
  }
}
