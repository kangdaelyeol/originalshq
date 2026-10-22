import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildAdPerformance,
  getMetaAdInsights,
  type AttributionRow,
  type MetaAdInsights,
} from '../client'
import type { ISODate } from '../types'
import { AD_ATTRIBUTION_DAYS } from '../client'

// 탭을 오갈 때마다 다시 받지 않도록 조회 구간별로 들고 있는다(새로고침하면
// 사라진다).
const cache = new Map<string, MetaAdInsights>()

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
        ? buildAdPerformance(attribution, adData, dateStart, dateEnd)
        : null,
    [adData, attribution, dateStart, dateEnd],
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
    expanded,
    toggle,
    showUnmatched,
    setShowUnmatched,
  } as const
}
