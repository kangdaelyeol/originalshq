import type { CSSProperties, ReactNode } from 'react'
import { TILE_H, TILE_SHADE, TILE_W } from './liquid-menu-data'

/**
 * 영상의 무대(Design 7) — 연회색 유리 타일 벽. 왼쪽 위가 밝은 사선 그러데이션 위에
 * 2px 격자선과 타일마다 다른 밝기를 얹는다. 자식은 무대 한가운데(= 접힌 버튼 가운데)를 원점으로 놓인다.
 */
export function LiquidScene({ children }: { children: ReactNode }) {
  return (
    <div className="d7-scene">
      <div className="d7-scene__tiles" aria-hidden>
        {TILE_SHADE.map((row, r) =>
          row.map((shade, c) => (
            <span
              key={`${r}-${c}`}
              className="d7-scene__tile"
              style={
                {
                  left: `${(-231.7 + TILE_W * (c - 1)) / 10}em`,
                  top: `${(-98 + TILE_H * (r - 1)) / 10}em`,
                  background: shade < 0 ? `rgba(0, 0, 0, ${(-shade / 197).toFixed(3)})` : 'transparent',
                } as CSSProperties
              }
            />
          )),
        )}
      </div>
      <div className="d7-scene__origin">{children}</div>
    </div>
  )
}
