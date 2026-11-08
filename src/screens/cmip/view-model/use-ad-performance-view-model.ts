import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AD_ATTRIBUTION_DAYS,
  AD_GROUP_CHANNELS,
  MEDIA_CHANNELS,
  adGroupSpendOf,
  buildAdPerformance,
  buildLeadCohorts,
  getAdGroupInsights,
  getLeadQuality,
  getMetaAdInsights,
  hasLeadOutcomes,
  isAdChannel,
  metaSpendOf,
  type AdGroupInsights,
  type AttributionRow,
  type ChannelSpend,
  type LeadQualityRow,
  type MediaChannel,
  type MetaAdInsights,
  type PurchaseScope,
} from '../client'
import type { ISODate } from '../types'
import { oneOf, usePersistentState } from '@/hooks/use-persistent-state'
import type { EfficiencySort } from '../components/ad-efficiency'

export type AdPerformanceDisplay = 'chart' | 'table'

export const PURCHASE_SCOPE_LABEL: Record<PurchaseScope, string> = {
  all: '통합',
  offline: '오프라인',
  online: '온라인',
}

/** 유입월 결제 전환 표의 매체 — 전체(광고비가 있는 다섯 매체) 또는 하나. */
export type CohortChannel = 'all' | MediaChannel

/** 유입월 결제 전환 표의 달 수 — 조회 끝 날짜의 달까지. */
export const LEAD_COHORT_MONTHS = 6

// 탭을 오갈 때마다 다시 받지 않도록 조회 구간별로 들고 있는다 — 받은 값과
// 받는 중인 요청(같은 구간을 두 번 받지 않게). 최근 CACHE_LIMIT개 구간만
// 남기고, 화면의 새로고침이면 비운다(clearAdPerformanceCaches).
interface LoadCache<T> {
  done: Map<string, T>
  pending: Map<string, Promise<T>>
}
const newCache = <T>(): LoadCache<T> => ({
  done: new Map(),
  pending: new Map(),
})
const CACHE_LIMIT = 6
const metaCache = newCache<MetaAdInsights>()
const adGroupCache = newCache<AdGroupInsights>()
const qualityCache = newCache<LeadQualityRow[]>()

/** 받아 둔 광고비·오기입률 재료를 버린다 — 새로고침이 고객 데이터와 같은 때의
 * 값으로 다시 받게. */
export const clearAdPerformanceCaches = (): void => {
  for (const cache of [metaCache, adGroupCache, qualityCache]) {
    cache.done.clear()
    cache.pending.clear()
  }
}

type Load<T> = { key: string; data: T | null; error: string | null }

/** 구간 [start, end]를 한 번 받아 두는 조회 — 받아 둔 구간이면 바로 그것을
 * 쓰고, 받는 중이면 그 요청을 같이 기다리고, 아니면 받는다. enabled가
 * 아니면(기간이 잘못됨) 받지 않는다. 받는 중이면 null, 실패하면 error. */
