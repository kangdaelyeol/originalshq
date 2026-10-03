import { useMemo, useState } from 'react'
import type { MetricsSummary } from '../client'
import type { MetricKey } from '../components/metric-fields'

type SortDir = 'asc' | 'desc'

/** 전체 요약 탭의 일별/요일별/주차별/지정기간 표(MetricsTable) 전용 상태 —
 * 채널별 펼침 행 열림/닫힘, 정렬, 정렬이 반영된 표시용 행을 다룬다. "대비
 * 표시"는 이 표시용 행(displayRows)의 바로 윗 행과 비교한다. */
export const useMetricsTableViewModel = <T extends MetricsSummary>(
  rows: readonly T[],
) => {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  // 정렬 — 캠페인/adset 전체 목록 표(FullListTable)와 같은 기능을 이 표에도
  // 붙인다. 다만 라벨(날짜/요일/기간) 컬럼은 문자열 그대로 정렬하면 요일("월"~
  // "일")·기간("9/1~9/7")처럼 원래 순서가 사전순과 달라 깨지므로, rows(호출부가
  // 이미 올바른 순서로 넘겨줌) 그대로/뒤집기로만 다룬다.
  const [sort, setSort] = useState<{ key: 'label' | MetricKey; dir: SortDir }>({
    key: 'label',
    dir: 'asc',
  })

  const toggleSort = (key: 'label' | MetricKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'label' ? 'asc' : 'desc' },
    )
  }

  const displayRows = useMemo(() => {
    if (sort.key === 'label') {
      return sort.dir === 'asc' ? rows : [...rows].reverse()
    }
    const dir = sort.dir === 'asc' ? 1 : -1
    const key = sort.key
    return [...rows].sort((a, b) => (a[key] - b[key]) * dir)
  }, [rows, sort])

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return {
    // 진행 상태
    expanded,
    sort,
    displayRows,
    // 액션
    toggleSort,
    toggle,
  }
}
