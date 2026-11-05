import { Barcode, Boxes, Link2, PackagePlus } from 'lucide-react'
import type { StatCardData } from '@/ohq-ui/types'
import { PERIOD_COMPARE, type Period } from '../../data/period'
import type { SerialRecord, TechBoardDoc } from '@xtool-core/tech-boards'
import { inRange, periodRange } from '@xtool-core/dates'

// SN 관리 숫자 카드 — 보드 화면(대시보드·물)과 Monday 표 요약 줄이 같은 것을 그린다(registry).
// 빈 템플릿 줄 거르기·연결 기록 세기는 표와 상세 서랍도 쓴다.

type R = SerialRecord

// Monday 보드의 빈 템플릿 줄
export const isTemplate = (r: R) => /^새로운\s*serial\s*number$/i.test(r.name.trim())
export const linkCount = (r: R) => r.links.fieldService.length + r.links.repair.length + r.links.rental.length

/** 보드에 보일 SN — 빈 템플릿 줄은 뺀다 */
export const visibleSerials = (records: R[]) => records.filter((r) => !isTemplate(r))

/** 전체 SN · 기기 종류 · 기간 안 입고 · 연결 기록 있음 */
export function serialsKpis(doc: TechBoardDoc<'serials'>, period: Period, today: string): StatCardData[] {
  const { current } = periodRange(period, today)
  const records = visibleSerials(doc.records)
  return [
    { key: 'all', title: '전체 SN', value: `${records.length}대`, icon: Barcode, tint: 'blue' },
    {
      key: 'devices',
      title: '기기 종류',
      value: `${new Set(records.map((r) => r.device).filter(Boolean)).size}종`,
      icon: Boxes,
      tint: 'violet',
    },
    {
      key: 'received',
      title: `${PERIOD_COMPARE[period].current} 입고`,
      value: `${records.filter((r) => inRange(r.receivedAt, current)).length}대`,
      icon: PackagePlus,
      tint: 'green',
    },
    { key: 'linked', title: '연결 기록 있음', value: `${records.filter((r) => linkCount(r) > 0).length}대`, icon: Link2, tint: 'amber' },
  ]
}
