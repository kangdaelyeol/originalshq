import { CircleCheck, PackageOpen, Send, Wrench } from 'lucide-react'
import type { StatCardData } from '@/ohq-ui/types'
import { PERIOD_COMPARE, type Period } from '../../data/period'
import type { RepairRecord, TechBoardDoc } from '../../data/tech-boards'
import { isDone, isNew } from '../../data/tech-stage'
import { inRange, isoToKoreaDate, periodRange } from '../../lib/dates'

// AS 숫자 카드 — 보드 화면(대시보드·물)과 Monday 표 요약 줄이 같은 것을 그린다(registry).

type R = RepairRecord

/** 끝난 날 — 완료일, 없으면 마지막 수정일(표의 경과·완료 정렬도 쓴다) */
export const doneOn = (r: R) => r.completedAt ?? isoToKoreaDate(r.updatedAt)
const isShipping = (r: R) => /발송/.test(r.stage ?? '')

/** 입고 대기 · 수리 중 · 발송 대기 · 기간 안 완료 */
export function repairKpis(doc: TechBoardDoc<'repair'>, period: Period, today: string): StatCardData[] {
  const { current } = periodRange(period, today)
  const records = doc.records
  const open = records.filter((r) => !isDone(r))
  const doneInPeriod = records.filter((r) => isDone(r) && inRange(doneOn(r), current))
  return [
    { key: 'waiting', title: '입고 대기', value: `${open.filter(isNew).length}건`, icon: PackageOpen, tint: 'blue' },
    {
      key: 'repairing',
      title: '수리 중',
      value: `${open.filter((r) => !isNew(r) && !isShipping(r)).length}건`,
      icon: Wrench,
      tint: 'amber',
    },
    { key: 'shipping', title: '발송 대기', value: `${open.filter(isShipping).length}건`, icon: Send, tint: 'green' },
    {
      key: 'done',
      title: `${PERIOD_COMPARE[period].current} 완료`,
      value: `${doneInPeriod.length}건`,
      icon: CircleCheck,
      tint: 'violet',
    },
  ]
}
