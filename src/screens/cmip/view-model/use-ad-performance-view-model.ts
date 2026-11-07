import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildAdPerformance,
  buildLeadCohorts,
  getLeadQuality,
  getMetaAdInsights,
  hasLeadOutcomes,
  type AttributionRow,
  type LeadQualityRow,
  type MetaAdInsights,
  type PurchaseScope,
} from '../client'
import type { ISODate } from '../types'
import { AD_ATTRIBUTION_DAYS } from '../client'
import { oneOf, usePersistentState } from '@/hooks/use-persistent-state'
import type { EfficiencySort } from '../components/ad-efficiency'

export type AdPerformanceDisplay = 'chart' | 'table'

export const PURCHASE_SCOPE_LABEL: Record<PurchaseScope, string> = {
  all: '통합',
  offline: '오프라인',
  online: '온라인',
}

/** 유입월 결제 전환 표의 달 수 — 조회 끝 날짜의 달까지. */
export const LEAD_COHORT_MONTHS = 6

// 탭을 오갈 때마다 다시 받지 않도록 조회 구간별로 들고 있는다(새로고침하면
// 사라진다).
const cache = new Map<string, MetaAdInsights>()
const qualityCache = new Map<string, LeadQualityRow[]>()

type QualityLoad = {
  key: string
  rows: LeadQualityRow[] | null
  error: string | null
}

const minusDays = (date: ISODate, days: number): ISODate =>
  new Date(Date.parse(date) - days * 86_400_000).toISOString().slice(0, 10)

/**
 * "광고 성과" 탭 — Meta 광고 단위 데이터를 받아(조회 시작 89일 전부터: 기간
 * 앞쪽 구매의 상담일에 돈 광고를 찾으려고) Monday 고객 utm과 맞춘 표를
 * 만든다. 캠페인·광고셋 줄은 눌러서 펼친다.
 */
export const useAdPerformanceViewModel = (
  attribution: AttributionRow[] | null,
  dateStart: ISODate,
  dateEnd: ISODate,
) => {
  const fetchStart = minusDays(dateStart, AD_ATTRIBUTION_DAYS - 1)
  const key = `${fetchStart}_${dateEnd}`
  const [loaded, setLoaded] = useState<{
    key: string
    data: MetaAdInsights | null
    error: string | null
  } | null>(() => {
    const hit = cache.get(key)
    return hit ? { key, data: hit, error: null } : null
  })
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [showUnmatched, setShowUnmatched] = useState(false)
  // 캠페인 줄을 그래프(효율 막대)로 볼지 표로 볼지, 그래프의 정렬 — 이
  // 브라우저에 남는다. 그래프가 기본(표는 정확한 값이 필요할 때).
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

  // 오기입률 재료 — 조회 기간의 UTM 상담 수. 광고 단위 데이터와 따로 받고,
  // 못 받으면 오기입률만 비운다. 받아 둔 구간이면 바로 그것을 쓴다.
  const qualityKey = `${dateStart}_${dateEnd}`
  const [quality, setQuality] = useState<QualityLoad | null>(null)
  const cachedQuality = qualityCache.get(qualityKey)
  const currentQuality: QualityLoad | null = cachedQuality
    ? { key: qualityKey, rows: cachedQuality, error: null }
    : quality?.key === qualityKey
      ? quality
      : null
  useEffect(() => {
    if (qualityCache.has(qualityKey) || quality?.key === qualityKey) return
    let cancelled = false
    getLeadQuality(dateStart, dateEnd).then(
      (rows) => {
        qualityCache.set(qualityKey, rows)
        if (!cancelled) setQuality({ key: qualityKey, rows, error: null })
      },
      (err: unknown) => {
        console.error('오기입률 재료 조회 실패:', err)
        if (!cancelled) {
          setQuality({
            key: qualityKey,
            rows: null,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [qualityKey, dateStart, dateEnd, quality?.key])
  const qualityRows = currentQuality?.rows ?? null

  useEffect(() => {
    if (loaded?.key === key) return
    const hit = cache.get(key)
    let cancelled = false
    ;(async () => {
      if (hit) {
        setLoaded({ key, data: hit, error: null })
        return
      }
      try {
        const data = await getMetaAdInsights(fetchStart, dateEnd)
        cache.set(key, data)
        if (!cancelled) setLoaded({ key, data, error: null })
      } catch (err) {
        if (!cancelled) {
          setLoaded({
            key,
            data: null,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key, fetchStart, dateEnd, loaded?.key])

  const current = loaded?.key === key ? loaded : null
  const adData = current?.data ?? null
  const performance = useMemo(
    () =>
      adData && attribution
        ? buildAdPerformance(
            attribution,
            adData,
            dateStart,
            dateEnd,
            qualityRows,
            scope,
          )
        : null,
    [adData, attribution, dateStart, dateEnd, qualityRows, scope],
  )
  // 유입월 결제 전환 — Meta 유효 리드 전체(광고를 못 찾은 것도), 달 전체.
  const cohorts = useMemo(
    () =>
      attribution
        ? buildLeadCohorts(
            attribution,
            'meta',
            dateEnd,
            LEAD_COHORT_MONTHS,
            scope,
          )
        : [],
    [attribution, dateEnd, scope],
  )
  // 방문체험 예약일·범위별 첫 결제일이 든 데이터인지 — 서버를 고친 뒤 첫
  // 동기화 전에는 없다(그동안 그 칸은 비운다).
  const outcomesReady = useMemo(
    () =>
      attribution?.some((row) => row[1] === 'meta' && hasLeadOutcomes(row)) ??
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
    status: !current ? 'loading' : current.error ? 'error' : 'ready',
    error: current?.error ?? null,
    attributionMissing: attribution === null,
    performance,
    cohorts,
    outcomesReady,
    qualityStatus: !currentQuality
      ? 'loading'
      : currentQuality.error
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