const useCachedLoad = <T>(
  cache: LoadCache<T>,
  load: (start: ISODate, end: ISODate) => Promise<T>,
  start: ISODate,
  end: ISODate,
  label: string,
  enabled: boolean,
): Load<T> | null => {
  const key = `${start}_${end}`
  const [state, setState] = useState<Load<T> | null>(null)
  const hit = enabled ? cache.done.get(key) : undefined
  useEffect(() => {
    if (!enabled || cache.done.has(key) || state?.key === key) return
    let cancelled = false
    let pending = cache.pending.get(key)
    if (!pending) {
      pending = load(start, end)
      cache.pending.set(key, pending)
      pending.then(
        (data) => {
          cache.pending.delete(key)
          cache.done.set(key, data)
          // 오래된 구간부터 버린다(Map은 넣은 순서를 지킨다).
          for (const old of cache.done.keys()) {
            if (cache.done.size <= CACHE_LIMIT) break
            cache.done.delete(old)
          }
        },
        () => cache.pending.delete(key),
      )
    }
    pending.then(
      (data) => {
        if (!cancelled) setState({ key, data, error: null })
      },
      (err: unknown) => {
        console.error(`${label} 조회 실패:`, err)
        if (!cancelled) {
          setState({
            key,
            data: null,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [cache, load, start, end, label, key, enabled, state?.key])
  if (!enabled) return null
  if (hit) return { key, data: hit, error: null }
  return state?.key === key ? state : null
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const minusDays = (date: ISODate, days: number): ISODate =>
  new Date(Date.parse(date) - days * 86_400_000).toISOString().slice(0, 10)

/**
 * "광고 성과" 탭 — 매체마다 광고비 데이터(Meta는 광고 단위, 나머지는
 * 광고그룹 단위)를 받아(조회 시작 89일 전부터: 기간 앞쪽 구매의 상담일에 돈
 * 광고를 찾으려고) Monday 고객 utm과 맞춘 표를 만든다. 매체·캠페인·광고셋
 * 줄은 눌러서 펼친다.
 */
export const useAdPerformanceViewModel = (
  attribution: AttributionRow[] | null,
  dateStart: ISODate,
  dateEnd: ISODate,
) => {
  // 기간이 잘못됐으면(입력 칸을 비운 채 적용 등) 받지도 계산하지도 않는다 —
  // 날짜 계산이 오류를 던진다.
  const rangeValid =
    ISO_DATE.test(dateStart) &&
    ISO_DATE.test(dateEnd) &&
    !Number.isNaN(Date.parse(dateStart)) &&
    !Number.isNaN(Date.parse(dateEnd)) &&
    dateStart <= dateEnd
  const fetchStart = rangeValid
    ? minusDays(dateStart, AD_ATTRIBUTION_DAYS - 1)
    : dateStart
  const metaLoad = useCachedLoad(
    metaCache,
    getMetaAdInsights,
    fetchStart,
    dateEnd,
    'Meta 광고 단위 데이터',
    rangeValid,
  )
  const adGroupLoad = useCachedLoad(
    adGroupCache,
    getAdGroupInsights,
    fetchStart,
    dateEnd,
    '광고그룹 단위 데이터',
    rangeValid,
  )
  // 오기입률 재료 — 조회 기간의 UTM 상담 수. 못 받으면 오기입률만 비운다.
  const qualityLoad = useCachedLoad(
    qualityCache,
    getLeadQuality,
    dateStart,
    dateEnd,
    '오기입률 재료',
    rangeValid,
  )

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [showUnmatched, setShowUnmatched] = useState(false)
  // 줄을 그래프(효율 막대)로 볼지 표로 볼지, 그래프의 정렬 — 이 브라우저에
  // 남는다. 그래프가 기본(표는 정확한 값이 필요할 때).
  const [display, setDisplay] = usePersistentState<AdPerformanceDisplay>(
    'cmip.adPerformance.display',
    'chart',
    oneOf<AdPerformanceDisplay>(['chart', 'table']),
  )
  const [sort, setSort] = usePersistentState<EfficiencySort>(
    'cmip.adPerformance.sort',
    'spend',
    oneOf<EfficiencySort>(['spend', 'roas', 'revenue']),
  )
  // 결제 전환을 셀 구매 범위(공통 정의 D4) — 이 브라우저에 남는다.
  const [scope, setScope] = usePersistentState<PurchaseScope>(
    'cmip.adPerformance.purchaseScope',
    'all',
    oneOf<PurchaseScope>(['all', 'offline', 'online']),
  )
  const [cohortChannel, setCohortChannel] = usePersistentState<CohortChannel>(
    'cmip.adPerformance.cohortChannel',
    'all',
    oneOf<CohortChannel>(['all', ...MEDIA_CHANNELS]),
  )

  // 매체마다 광고비 데이터 — 못 받은 쪽은 빠진다(그 매체 리드도 세지 않는다).
  const metaData = metaLoad?.data ?? null
  const adGroupData = adGroupLoad?.data ?? null
  const spends = useMemo(() => {
    const out: Partial<Record<MediaChannel, ChannelSpend>> = {}
    if (metaData) out.meta = metaSpendOf(metaData)
    if (adGroupData) {
      for (const channel of AD_GROUP_CHANNELS) {
        const data = adGroupData.channels[channel]
        if (data) out[channel] = adGroupSpendOf(data)
      }
    }
    return out
  }, [metaData, adGroupData])
  const loading = !metaLoad || !adGroupLoad
  const qualityRows = qualityLoad?.data ?? null
  const performance = useMemo(
    () =>
      attribution && !loading && (metaData || adGroupData)
        ? buildAdPerformance(
            attribution,
            spends,
            dateStart,
            dateEnd,
            qualityRows,
            scope,
          )
        : null,
    [
      attribution,
      loading,
      metaData,
      adGroupData,
      spends,
      dateStart,
      dateEnd,
      qualityRows,
      scope,
    ],
  )
  // 유입월 결제 전환 — 고른 매체의 유효 리드 전체(광고를 못 찾은 것도), 달 전체.
  const cohorts = useMemo(
    () =>
      attribution && rangeValid
        ? buildLeadCohorts(
            attribution,
            new Set(cohortChannel === 'all' ? MEDIA_CHANNELS : [cohortChannel]),
            dateEnd,
            LEAD_COHORT_MONTHS,
            scope,
          )
        : [],
    [attribution, rangeValid, cohortChannel, dateEnd, scope],
  )
  // 방문체험 예약일·범위별 첫 결제일이 든 데이터인지 — 서버를 고친 뒤 첫
  // 동기화 전에는 없다(그동안 그 칸은 비운다).
  const outcomesReady = useMemo(
    () =>
      attribution?.some((row) => isAdChannel(row[1]) && hasLeadOutcomes(row)) ??
      false,
    [attribution],
  )

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return {
    status: !rangeValid
      ? 'invalid'
      : loading
        ? 'loading'
        : metaLoad.error && adGroupLoad.error
          ? 'error'
          : 'ready',
    /** 광고비 데이터를 못 받은 쪽 — 둘 다면 status가 error. channels는 다른
     * 매체 중 서버가 못 읽은 매체(또는 소재 이름 대응)와 그 이유. */
    errors: {
      meta: metaLoad?.error ?? null,
      adGroups: adGroupLoad?.error ?? null,
      channels: adGroupData?.errors ?? {},
    },
    attributionMissing: attribution === null,
    performance,
    cohorts,
    cohortChannel,
    setCohortChannel,
    outcomesReady,
    qualityStatus: !qualityLoad
      ? 'loading'
      : qualityLoad.error
        ? 'error'
        : 'ready',
    scope,
    setScope,
    expanded,
    toggle,
    showUnmatched,
    setShowUnmatched,
    display,
    setDisplay,
    sort,
    setSort,
  } as const
}
