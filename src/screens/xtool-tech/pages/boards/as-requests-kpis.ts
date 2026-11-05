import { ClipboardPen, Inbox, Paperclip, SquareCheck } from 'lucide-react'
import type { StatCardData } from '@/ohq-ui/types'
import { PERIOD_COMPARE, type Period } from '../../data/period'
import type { TechBoardDoc } from '@xtool-core/tech-boards'
import { inRange, periodRange } from '@xtool-core/dates'

// AS 신청서 숫자 카드 — 보드 화면(대시보드·물)과 Monday 표 요약 줄이 같은 것을 그린다(registry).

/** 전체 신청 · 기간 안 신청(직전 기간과 비교) · 확인사항 미체크 · 첨부 있음 */
export function asRequestsKpis(doc: TechBoardDoc<'asRequests'>, period: Period, today: string): StatCardData[] {
  const { current, previous } = periodRange(period, today)
  const names = PERIOD_COMPARE[period]
  const records = doc.records
  return [
    { key: 'all', title: '전체 신청', value: `${records.length}건`, icon: ClipboardPen, tint: 'blue', caption: 'AS 신청서 보드 전체' },
    {
      key: 'received',
      title: `${names.current} 신청`,
      value: `${records.filter((r) => inRange(r.receivedAt, current)).length}건`,
      icon: Inbox,
      tint: 'green',
      caption: `${names.previous} ${records.filter((r) => inRange(r.receivedAt, previous)).length}건`,
    },
    {
      key: 'unchecked',
      title: '확인사항 미체크',
      value: `${records.filter((r) => !r.agreed).length}건`,
      icon: SquareCheck,
      tint: 'amber',
      caption: '신청자가 확인사항에 동의 안 함',
    },
    {
      key: 'attached',
      title: '첨부 있음',
      value: `${records.filter((r) => r.attachmentCount > 0).length}건`,
      icon: Paperclip,
      tint: 'violet',
      caption: '사진·파일을 올린 신청',
    },
  ]
}
