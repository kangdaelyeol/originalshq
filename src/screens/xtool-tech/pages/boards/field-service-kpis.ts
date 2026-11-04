import { CalendarClock, CircleCheck, Inbox, Truck } from 'lucide-react'
import type { StatCardData } from '@/ohq-ui/types'
import { PERIOD_COMPARE, type Period } from '../../data/period'
import type { FieldServiceRecord, TechBoardDoc } from '../../data/tech-boards'
import { isDone, isNew } from '../../data/tech-stage'
import { byDateAsc, inRange, isoToKoreaDate, periodRange } from '../../lib/dates'

// 출장업무 숫자 카드 — 보드 화면(대시보드·물)과 Monday 표 요약 줄이 같은 것을 그린다(registry).
// 표가 같이 쓰는 기준(끝난 날·다가오는 방문)도 여기 둔다.

type R = FieldServiceRecord

/** 끝난 날 — 방문일, 없으면 마지막 수정일 */
export const doneOn = (r: R) => r.visitAt ?? isoToKoreaDate(r.updatedAt)

/** 다가오는 방문 — 진행 중이고 방문일이 오늘 이후인 건, 가까운 순 */
export const upcomingVisits = (records: R[], today: string) =>
  records
    .filter((r) => !isDone(r) && r.visitAt && r.visitAt >= today)
    .sort((a, b) => byDateAsc(a.visitAt, b.visitAt))

/** 신규 · 일정 조율 중 · 방문 예정 · 기간 안 완료 */
export function fieldServiceKpis(doc: TechBoardDoc<'fieldService'>, period: Period, today: string): StatCardData[] {
  const { current } = periodRange(period, today)
  const records = doc.records
  const open = records.filter((r) => !isDone(r))
  const doneInPeriod = records.filter((r) => isDone(r) && inRange(doneOn(r), current))
  return [
    { key: 'new', title: '신규 출장', value: `${open.filter(isNew).length}건`, icon: Inbox, tint: 'blue' },
    {
      key: 'scheduling',
      title: '일정 조율 중',
      value: `${open.filter((r) => /조율/.test(r.stage ?? '')).length}건`,
      icon: CalendarClock,
      tint: 'amber',
    },
    { key: 'upcoming', title: '방문 예정', value: `${upcomingVisits(records, today).length}건`, icon: Truck, tint: 'green' },
    {
      key: 'done',
      title: `${PERIOD_COMPARE[period].current} 완료`,
      value: `${doneInPeriod.length}건`,
      icon: CircleCheck,
      tint: 'violet',
    },
  ]
}
