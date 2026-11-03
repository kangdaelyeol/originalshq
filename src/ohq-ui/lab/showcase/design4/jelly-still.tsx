import { useEffect, useRef } from 'react'
import { loadJellyFonts } from './jelly-digits'
import { ALL_LAYERS, type JellyLayers } from './jelly-renderer'
import { renderJellyStill } from './jelly-still-renderer'

interface JellyStillProps {
  /** 영상 프레임(F36~F150) — 그 순간의 젤리 모양·숫자 */
  frame: number
  /** 켤 부품(기본 전부) — 같은 객체를 넘겨야 다시 그리지 않는다 */
  layers?: JellyLayers
  /** 읽어 줄 설명 */
  label: string
}

/** 젤리 슬라이더 정지 화면(견본용) — 영상의 한 프레임을 홈 둘레만 크게 그린다. 움직이지 않는다. */
export function JellyStill({ frame, layers = ALL_LAYERS, label }: JellyStillProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let alive = true
    void loadJellyFonts().then(() => {
      if (!alive) return
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      try {
        renderJellyStill(canvas, frame, layers)
      } catch {
        // WebGL2가 없으면 빈 칸으로 둔다(본 슬라이더가 안내를 띄운다)
      }
    })
    return () => {
      alive = false
    }
  }, [frame, layers])

  return <canvas ref={ref} className="d4-still" role="img" aria-label={label} />
}
