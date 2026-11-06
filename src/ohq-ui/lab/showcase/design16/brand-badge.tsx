import { Leaf, PanelLeft } from 'lucide-react'

interface BrandBadgeProps {
  name: string
  shop: string
  /** 오른쪽 접기 단추 */
  collapse?: boolean
}

/** 사이드바 머리 — 파란 그러데이션 칸(18px, 잎) + "Cirrel"(9.2px 600) · "Kiln & Leaf" + 접기 동그라미 */
export function BrandBadge({ name, shop, collapse = true }: BrandBadgeProps) {
  return (
    <div className="d16-brand">
      <span className="d16-brand__mark" aria-hidden>
        <Leaf strokeWidth={2.2} />
      </span>
      <span className="d16-brand__text">
        <span className="d16-brand__name">{name}</span>
        <span className="d16-brand__shop">{shop}</span>
      </span>
      {collapse && (
        <button type="button" className="d16-brand__collapse d16-hov" aria-label="Collapse sidebar">
          <PanelLeft strokeWidth={1.8} aria-hidden />
        </button>
      )}
    </div>
  )
}
