import { useEffect, useState } from 'react'
import { mondayClient } from '@/screens/xtool-lead-manager/client'
import type { MondayCustomer } from '@/screens/xtool-lead-manager/entity'

type MatchStatus = 'idle' | 'loading' | 'matched' | 'none' | 'error'

interface MatchResult {
  /** 이 결과가 어느 번호에 대한 것인지. */
  phone: string
  status: Exclude<MatchStatus, 'idle' | 'loading'>
  customer: MondayCustomer | null
}

/** 리드 상세가 열려 있는 동안, 그 리드와 같은 전화번호의 Monday 고객을
 * 찾아 둔다. `phone`은 지금 열린 리드의 번호(닫혀 있으면 null)다 — 리드를
 * 바꿔 열거나 번호를 고치면 새 번호로 다시 찾는다. */
export const useLeadMondayMatchViewModel = (phone: string | null) => {
  const digits = phone?.replace(/\D/g, '') ?? ''
  const [result, setResult] = useState<MatchResult | null>(null)

  useEffect(() => {
    if (!digits) return
    // 받아오는 사이 다른 리드를 열었으면 늦게 온 응답은 버린다.
    let stale = false

    ;(async () => {
      const res = await mondayClient.getCustomer(digits)
      if (stale) return
      if (res.ok) {
        setResult({
          phone: digits,
          status: 'matched',
          customer: res.data.customer,
        })
        return
      }
      // 같은 번호의 고객이 없으면 서버가 404를 준다 — 오류가 아니라 "없음"이다.
      setResult({
        phone: digits,
        status: res.status === 404 ? 'none' : 'error',
        customer: null,
      })
    })()

    return () => {
      stale = true
    }
  }, [digits])

  // 상태를 따로 두지 않고 "결과가 지금 번호의 것인가"로 정한다 — 번호가 바뀐
  // 직후에는 이전 고객의 결과가 남아 있으므로 그걸 보여주지 않는다.
  const current = result?.phone === digits ? result : null
  const status: MatchStatus = !digits ? 'idle' : (current?.status ?? 'loading')

  return {
    state: { status, customer: current?.customer ?? null },
  }
}
