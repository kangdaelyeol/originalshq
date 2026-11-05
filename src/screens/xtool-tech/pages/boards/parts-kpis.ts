import { CircleAlert, Package, PackageX, Receipt } from 'lucide-react'
import type { StatCardData } from '@/ohq-ui/types'
import type { PartRecord, TechBoardDoc } from '@xtool-core/tech-boards'

// 부품 마스터 숫자 카드 — 보드 화면(대시보드·물)과 Monday 표 요약 줄이 같은 것을 그린다(registry).
// 재고 기준(없음·적음)은 표의 재고 칸·재고 부족 목록도 쓴다.

type R = PartRecord

// 재고가 이 수 이하면 "적음"
export const LOW_STOCK = 2

export const isOut = (r: R) => r.stock !== null && r.stock <= 0
export const isLow = (r: R) => r.stock !== null && r.stock > 0 && r.stock <= LOW_STOCK

/** 전체 부품 · 재고 없음 · 재고 적음 · 비용 미입력 — 기간과 상관없다 */
export function partsKpis(doc: TechBoardDoc<'parts'>): StatCardData[] {
  const records = doc.records
  return [
    {
      key: 'all',
      title: '전체 부품',
      value: `${records.length}개`,
      icon: Package,
      tint: 'blue',
      caption: `재고 입력 ${records.filter((r) => r.stock !== null).length}개`,
    },
    {
      key: 'out',
      title: '재고 없음',
      value: `${records.filter(isOut).length}개`,
      icon: PackageX,
      tint: 'violet',
      caption: '재고 0 이하(마이너스 포함)',
    },
    {
      key: 'low',
      title: '재고 적음',
      value: `${records.filter(isLow).length}개`,
      icon: CircleAlert,
      tint: 'amber',
      caption: `${LOW_STOCK}개 이하`,
    },
    {
      key: 'no-cost',
      title: '비용 미입력',
      value: `${records.filter((r) => r.cost === null).length}개`,
      icon: Receipt,
      tint: 'green',
      caption: '부품 비용 칸이 빈 부품',
    },
  ]
}
