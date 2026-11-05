import { CircleCheck, OctagonAlert, PackageOpen, Wrench } from 'lucide-react'
import type { StatCardData, Tone } from '@/ohq-ui/types'
import type { RentalRecord, TechBoardDoc } from '@xtool-core/tech-boards'

// 대여품 관리 숫자 카드 — 보드 화면(대시보드·물)과 Monday 표 요약 줄이 같은 것을 그린다(registry).
// 대여 상태 나누기는 표의 상태 칸도 쓴다.

type R = RentalRecord

/** 대여 상태 — 상태 칸(없으면 그룹 이름)으로 가른다. */
export type Phase = 'available' | 'rented' | 'checking' | 'broken' | 'other'
export const phaseOf = (r: R): Phase => {
  const text = `${r.status ?? ''} ${r.stage ?? ''}`
  if (/불량/.test(text)) return 'broken'
  if (/점검/.test(text)) return 'checking'
  if (/대여\s*중/.test(text)) return 'rented'
  if (/가능/.test(text)) return 'available'
  return 'other'
}
export const PHASE: Record<Phase, { label: string; tone: Tone }> = {
  available: { label: '대여 가능', tone: 'good' },
  rented: { label: '대여 중', tone: 'info' },
  checking: { label: '회수 후 점검', tone: 'warn' },
  broken: { label: '불량', tone: 'crit' },
  other: { label: '기타', tone: 'neutral' },
}

/** 대여 가능 · 대여 중 · 회수 후 점검 · 불량 — 기간과 상관없다 */
export function rentalsKpis(doc: TechBoardDoc<'rentals'>): StatCardData[] {
  const count = (phase: Phase) => doc.records.filter((r) => phaseOf(r) === phase).length
  return [
    { key: 'available', title: PHASE.available.label, value: `${count('available')}대`, icon: CircleCheck, tint: 'green' },
    { key: 'rented', title: PHASE.rented.label, value: `${count('rented')}대`, icon: PackageOpen, tint: 'blue' },
    { key: 'checking', title: PHASE.checking.label, value: `${count('checking')}대`, icon: Wrench, tint: 'amber' },
    { key: 'broken', title: PHASE.broken.label, value: `${count('broken')}대`, icon: OctagonAlert, tint: 'violet' },
  ]
}
