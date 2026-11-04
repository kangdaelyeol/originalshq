import type { ReactNode } from 'react'
import { cx } from '../lib/cx'
import { useWaterDpx } from './hooks'

interface WaterStageProps {
  children: ReactNode
  className?: string
}

/**
 * 물 무대(D7) — 연회색 유리 타일 벽. 왼쪽 위가 밝은 사선 그러데이션(rgb 227 → 172) 위에 465×196 타일의
 * 2px 격자선(16.5%)과 타일마다 다른 밝기(3×3 반복)를 얹는다. 물 부품은 이 밝은 벽 위에서 보이게 만들었다 —
 * 유리는 거의 투명하고 테두리·그림자로만 선다. 무대 안 장치 화소 한 칸(--w-dpx)은 실제 배율(조상 zoom까지)로
 * 맞춘다(useWaterDpx).
 */
export function WaterStage({ children, className }: WaterStageProps) {
  const ref = useWaterDpx<HTMLDivElement>()
  return (
    <div ref={ref} className={cx('water-stage', className)}>
      {children}
    </div>
  )
}
