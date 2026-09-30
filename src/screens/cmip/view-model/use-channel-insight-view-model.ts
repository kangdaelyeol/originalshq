import { useCallback, useState } from 'react'
import {
  getAllInsights,
  getGoogleInsights,
  getNaverInsights,
  getOfflineRevenue,
  getCafe24Revenue,
  combineChannelInsights,
  normalizeInsightSummary,
  CallableError,
  type CombinedInsight,
  type MetaInsightSummary,
  type OfflineRevenueSummary,
  type Cafe24RevenueSummary,
} from '../client'
import { readSessionCache, writeSessionCache } from '../client/session-cache'
import { addDays, fromISO, toISO, todayISO } from '../utils'
import type { ISODate } from '../types'

/** 한 번의 조회(loadRange)가 만들어내는 다섯 결과 — 세션 캐시에 이 통째로
 * 저장해두고, 같은 기간을 다시 조회할 때 그대로 복원한다. */
interface InsightLoadResult {
  metaResult: MetaInsightSummary
  googleResult: MetaInsightSummary
  naverResult: MetaInsightSummary
  offlineRevenueResult: OfflineRevenueSummary
  onlineRevenueResult: Cafe24RevenueSummary
}

const cacheKeyFor = (start: ISODate, end: ISODate): string => `${start}:${end}`

/** 기본 조회 기간 — 최근 7일. 오늘은 아직 데이터가 다 안 쌓였을 수 있어 어제까지로
 * 센다(date-range-picker의 "지난 7일" 프리셋과 동일한 정의). */
const DEFAULT_RANGE_DAYS = 7

/**
 * <input type="date">의 value는 이미 "YYYY-MM-DD" 문자열이지만, getAllInsights는
 * 이 포맷을 그대로 요구하는 쿼리 파라미터이므로 호출 직전에 한 번 더 정규화한다
 * (다른 입력 UI로 바뀌어도 이 지점만 고치면 되도록).
 */
const formatForApi = (value: string): ISODate => toISO(fromISO(value))

