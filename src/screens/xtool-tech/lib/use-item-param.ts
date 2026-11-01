import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * 보드에서 열린 항목 — 주소의 ?item=<id>와 같이 간다. 개요(나의 진행 중 업무)에서 누르면 그 보드로
 * 가서 바로 상세가 열리고, 주소를 공유해도 같은 항목이 열린다. 열고 닫는 건 기록을 쌓지 않는다.
 */
export function useItemParam(): [string | null, (itemId: string | null) => void] {
  const [params, setParams] = useSearchParams()
  const selected = params.get('item')
  const select = useCallback(
    (itemId: string | null) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (itemId) next.set('item', itemId)
          else next.delete('item')
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  return [selected, select]
}
