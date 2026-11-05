import { useCallback, useEffect, useState } from 'react'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * 탭이나 소주제를 처음 열 때(active) 한 번 받아 오는 데이터 — 상태는 idle →
 * loading → ready | error이고, reload로 다시 받는다. 다시 받다 실패하면 받아
 * 둔 값은 그대로 두고 상태만 error가 된다.
 *
 * fetchData는 받은 값을, 실패면 null을 돌려준다(실패 이유는 fetchData가 콘솔에
 * 남긴다). 렌더마다 새로 만들지 않게 모듈 함수로 넘기고, 받기 전의 값(initial)도
 * 모듈 상수로 넘긴다 — 새 배열이 되면 그것을 쓰는 useMemo가 매번 다시 돈다.
 */
export const useLoadWhenActive = <T>(
  active: boolean,
  fetchData: () => Promise<T | null>,
  initial: T,
) => {
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [data, setData] = useState<T>(initial)

  const reload = useCallback(async () => {
    setStatus('loading')
    const next = await fetchData()
    if (next === null) {
      setStatus('error')
      return
    }
    setData(next)
    setStatus('ready')
  }, [fetchData])

  useEffect(() => {
    if (!active || status !== 'idle') return
    ;(async () => {
      await reload()
    })()
  }, [active, status, reload])

  return { status, data, reload }
}