export const useChannelInsightViewModel = () => {
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
  // 오프라인 매출(Monday CRM, ROAS 탭 전용) — 광고 채널과 모양이 달라(impressions/
  // clicks 없음, totalPaid/revenue/discount) combinedInsight로 합치지 않고 따로
  // 둔다. 같은 dateStart/dateEnd로 같이 조회해 ROAS 탭도 별도 조회 버튼 없이
  // 바로 보이게 한다.
  const [offlineRevenueData, setOfflineRevenueData] =
    useState<OfflineRevenueSummary | null>(null)
  // 온라인 매출(Cafe24, ROAS 탭 전용) — offlineRevenueData와 같은 이유로
  // combinedInsight와 따로 둔다. 오프라인/온라인을 구분해서 보여줘야 해서
  // 하나로 합치지 않는다.
  const [onlineRevenueData, setOnlineRevenueData] =
    useState<Cafe24RevenueSummary | null>(null)
  // total은 물론 캠페인/adset 단위까지 "종합(meta+google+naver)/meta/google/naver"
  // 4분할로 미리 묶어둔다 — 당근 등 채널이 더 늘어나면 combineChannelInsights
  // 쪽만 확장하면 된다.
  const [combinedInsight, setCombinedInsight] =
    useState<CombinedInsight | null>(null)

  const describeError = (err: unknown, fallback: string): string =>
    err instanceof CallableError || err instanceof Error
      ? err.message
      : fallback

  // 조회 결과(다섯 개) state를 한 번에 반영 — 캐시 적중/신규 fetch 두 경로가
  // 공유한다.
  const applyResult = useCallback(
    (apiStart: ISODate, apiEnd: ISODate, result: InsightLoadResult) => {
      setData(result.metaResult)
      setGoogleData(result.googleResult)
      setNaverData(result.naverResult)
      setOfflineRevenueData(result.offlineRevenueResult)
      setOnlineRevenueData(result.onlineRevenueResult)
      setCombinedInsight(
        combineChannelInsights(
          result.metaResult,
          result.googleResult,
          result.naverResult,
          apiStart,
          apiEnd,
          result.offlineRevenueResult,
          result.onlineRevenueResult,
        ),
      )
    },
    [],
  )

  // dateStart/dateEnd state를 거치지 않고 인자로 받은 범위를 바로 조회한다 —
  // "date-range-picker에서 방금 고른 값으로 즉시 조회" 같은 경우, setState 직후
  // 같은 틱에 훅의 dateStart/dateEnd를 읽으면 아직 반영 전(stale)이라 어긋난다.
  //
  // 세션 캐시: 같은 (dateStart, dateEnd)를 이미 이 세션에서 조회했으면(force가
  // 아닌 한) Meta/Google/Naver 라이브 API를 다시 부르지 않고 그 결과를 그대로
  // 쓴다 — 특히 네이버는 라이브 조회가 하루당 순차 호출이라 느려서(client.ts
  // 참고) 같은 기간을 반복 조회할 때 체감 효과가 크다. force=true(새로고침
  // 버튼)는 이 캐시를 무시하고 항상 새로 fetch한 뒤 캐시를 그 값으로 덮어써
  // 최신화한다.
  const loadRange = useCallback(
    async (start: ISODate, end: ISODate, options?: { force?: boolean }) => {
      if (!start || !end) {
        setError('시작일과 종료일을 모두 입력해주세요.')
        return
      }
      const apiStart = formatForApi(start)
      const apiEnd = formatForApi(end)
      const cacheKey = cacheKeyFor(apiStart, apiEnd)

      if (!options?.force) {
        const cached = readSessionCache<InsightLoadResult>(cacheKey)
        if (cached) {
          setError(null)
          applyResult(apiStart, apiEnd, cached)
          return
        }
      }

      setError(null)
      setLoading(true)
      try {
        const [metaRaw, googleRaw, naverRaw, offlineRevenueResult, onlineRevenueResult] =
          await Promise.all([
            getAllInsights(apiStart, apiEnd),
            getGoogleInsights(apiStart, apiEnd),
            getNaverInsights(apiStart, apiEnd),
            getOfflineRevenue(apiStart, apiEnd),
            getCafe24Revenue(apiStart, apiEnd),
          ])
        // Meta/Google/Naver는 offlineRevenue 개념 자체를 모르는 백엔드에서 와서
        // 그 필드가 아예 없다 — KpiGrid 등이 MetricsSummary를 곧장(aggregateMetrics를
        // 안 거치고) 렌더하는 자리에서 값이 undefined인 채로 쓰이지 않도록, 저장/
        // 합치기 전에 한 번 0으로 채워 넣는다.
        const result: InsightLoadResult = {
          metaResult: normalizeInsightSummary(metaRaw),
          googleResult: normalizeInsightSummary(googleRaw),
          naverResult: normalizeInsightSummary(naverRaw),
          offlineRevenueResult,
          onlineRevenueResult,
        }
        applyResult(apiStart, apiEnd, result)
        writeSessionCache(cacheKey, result)
      } catch (err) {
        // Meta/Google/Naver 중 어느 쪽이 실패해도 여기로 온다 — CallableError는 항상
        // 구체적인 메시지를 담고 있어 이 폴백은 거의 쓰이지 않지만, 특정 채널
        // 이름으로 단정하지 않는다.
        setError(describeError(err, '인사이트 조회 중 오류가 발생했습니다.'))
      } finally {
        setLoading(false)
      }
    },
    [applyResult],
  )

  // 현재 state의 dateStart/dateEnd로 조회 — 초기 진입 시 자동 조회 등 "지금 화면에
  // 표시된 기간을 그대로 다시 조회"할 때 쓴다(캐시 적중하면 그대로 씀).
  const load = useCallback(
    () => loadRange(dateStart, dateEnd),
    [loadRange, dateStart, dateEnd],
  )

  // 새로고침 — 지금 보고 있는 기간을 세션 캐시 무시하고 강제로 다시 조회한다.
  const refresh = useCallback(
    () => loadRange(dateStart, dateEnd, { force: true }),
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
    offlineRevenueData,
    onlineRevenueData,
    combinedInsight,
    // 액션
    load,
    loadRange,
    refresh,
  }
}
