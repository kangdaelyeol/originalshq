import { type ReactNode } from 'react'
import type { MondayCustomer } from '@/screens/xtool-lead-manager/entity'
import { Segmented } from '@/components/glass'
import { useArrowTabs } from '@/screens/xtool-lead-manager/hooks/use-arrow-tabs'
import {
  type RecordTab,
  RECORD_TAB_LABEL,
  recordCounts,
} from './record-tab-counts'

/** 기록 종류 토글 — 기록이 있는 종류만 버튼으로(전체 + 그 종류들). 좌/우
 * 방향키로 옮긴다. 다른 고객으로 넘어가 고른 종류가 없으면 전체로 보인다. */
export const RecordTabs = ({
  customer,
  tab,
  onChange,
  keysEnabled,
}: {
  customer: MondayCustomer
  tab: RecordTab
  onChange: (next: RecordTab) => void
  keysEnabled: boolean
}) => {
  const counts = recordCounts(customer)
  const tabs: RecordTab[] = [
    'all',
    ...(Object.keys(counts) as Exclude<RecordTab, 'all'>[]).filter(
      (key) => counts[key] > 0,
    ),
  ]
  useArrowTabs(tabs, tab, onChange, keysEnabled)
  // 기록이 한 종류뿐이면 고를 게 없다.
  if (tabs.length <= 2) return null
  const options = Object.fromEntries(
    tabs.map((key) => [
      key,
      <span key={key} className="monday_category_label">
        {RECORD_TAB_LABEL[key]}
        {key !== 'all' && <span className="count">{counts[key]}</span>}
      </span>,
    ]),
  ) as Record<RecordTab, ReactNode>
  return (
    <div className="monday_record_tabs">
      <Segmented
        options={options}
        value={tab}
        onChange={onChange}
        label="기록 종류"
        size="md"
      />
    </div>
  )
}
