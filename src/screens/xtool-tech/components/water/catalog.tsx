import '@/ohq-ui/water'
import './styles/index.scss'
import { WaterSectionBoundary } from '@/ohq-ui/water/catalog/spec'
import { WaterStage } from '@/ohq-ui/water/stage'
import { BoardSection } from './catalog/board-section'
import { OverviewSection } from './catalog/overview-section'

/**
 * 물 부품 카탈로그(tech 부품) — 디자인 화면 "물 · tech" 탭. 기술팀 보드에서만 쓰는 부품(보드 칸·편집 칸·
 * 개요 카드·기록 표)의 물 디자인(D7) 판. 탭을 열 때만 받는다.
 */
export function TechWaterCatalog() {
  return (
    <WaterStage className="water-catalog">
      <WaterSectionBoundary name="보드 칸 · 편집 칸">
        <BoardSection />
      </WaterSectionBoundary>
      <WaterSectionBoundary name="개요 카드 · 목록">
        <OverviewSection />
      </WaterSectionBoundary>
    </WaterStage>
  )
}
