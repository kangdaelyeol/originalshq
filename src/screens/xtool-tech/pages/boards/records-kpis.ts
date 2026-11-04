import { CircleCheck, FileText, ListTodo, Timer } from 'lucide-react'
import type { StatCardData } from '@/ohq-ui/types'
import { PERIOD_COMPARE, type Period } from '../../data/period'
import type { TechBoardDoc } from '../../data/tech-boards'
import { isDone } from '../../data/tech-stage'
import { daysBetween, inRange, periodRange } from '../../lib/dates'

// 자료정리 숫자 카드 — 보드 화면(대시보드·물)과 Monday 표 요약 줄이 같은 것을 그린다(registry).

/** 진행 중 · 완료 · 기간 안 요청 · 평균 소요(요청일 → 완료일) */
export function recordsKpis(doc: TechBoardDoc<'records'>, period: Period, today: string): StatCardData[] {
  const { current } = periodRange(period, today)
  const records = doc.records
  const done = records.filter(isDone)
  const spans = done
    .filter((r) => r.requestedAt && r.completedAt)
    .map((r) => daysBetween(r.requestedAt!, r.completedAt!))
  const avgDays = spans.length ? spans.reduce((sum, n) => sum + n, 0) / spans.length : null
  return [
    { key: 'open', title: '진행 중', value: `${records.filter((r) => !isDone(r)).length}건`, icon: ListTodo, tint: 'amber' },
    { key: 'done', title: '완료', value: `${done.length}건`, icon: CircleCheck, tint: 'green' },
    {
      key: 'requested',
      title: `${PERIOD_COMPARE[period].current} 요청`,
      value: `${records.filter((r) => inRange(r.requestedAt, current)).length}건`,
      icon: FileText,
      tint: 'blue',
    },
    {
      key: 'average',
      title: '평균 소요',
      value: avgDays !== null ? `${avgDays.toFixed(1)}일` : '—',
      icon: Timer,
      tint: 'violet',
    },
  ]
}
