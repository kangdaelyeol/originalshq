import { useEffect, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { useD13Clock } from './d13-clock'
import { drawDashRing } from './dash-ring'
import { D13_INNER, D13_ORBIT, SCENE_W } from './orbit-geometry'
import { createParticleField, createParticleSprites, drawParticleField, fitCanvas } from './particle-field'

interface ParticleRingProps {
  /** 입자 수 */
  count?: number
  /** 각속도 범위(°/초) — 영상 43.5~123 */
  speed?: readonly [number, number]
  /** 안쪽 점선 타원도 그릴지 */
  dashes?: boolean
  seed?: number
  className?: string
}

/** 입자 고리만 따로 — 궤도 장면과 같은 그리기(particle-field·dash-ring)를 자기 캔버스에 */
export function ParticleRing({ count = 130, speed, dashes = true, seed, className }: ParticleRingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const clock = useD13Clock()

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const field = createParticleField({ count, speed, seed })
    const sprites = createParticleSprites()
    let scale = fitCanvas(canvas, SCENE_W)
    const draw = (t: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      if (dashes) drawDashRing(ctx, D13_INNER, t)
      drawParticleField(ctx, field, sprites, D13_ORBIT, t)
    }
    const unsubscribe = clock.subscribe(canvas, draw)
    const resize = new ResizeObserver(() => {
      scale = fitCanvas(canvas, SCENE_W)
      clock.redraw(canvas)
    })
    resize.observe(canvas)
    return () => {
      unsubscribe()
      resize.disconnect()
    }
  }, [clock, count, speed, dashes, seed])

  return <canvas ref={canvasRef} className={cx('d13-ring', className)} aria-hidden />
}
