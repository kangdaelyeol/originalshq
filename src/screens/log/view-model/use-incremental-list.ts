import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClientResponse, IncrementalPage } from '../client/http'
import { mergeRecent } from '../utils/merge-recent'

const DAY_MS = 86_400_000

/** 받은 목록과 이어 받기 기준 — 탭을 바꿔 화면이 사라져도 남는다. */
interface Kept<T> {
  days: number
  items: T[]
  /** 다음 since — 마지막 응답의 서버 시각. */
  fetchedAt: number
  /** 마지막으로 기간 전체를 받은 때. */
  fullAt: number
}

// 화면(탭)마다 하나 — 탭을 오가도 받은 목록을 바로 보여 주고 바뀐 것만 받는다
// (전에는 탭에 돌아올 때마다 기간 전체 수백 건을 다시 읽었다). 페이지를 새로
// 열면 비어서 처음부터 받는다.
const kept = new Map<string, Kept<unknown>>()

/** 그 화면이 마지막으로 본 기간 — 탭에 돌아오면 그 기간으로 연다. */
export const keptDays = (key: string): number | null =>
  kept.get(key)?.days ?? null

export type LoadStatus = 'loading' | 'ready' | 'error'

/**
 * 최근 days일 목록을 받아 들고 있는다 — /log의 배치·문의·사용 화면이 같이 쓴다.
 *
 *   · 처음·기간을 바꿨을 때·새로고침(full)은 기간 전체를, 그 뒤(1분마다)는 지난
 *     응답 뒤에 바뀐 것만 받아(since) 가진 목록에 합친다(같은 id는 새 것으로,
 *     기간 밖은 뺀다).
 *   · fullEveryMs가 지나면 이어 받기 대신 전체 — 이어 받기로는 남이 지운 것을
 *     알 수 없는 목록(문의)용.
 *   · 늦게 온 응답이 새 응답을 덮지 않도록 마지막 요청만 반영한다.
 *   · 다시 받는 동안에도 가진 목록을 그대로 보여 준다(1분마다 깜빡이지 않게).
 *
 * fetchPage·idOf·timeOf·onFull은 바뀌지 않는 함수로 준다(바뀌면 load가 새로
 * 만들어져 처음부터 다시 받는다).
 */
export const useIncrementalList = <T>({
  keepKey,
  days,
  fetchPage,
  idOf,
  timeOf,
  fullEveryMs = Infinity,
  onFull,
}: {
  /** 보관 이름 — 화면마다 다르게. */
  keepKey: string
  days: number
  fetchPage: (
    days: number,
    since?: number,
  ) => Promise<ClientResponse<IncrementalPage<T>>>
  idOf: (item: T) => string
  /** 기간에 드는지 볼 시각(ms). */
  timeOf: (item: T) => number
  fullEveryMs?: number
  /** 기간 전체를 받았을 때 — 사라진 것을 다른 상태에서도 빼려면. */
  onFull?: (items: T[]) => void
}) => {
  const usable = () => {
    const each = kept.get(keepKey) as Kept<T> | undefined
    return each?.days === days ? each : null
  }
  const [items, setItems] = useState<T[]>(() => usable()?.items ?? [])
  const [status, setStatus] = useState<LoadStatus>(() =>
    usable() ? 'ready' : 'loading',
  )
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(
    () => usable()?.fetchedAt ?? null,
  )
  // "지금" — 받아 올 때마다 갱신한다(몇 분 전·실행 중 판단의 기준).
  const [now, setNow] = useState(() => Date.now())
  const latest = useRef(0)

  // 화면에서 고친 목록(다시 실행·지우기)도 보관함에 — 다음 이어 받기가 그
  // 목록에 합친다.
  useEffect(() => {
    const each = kept.get(keepKey) as Kept<T> | undefined
    if (each?.days === days && each.items !== items) {
      kept.set(keepKey, { ...each, items })
    }
  }, [keepKey, days, items])

  /** 다시 받는다 — 실패하면 오류 문구, 성공하면 null(새로고침 알림용). */
  const load = useCallback(
    async (options?: { full?: boolean }): Promise<string | null> => {
      const request = ++latest.current
      const before = kept.get(keepKey) as Kept<T> | undefined
      const base =
        before?.days === days &&
        !options?.full &&
        Date.now() - before.fullAt < fullEveryMs
          ? before
          : null
      const res = await fetchPage(days, base?.fetchedAt)
      if (request !== latest.current) return null
      setNow(Date.now())
      if (!res.ok) {
        setError(res.error)
        setStatus('error')
        return res.error
      }
      const page = res.data
      const merged =
        page.incremental && base
          ? mergeRecent(
              base.items,
              page.items,
              idOf,
              timeOf,
              page.fetchedAt - days * DAY_MS,
            )
          : page.items
      kept.set(keepKey, {
        days,
        items: merged,
        fetchedAt: page.fetchedAt,
        fullAt: page.incremental && base ? base.fullAt : Date.now(),
      })
      setItems(merged)
      if (!(page.incremental && base)) onFull?.(merged)
      setFetchedAt(page.fetchedAt)
      setError(null)
      setStatus('ready')
      return null
    },
    [keepKey, days, fetchPage, idOf, timeOf, fullEveryMs, onFull],
  )

  return { items, setItems, status, error, fetchedAt, now, load }
}
