import { useCallback, useMemo, useState } from 'react'
import { mondayClient } from '@/screens/xtool-lead-manager/client'
import { useLoadWhenActive } from '@/screens/xtool-lead-manager/hooks/use-load-when-active'
import type { MondayGaTracking } from '@/screens/xtool-lead-manager/entity'
import {
  buildGaTrackingRows,
  eventsByClient,
} from '@/screens/xtool-lead-manager/utils'

export type GaTrackingFilter = 'misentry' | 'all'

const fetchGaTracking = async () => {
  const res = await mondayClient.getGaTracking()
  if (!res.ok) {
    console.error('오기입 추적 실패:', res)
    return null
  }
  return res.data
}

/**
 * "오기입 추적" 탭 — GA ClientId가 적힌 상담과, 같은 id의 GA4 이벤트(BigQuery)를
 * 받아 상담별로 묶는다. 탭을 처음 열 때 받는다(BigQuery를 부르는 조회라 다른
 * 탭에서 미리 받지 않는다). 기본은 오기입만 보여 준다.
 */
export const useGaTrackingViewModel = (active: boolean) => {
  const { status, data, reload } = useLoadWhenActive<MondayGaTracking | null>(
    active,
    fetchGaTracking,
    null,
  )
  const [filter, setFilter] = useState<GaTrackingFilter>('misentry')
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  // "지금 수집" 진행 중인지, 실패했으면 그 이유.
  const [collecting, setCollecting] = useState(false)
  const [collectError, setCollectError] = useState<string | null>(null)

  /** GA4 이벤트를 지금 바로 수집하고, 끝나면 다시 불러온다. */
  const collectNow = useCallback(async () => {
    setCollecting(true)
    setCollectError(null)
    const res = await mondayClient.syncGaEvents()
    setCollecting(false)
    if (!res.ok) {
      setCollectError(res.error)
      return
    }
    await reload()
  }, [reload])

  // 상세(모달)를 여닫는 함수 — 모달이 Esc 리스너를 다시 붙이지 않도록 고정한다.
  const openRow = useCallback((itemId: string) => setOpenItemId(itemId), [])
  const closeRow = useCallback(() => setOpenItemId(null), [])

  const allRows = useMemo(
    () =>
      data
        ? buildGaTrackingRows(data.consultations, eventsByClient(data.events))
        : [],
    [data],
  )
  const rows = useMemo(
    () =>
      filter === 'misentry'
        ? allRows.filter((row) => row.consultation.misentry)
        : allRows,
    [allRows, filter],
  )

  return {
    state: {
      status,
      filter,
      rows,
      /** 거르지 않은 전체 — 리드 분석 탭이 리드 하나의 추적을 찾는 데 쓴다. */
      allRows,
      totalCount: allRows.length,
      misentryCount: allRows.filter((row) => row.consultation.misentry).length,
      matchedCount: rows.filter((row) => row.events.length > 0).length,
      openItemId,
      collectedAt: data?.collectedAt ?? null,
      lastResult: data?.lastResult ?? null,
      // 탭에서 누른 수집이 실패했거나, 마지막 예약 수집이 실패한 이유.
      collectError: collectError ?? data?.lastError ?? null,
      collecting,
      syncedAt: data?.syncedAt ?? null,
    },
    actions: {
      changeFilter: setFilter,
      reload,
      openRow,
      closeRow,
      collectNow,
    },
  }
}
