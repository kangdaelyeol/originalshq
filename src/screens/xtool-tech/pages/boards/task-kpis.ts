import { CircleCheck, CircleDashed, ListTodo, OctagonAlert } from 'lucide-react'
import type { StatCardData } from '@/ohq-ui/types'
import { PERIOD_COMPARE, type Period } from '../../data/period'
import type { TaskRecord, TechBoardDoc } from '@xtool-core/tech-boards'
import { isBlocked, isDone, isNew } from '@xtool-core/tech-stage'
import { inRange, isoToKoreaDate, periodRange } from '@xtool-core/dates'

// 기타업무 숫자 카드 — 보드 화면(대시보드·물)과 Monday 표 요약 줄이 같은 것을 그린다(registry).

type R = TaskRecord

/** 끝난 날 — 완료일, 없으면 마지막 수정일(표의 완료 정렬도 쓴다) */
export const doneOn = (r: R) => r.completedAt ?? isoToKoreaDate(r.updatedAt)

/** 진행 전 · 진행 중 · 막힘 · 기간 안 완료 */
export function taskKpis(doc: TechBoardDoc<'techTask'>, period: Period, today: string): StatCardData[] {
  const { current } = periodRange(period, today)
  const records = doc.records
  const open = records.filter((r) => !isDone(r))
  const doneInPeriod = records.filter((r) => isDone(r) && inRange(doneOn(r), current))
  return [
    { key: 'new', title: '진행 전', value: `${open.filter(isNew).length}건`, icon: CircleDashed, tint: 'blue' },
    {
      key: 'working',
      title: '진행 중',
      value: `${open.filter((r) => !isNew(r) && !isBlocked(r)).length}건`,
      icon: ListTodo,
      tint: 'amber',
    },
    { key: 'blocked', title: '막힘', value: `${open.filter(isBlocked).length}건`, icon: OctagonAlert, tint: 'violet' },
    {
      key: 'done',
      title: `${PERIOD_COMPARE[period].current} 완료`,
      value: `${doneInPeriod.length}건`,
      icon: CircleCheck,
      tint: 'green',
    },
  ]
}
