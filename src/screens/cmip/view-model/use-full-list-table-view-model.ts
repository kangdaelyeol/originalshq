import { useMemo, useState } from 'react'
import type { MetricsSummary } from '../client'
import {
  channelSafeFields,
  METRIC_FIELDS,
  type MetricKey,
} from '../components/metric-fields'
import type { ChannelKey } from '../components/channels'

type SortDir = 'asc' | 'desc'

export type FullListSortKey = 'name' | MetricKey

export interface FullListRow {
  key: string
  /** 교차표·그래프 선택에 쓰는 키(campaignKey/adsetKey). */
  selectKey: string
  name: string
  metrics: MetricsSummary
  /** 결과 유형 — Meta 캠페인에만 있다(adset 목록·Google/Naver 캠페인은 항상 없음). */
  resultType?: string | null
  /** 이 캠페인/adset에 실제 데이터가 있는 채널 — ResultPanel의 applicableChannels와
   * 같은 기준(byDate가 비어있지 않은 채널만)으로 channelsOf가 계산해 채운다. */
  channels: readonly ChannelKey[]
  /** 캠페인 줄 아래에 펼쳐지는 광고셋 줄 — 광고셋 줄에는 없다. */
  children?: readonly FullListRow[]
}

/** 캠페인·광고셋 탭의 목록 표(FullListTable) 전용 상태 — 채널 필터, 컬럼
 * 표시 여부(지표/전환 목표), 정렬을 다루고 그 결과인 sortedRows를 돌려준다.
 * 정렬·채널 필터는 캠페인 줄과 그 아래 광고셋 줄에 똑같이 걸린다. 캠페인
 * 펼침은 위 요약 카드도 바꿔야 해서 페이지 view-model이 들고 있다. */
export const useFullListTableViewModel = (rows: readonly FullListRow[]) => {
  const [sort, setSort] = useState<{ key: FullListSortKey; dir: SortDir }>({
    key: 'name',
    dir: 'asc',
  })

  // 채널 필터 — "전체"가 기본이고, 특정 채널을 고르면 그 채널 데이터가 있는
  // 행만 남긴다(row.channels 기준 — 이름이 같아 여러 채널이 합쳐진 행은 그
  // 채널이 channels 배열에 있기만 하면 보인다).
  const [channelFilter, setChannelFilter] = useState<'all' | ChannelKey>('all')
  const filteredRows = useMemo(() => {
    if (channelFilter === 'all') return rows
    const keep = (r: FullListRow) => r.channels.includes(channelFilter)
    return rows
      .filter(keep)
      .map((r) =>
        r.children ? { ...r, children: r.children.filter(keep) } : r,
      )
  }, [rows, channelFilter])

  // 컬럼 표시 여부 — 기본은 전부 표시. 지표 칸만 껐다 켰다 할 수 있고
  // 이름/채널 칸은 항상 보인다. 오프라인/온라인/총 매출·ROAS는 캠페인/adset
  // 단위에 귀속시킬 방법이 없어 항상 0이라(channelSafeFields) 애초에 토글
  // 대상에도 안 넣는다 — channel-insight.tsx의 FullListTable이 컬럼 목록
  // 자체를 이 필드들 뺀 걸로만 그린다.
  const [visibleKeys, setVisibleKeys] = useState<ReadonlySet<MetricKey>>(
    () => new Set(channelSafeFields(METRIC_FIELDS).map((f) => f.key)),
  )
  const toggleColumn = (key: MetricKey) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // 전환 목표(결과 유형) 뱃지 표시 여부 — Meta 캠페인에만 있는 값이라, 이
  // 표에 Meta 캠페인이 하나도 없으면(예: adset 목록) 토글 자체를 안 보여준다.
  const [showResultType, setShowResultType] = useState(true)
  const hasResultType = filteredRows.some((r) => r.resultType)

  const toggleSort = (key: FullListSortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : // 처음 누르는 컬럼은 이름은 오름차순(가나다순)부터, 지표는 내림차순
          // (가장 큰 값부터)부터 — 지표는 보통 "제일 높은 값"이 먼저 보고 싶은
          // 경우가 많아서다.
          { key, dir: key === 'name' ? 'asc' : 'desc' },
    )
  }

  const sortedRows = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1
    const sortRows = (list: readonly FullListRow[]) =>
      [...list].sort((a, b) => {
        if (sort.key === 'name') return a.name.localeCompare(b.name) * dir
        return (a.metrics[sort.key] - b.metrics[sort.key]) * dir
      })
    return sortRows(filteredRows).map((r) =>
      r.children ? { ...r, children: sortRows(r.children) } : r,
    )
  }, [filteredRows, sort])

  return {
    // 진행 상태
    sort,
    channelFilter,
    visibleKeys,
    showResultType,
    hasResultType,
    sortedRows,
    // 액션
    setChannelFilter,
    toggleColumn,
    setShowResultType,
    toggleSort,
  }
}
