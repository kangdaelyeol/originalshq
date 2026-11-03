import { useEffect, useState } from 'react'
import {
  listAdCreatives,
  type AdCreativeView,
  type AdEntityKey,
} from '../client'

export type AdCreativesState =
  | { status: 'loading' }
  | { status: 'ready'; creatives: AdCreativeView[] }
  | { status: 'error'; error: string }

const LOADING: AdCreativesState = { status: 'loading' }

// 대상별로 한 번만 받는다(use-ad-entity-daily와 같은 방식) — 새 소재는 하루
// 여섯 번 동기화로 들어오니, 화면을 새로고침하면 다시 받는다. 실패한 것은
// 지워서 다음에 다시 시도한다.
const requests = new Map<AdEntityKey, Promise<AdCreativeView[]>>()

const load = (key: AdEntityKey) => {
  let request = requests.get(key)
  if (!request) {
    request = listAdCreatives(key)
    request.catch(() => requests.delete(key))
    requests.set(key, request)
  }
  return request
}

/** 이 화면에서 바뀐 소재(분석·올리기·지우기)를 받아 둔 목록에도 반영한다 —
 * 편집기를 닫았다 다시 열어도 보이게. 바뀐 소재가 없는 목록은 그대로 둔다. */
export const changeCachedCreatives = (
  change: (creatives: AdCreativeView[]) => AdCreativeView[],
) => {
  for (const [key, request] of requests) requests.set(key, request.then(change))
}

/** 방금 올린 소재 — 올린 대상의 목록 앞에 넣고, 같이 보일 수 있는 다른
 * 대상(광고셋에 올리면 그 캠페인)의 목록은 다음에 열 때 다시 받는다. */
export const addCachedCreative = (
  key: AdEntityKey,
  creative: AdCreativeView,
) => {
  for (const k of [...requests.keys()]) if (k !== key) requests.delete(k)
  const request = requests.get(key)
  if (request)
    requests.set(
      key,
      request.then((list) => [
        creative,
        ...list.filter((c) => c.id !== creative.id),
      ]),
    )
}

/** 캠페인·광고셋 하나의 저장 소재(listAdCreatives). */
export const useAdCreatives = (key: AdEntityKey): AdCreativesState => {
  const [state, setState] = useState<{
    key: AdEntityKey
    value: AdCreativesState
  } | null>(null)

  useEffect(() => {
    let alive = true
    load(key)
      .then((creatives) => {
        if (alive) setState({ key, value: { status: 'ready', creatives } })
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

  // 대상을 바꾼 직후에는 이전 대상의 소재를 보이지 않는다.
  return state?.key === key ? state.value : LOADING
}
