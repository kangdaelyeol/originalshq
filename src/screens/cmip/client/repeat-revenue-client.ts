/**
 * getMondayRepeatRevenue 클라이언트 — functions-xtool `getMondayRepeatRevenue`
 * (onRequest, GET) 호출. xtool이 통합 고객(전화번호 기준으로 Monday 오프라인
 * 결제와 Cafe24 주문을 합친 것)에서 고객마다 첫 구매일의 구매는 신규, 그
 * 뒤의 구매는 재구매로 나눠 날짜별로 저장해 둔 값이다. ROAS 탭의 "신규 고객
 * ROAS"가 매출에서 이 재구매 금액을 빼서 쓴다.
 *
 * 서버는 전체 기간을 한 번에 주므로 조회 기간으로 거르는 것은 여기서 한다.
 */
import { API_BASE } from '@/screens/xtool-lead-manager/constants'
import type { ISODate } from '../types'
import { CallableError } from './csv-client'

interface RepeatRevenueRow {
  date: ISODate
  offlineNew: number
  offlineRepeat: number
  onlineNew: number
  onlineRepeat: number
}

/** 날짜(YYYY-MM-DD) → 그날 재구매 금액(오프라인+온라인). 재구매가 없던 날은
 * 키가 없다. 세션 캐시(JSON)에 그대로 넣을 수 있게 Map이 아니라 객체다. */
export type RepeatRevenueByDate = Record<ISODate, number>

export async function getRepeatRevenue(
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<RepeatRevenueByDate> {
  const res = await fetch(`${API_BASE}/getMondayRepeatRevenue`)

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new CallableError(
      'getMondayRepeatRevenue 응답을 해석할 수 없습니다.',
      res.status,
    )
  }

  if (!res.ok) {
    const message =
      (body as { error?: string })?.error ??
      `getMondayRepeatRevenue 호출에 실패했습니다. (HTTP ${res.status})`
    throw new CallableError(message, res.status)
  }

  const byDate: RepeatRevenueByDate = {}
  for (const row of (body as { rows: RepeatRevenueRow[] }).rows) {
    if (row.date < dateStart || row.date > dateEnd) continue
    const repeat = row.offlineRepeat + row.onlineRepeat
    if (repeat) byDate[row.date] = repeat
  }
  return byDate
}
