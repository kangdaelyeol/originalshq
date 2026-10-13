import { useCallback, useEffect, useMemo, useState } from 'react'
import { mondayClient } from '@/screens/xtool-lead-manager/client'
import type { MondayDailyInflow } from '@/screens/xtool-lead-manager/entity'
import {
  inflowSeries,
  summarizeInflow,
} from '@/screens/xtool-lead-manager/utils'
// 날짜 계산은 cmip과 같은 함수를 쓴다 — 기간 선택기(DateRangePicker)도 cmip
// 것이라, "오늘"·"지난 7일"의 기준이 두 화면에서 어긋나지 않게 한다.
import { addDays, todayISO } from '@/screens/cmip/utils'

/** 처음 열었을 때의 기간 — 오늘을 뺀 직전 7일(어제까지). 오늘은 아직 하루가
 * 끝나지 않아 건수가 덜 쌓였다. cmip 기간 선택기의 "지난 7일"과 같다. */
const defaultRange = (): { start: string; end: string } => {
  const end = addDays(todayISO(), -1)
  return { start: addDays(end, -6), end }
}

/** 통계 탭의 상태 — 날짜별 인입 건수 전체(한 번 받아 둔다)와 조회 기간, 그
 * 기간의 그래프용 데이터. `active`가 처음 true가 될 때 받아온다. */
export const useMondayTrendViewModel = (active: boolean) => {
  const [days, setDays] = useState<MondayDailyInflow[]>([])
  const [syncedAt, setSyncedAt] = useState<number | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  )
  const [range, setRange] = useState(defaultRange)

  const load = useCallback(async () => {
    setStatus('loading')
    const res = await mondayClient.getDailyInflow()
    if (!res.ok) {
      console.error('인입 통계 실패:', res.error)
      setStatus('error')
      return
    }
    setDays(res.data.days)
    setSyncedAt(res.data.syncedAt)
    setStatus('ready')
  }, [])

  useEffect(() => {
    if (!active || status !== 'idle') return
    ;(async () => {
      await load()
    })()
  }, [active, status, load])

  const points = useMemo(
    () => inflowSeries(days, range.start, range.end),
    [days, range],
  )
  const summary = useMemo(() => summarizeInflow(points), [points])

  // 전체 기간을 한 번에 받아 두었으므로 기간을 바꿔도 다시 받지 않는다.
  const changeRange = useCallback(
    (start: string, end: string) => setRange({ start, end }),
    [],
  )

  return {
    state: { status, range, points, summary, syncedAt },
    actions: { changeRange, reload: load },
  }
}
