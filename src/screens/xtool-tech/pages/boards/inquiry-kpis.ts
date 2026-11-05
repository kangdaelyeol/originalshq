import { CircleCheck, Hourglass, MessageCircle, MessagesSquare } from 'lucide-react'
import type { StatCardData } from '@/ohq-ui/types'
import { PERIOD_COMPARE, type Period } from '../../data/period'
import type { InquiryRecord, TechBoardDoc } from '@xtool-core/tech-boards'
import { isDone } from '@xtool-core/tech-stage'
import { inRange, periodRange, type DateRange } from '@xtool-core/dates'

// 아톡문의 숫자 카드 — 보드 화면(대시보드·물)과 Monday 표 요약 줄이 같은 것을 그린다(registry).

type R = InquiryRecord

const isWaiting = (r: R) => /신규|1차/.test(r.stage ?? '')
const isLong = (r: R) => /장기/.test(r.stage ?? '')

/** 기간 안에 접수된 문의 — 숫자 카드와 보드의 문의 종류·기기 계열 차트가 같이 센다 */
export const receivedIn = (records: R[], range: DateRange) => records.filter((r) => inRange(r.receivedAt, range))

/** 응대 대기 · 상담 진행 중 · 장기 상담 · 기간 안 접수 */
export function inquiryKpis(doc: TechBoardDoc<'techInquiry'>, period: Period, today: string): StatCardData[] {
  const { current } = periodRange(period, today)
  const records = doc.records
  const open = records.filter((r) => !isDone(r))
  return [
    { key: 'waiting', title: '응대 대기', value: `${open.filter(isWaiting).length}건`, icon: MessageCircle, tint: 'blue' },
    {
      key: 'talking',
      title: '상담 진행 중',
      value: `${open.filter((r) => !isWaiting(r) && !isLong(r)).length}건`,
      icon: MessagesSquare,
      tint: 'amber',
    },
    { key: 'long', title: '장기 상담', value: `${open.filter(isLong).length}건`, icon: Hourglass, tint: 'violet' },
    {
      key: 'received',
      title: `${PERIOD_COMPARE[period].current} 접수`,
      value: `${receivedIn(records, current).length}건`,
      icon: CircleCheck,
      tint: 'green',
    },
  ]
}
