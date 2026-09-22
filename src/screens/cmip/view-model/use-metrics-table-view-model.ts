import { useMemo, useState } from 'react'
import type { MetricsSummary } from '../client'
import type { MetricKey } from '../components/metric-fields'

type SortDir = 'asc' | 'desc'

/** 전체 요약 탭의 일별/요일별/주차별/지정기간 표(MetricsTable) 전용 상태 —
 * 채널별 펼침 행 열림/닫힘, 정렬, 정렬과 무관하게 항상 원본(시간순) 기준
 * 직전 값을 찾기 위한 인덱스, 정렬이 반영된 표시용 행을 다룬다. */
export const useMetricsTableViewModel = <T extends MetricsSummary>(
  rows: readonly T[],
  rowKey: (row: T) => string,
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

  // "대비 표시"(바로 앞 지점 대비)는 정렬로 화면상 순서가 바뀌어도 항상 원본
  // (시간순) 기준 직전 값을 봐야 의미가 있다 — 그 행이 원본 rows에서 실제로
  // 몇 번째였는지 미리 룩업 테이블로 만들어둔다.
  const originalIndexByKey = useMemo(
    () => new Map(rows.map((row, i) => [rowKey(row), i] as const)),
    [rows, rowKey],
  )

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
    originalIndexByKey,
    displayRows,
    // 액션
    toggleSort,
    toggle,
  }
}
