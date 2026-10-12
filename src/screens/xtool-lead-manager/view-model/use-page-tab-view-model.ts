import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export type PageTab = 'leads' | 'monday'

export const PAGE_TABS: { id: PageTab; label: string }[] = [
  { id: 'leads', label: '리드' },
  { id: 'monday', label: 'Monday 고객' },
]

/** 최상위 탭(리드 / Monday 고객). 어느 탭인지는 주소의 ?tab= 에 둔다 — 헤더
 * (pages/xtool-page)와 화면(index.tsx)이 서로 다른 곳에서 같은 값을 봐야 하고,
 * 새로고침하거나 주소를 공유해도 같은 탭이 열리게 하기 위해서다. */
export const usePageTabViewModel = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: PageTab = searchParams.get('tab') === 'monday' ? 'monday' : 'leads'

  const selectTab = useCallback(
    (next: PageTab) => {
      setSearchParams(next === 'leads' ? {} : { tab: next })
    },
    [setSearchParams],
  )

  return { state: { tab }, actions: { selectTab } }
}
