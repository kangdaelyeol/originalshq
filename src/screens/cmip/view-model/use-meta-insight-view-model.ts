import { useCallback, useState } from 'react'
import {
  getAllInsights,
  getGoogleInsights,
  getNaverInsights,
  combineChannelInsights,
  CallableError,
  type CombinedInsight,
  type MetaInsightSummary,
} from '../client'
import { addDays, fromISO, toISO, todayISO } from '../utils'
import type { ISODate } from '../types'

/** 기본 조회 기간 — 최근 7일. 오늘은 아직 데이터가 다 안 쌓였을 수 있어 어제까지로
 * 센다(date-range-picker의 "지난 7일" 프리셋과 동일한 정의). */
const DEFAULT_RANGE_DAYS = 7

/**
 * <input type="date">의 value는 이미 "YYYY-MM-DD" 문자열이지만, getAllInsights는
 * 이 포맷을 그대로 요구하는 쿼리 파라미터이므로 호출 직전에 한 번 더 정규화한다
 * (다른 입력 UI로 바뀌어도 이 지점만 고치면 되도록).
 */
const formatForApi = (value: string): ISODate => toISO(fromISO(value))

export const useMetaInsightViewModel = () => {
  const [dateEnd, setDateEnd] = useState<ISODate>(() => addDays(todayISO(), -1))
  const [dateStart, setDateStart] = useState<ISODate>(() =>
    addDays(todayISO(), -DEFAULT_RANGE_DAYS),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<MetaInsightSummary | null>(null)
  // 구글 인사이트 — getGoogleInsights가 실제 Google Ads 연동(getGoogleCampaignInsight
  // + getGoogleAdsInsight)을 getAllInsights와 같은 모양으로 합쳐 돌려준다.
  const [googleData, setGoogleData] = useState<MetaInsightSummary | null>(null)
  // 네이버 인사이트 — getNaverInsights가 getAllInsights와 같은 모양(서버에서 이미
  // total/byDate/byCampaign까지 집계)으로 돌려준다.
  const [naverData, setNaverData] = useState<MetaInsightSummary | null>(null)
  // total은 물론 캠페인/adset 단위까지 "종합(meta+google+naver)/meta/google/naver"
  // 4분할로 미리 묶어둔다 — 당근 등 채널이 더 늘어나면 combineChannelInsights
  // 쪽만 확장하면 된다.
  const [combinedInsight, setCombinedInsight] =
    useState<CombinedInsight | null>(null)

  const describeError = (err: unknown, fallback: string): string =>
    err instanceof CallableError || err instanceof Error
      ? err.message
      : fallback

  // dateStart/dateEnd state를 거치지 않고 인자로 받은 범위를 바로 조회한다 —
  // "date-range-picker에서 방금 고른 값으로 즉시 조회" 같은 경우, setState 직후
  // 같은 틱에 훅의 dateStart/dateEnd를 읽으면 아직 반영 전(stale)이라 어긋난다.
  const loadRange = useCallback(async (start: ISODate, end: ISODate) => {
    if (!start || !end) {
      setError('시작일과 종료일을 모두 입력해주세요.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const apiStart = formatForApi(start)
      const apiEnd = formatForApi(end)
      const [metaResult, googleResult, naverResult] = await Promise.all([
        getAllInsights(apiStart, apiEnd),
        getGoogleInsights(apiStart, apiEnd),
        getNaverInsights(apiStart, apiEnd),
      ])
      setData(metaResult)
      setGoogleData(googleResult)
      setNaverData(naverResult)
      setCombinedInsight(
        combineChannelInsights(
          metaResult,
          googleResult,
          naverResult,
          apiStart,
          apiEnd,
        ),
      )
    } catch (err) {
      // Meta/Google/Naver 중 어느 쪽이 실패해도 여기로 온다 — CallableError는 항상
      // 구체적인 메시지를 담고 있어 이 폴백은 거의 쓰이지 않지만, 특정 채널
      // 이름으로 단정하지 않는다.
      setError(describeError(err, '인사이트 조회 중 오류가 발생했습니다.'))
    } finally {
      setLoading(false)
    }
  }, [])

  // 현재 state의 dateStart/dateEnd로 조회 — 초기 진입 시 자동 조회 등 "지금 화면에
  // 표시된 기간을 그대로 다시 조회"할 때 쓴다.
  const load = useCallback(
    () => loadRange(dateStart, dateEnd),
    [loadRange, dateStart, dateEnd],
  )

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
    naverData,
    combinedInsight,
    // 액션
    load,
    loadRange,
  }
}
