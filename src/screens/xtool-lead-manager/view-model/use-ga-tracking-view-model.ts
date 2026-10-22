import { useCallback, useEffect, useMemo, useState } from 'react'
import { mondayClient } from '@/screens/xtool-lead-manager/client'
import type { MondayGaTracking } from '@/screens/xtool-lead-manager/entity'
import {
  buildGaTrackingRows,
  eventsByClient,
} from '@/screens/xtool-lead-manager/utils'

export type GaTrackingFilter = 'misentry' | 'all'

/**
 * "오기입 추적" 탭 — GA ClientId가 적힌 상담과, 같은 id의 GA4 이벤트(BigQuery)를
 * 받아 상담별로 묶는다. 탭을 처음 열 때 받는다(BigQuery를 부르는 조회라 다른
 * 탭에서 미리 받지 않는다). 기본은 오기입만 보여 준다.
 */
export const useGaTrackingViewModel = (active: boolean) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  )
  const [data, setData] = useState<MondayGaTracking | null>(null)
  const [filter, setFilter] = useState<GaTrackingFilter>('misentry')
  const [openItemId, setOpenItemId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setStatus('loading')
    const res = await mondayClient.getGaTracking()
    if (!res.ok) {
      console.error('오기입 추적 실패:', res)
      setStatus('error')
      return
    }
    setData(res.data)
    setStatus('ready')
  }, [])

  useEffect(() => {
    if (!active || status !== 'idle') return
    ;(async () => {
      await load()
    })()
  }, [active, status, load])

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
      totalCount: allRows.length,
      misentryCount: allRows.filter((row) => row.consultation.misentry).length,
      matchedCount: rows.filter((row) => row.events.length > 0).length,
      openItemId,
      range: data?.range ?? null,
      bytesProcessed: data?.bytesProcessed ?? 0,
      ga4Error: data?.ga4Error ?? null,
      syncedAt: data?.syncedAt ?? null,
    },
    actions: {
      changeFilter: setFilter,
      reload: load,
      openRow,
      closeRow,
    },
  }
}
