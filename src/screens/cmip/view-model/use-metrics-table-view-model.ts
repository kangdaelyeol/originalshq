import { useMemo, useState } from 'react'
import type { MetricsSummary } from '../client'
import type { MetricKey } from '../components/metric-fields'

type SortDir = 'asc' | 'desc'

/** 전체 요약 탭의 일별/요일별/주차별/지정기간 표(MetricsTable) 전용 상태 —
 * 채널별 펼침 행 열림/닫힘, 정렬, 정렬이 반영된 표시용 행을 다룬다. "대비
 * 표시"는 compareRowAt이 정한 행과 비교한다. */
export const useMetricsTableViewModel = <T extends MetricsSummary>(
  rows: readonly T[],
  /** 라벨 컬럼의 기본 방향 — 날짜·주차·기간은 최신이 위(desc), 요일은
   * 월~일 순서(asc). */
  labelDefaultDir: SortDir = 'desc',
) => {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  // 정렬 — 캠페인/adset 전체 목록 표(FullListTable)와 같은 기능을 이 표에도
  // 붙인다. 다만 라벨(날짜/요일/기간) 컬럼은 문자열 그대로 정렬하면 요일("월"~
  // "일")·기간("9/1~9/7")처럼 원래 순서가 사전순과 달라 깨지므로, rows(호출부가
  // 이미 올바른 순서로 넘겨줌) 그대로/뒤집기로만 다룬다.
  const [sort, setSort] = useState<{ key: 'label' | MetricKey; dir: SortDir }>({
    key: 'label',
    dir: labelDefaultDir,
  })

  const toggleSort = (key: 'label' | MetricKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'label' ? labelDefaultDir : 'desc' },
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

  // 증감 비교 대상 — 지표로 정렬했으면 화면상 바로 윗 줄, 기간 순서면 시간상
  // 이전 기간(최신이 위인 기본 순서에서는 바로 아랫줄)이다. 그래야 최신이
  // 위로 와도 "전일·전주 대비"로 읽힌다.
  const compareRowAt = (index: number): T | null => {
    if (sort.key === 'label' && sort.dir === 'desc') {
      return displayRows[index + 1] ?? null
    }
    return index > 0 ? displayRows[index - 1] : null
  }

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
    compareRowAt,
    // 액션
    toggleSort,
    toggle,
  }
}
