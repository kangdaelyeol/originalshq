import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { startGlassTransition } from '@/components/glass'

export type PageTab = 'leads' | 'monday' | 'stats' | 'trend' | 'tracking'

export const PAGE_TABS: { id: PageTab; label: string }[] = [
  { id: 'monday', label: 'Monday 고객' },
  { id: 'stats', label: '퍼널 통계' },
  { id: 'trend', label: '통계' },
  { id: 'tracking', label: '오기입 추적' },
  // 리드(cmip로 보내는 전환 기록) — 이름은 'cmip 관리', 맨 오른쪽.
  { id: 'leads', label: 'cmip 관리' },
]

/** 최상위 탭(Monday 고객 / 퍼널 통계 / 통계 / 오기입 추적 / cmip 관리). 어느 탭인지는 주소의 ?tab= 에 둔다 — 헤더
 * (pages/xtool-page)와 화면(index.tsx)이 서로 다른 곳에서 같은 값을 봐야 하고,
 * 새로고침하거나 주소를 공유해도 같은 탭이 열리게 하기 위해서다. 탭 지정이
 * 없으면 Monday 고객(기본 탭 — 주소에 ?tab을 붙이지 않는다). */
export const usePageTabViewModel = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const param = searchParams.get('tab')
  const tab: PageTab =
    PAGE_TABS.find((each) => each.id === param)?.id ?? 'monday'

  const selectTab = useCallback(
    (next: PageTab) => {
      // 화면 전환 — 새 화면이 흐릿하게 나타나며 선명해진다(헤더는 그대로).
      startGlassTransition(() =>
        setSearchParams(next === 'monday' ? {} : { tab: next }),
      )
    },
    [setSearchParams],
  )

  return { state: { tab }, actions: { selectTab } }
}
