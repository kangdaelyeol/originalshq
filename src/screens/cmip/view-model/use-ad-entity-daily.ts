import { useEffect, useState } from 'react'
import { getAdEntityDaily, type AdEntityDay, type AdEntityKey } from '../client'

export type EntityDailyState =
  | { status: 'loading' }
  | { status: 'ready'; days: AdEntityDay[] }
  | { status: 'error'; error: string }

const LOADING: EntityDailyState = { status: 'loading' }

// 대상별로 한 번만 받는다 — 목록에서 다른 대상을 골랐다 돌아와도 다시 받지
// 않는다(새로고침하면 다시 받는다). 실패한 것은 지워서 다음에 다시 시도한다.
const requests = new Map<AdEntityKey, Promise<AdEntityDay[]>>()

const load = (key: AdEntityKey) => {
  let request = requests.get(key)
  if (!request) {
    request = getAdEntityDaily(key)
    request.catch(() => requests.delete(key))
    requests.set(key, request)
  }
  return request
}

/** 캠페인·광고셋 하나의 일별 성과(getAdEntityDaily). */
export const useAdEntityDaily = (key: AdEntityKey): EntityDailyState => {
  const [state, setState] = useState<{
    key: AdEntityKey
    value: EntityDailyState
  } | null>(null)

  useEffect(() => {
    let alive = true
    load(key)
      .then((days) => {
        if (alive) setState({ key, value: { status: 'ready', days } })
      })
      .catch((err: unknown) => {
        if (alive)
          setState({
            key,
            value: {
              status: 'error',
              error: err instanceof Error ? err.message : String(err),
            },
          })
      })
    return () => {
      alive = false
    }
  }, [key])

  // 대상을 바꾼 직후에는 이전 대상의 결과를 보이지 않는다.
  return state?.key === key ? state.value : LOADING
}
