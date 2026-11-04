import '../styles/index.scss'
import { WaterStage } from '../stage'
import { ChartsSection } from './charts-section'
import { ControlsSection } from './controls-section'
import { WaterSectionBoundary } from './spec'
import { SurfacesSection } from './surfaces-section'

/**
 * 물 부품 카탈로그(기본 부품) — 디자인 화면 "물 · 기본" 탭. D7 무대 위에 물 부품을 묶음별로 늘어놓는다.
 * 탭을 열 때만 받는다(코드·스타일 모두).
 */
export function WaterCatalog() {
  return (
    <WaterStage className="water-catalog">
      <WaterSectionBoundary name="단추 · 고르기 · 입력">
        <ControlsSection />
      </WaterSectionBoundary>
      <WaterSectionBoundary name="카드 · 숫자">
        <SurfacesSection />
      </WaterSectionBoundary>
      <WaterSectionBoundary name="차트">
        <ChartsSection />
      </WaterSectionBoundary>
    </WaterStage>
  )
}
