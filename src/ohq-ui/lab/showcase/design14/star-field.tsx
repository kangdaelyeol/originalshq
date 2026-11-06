import { useEffect, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { seeded } from './brain-camera'

interface StarFieldProps {
  /** 1000×1000 CSS px마다 별 수 — 영상(t=0)은 테두리 밖 720×640 안에 약 150개 */
  density?: number
  /** 반짝임(움직임 줄이기 설정이면 멈춘다) */
  twinkle?: boolean
  seed?: number
  className?: string
}

// 별 색 — t=47.8 테두리 밖(밝게 한 c_stars): 회백이 대부분, 따뜻한 색·푸른 색·붉은 점이 조금
const STAR_COLORS: readonly (readonly [number, readonly [number, number, number]])[] = [
  [0.7, [222, 218, 214]],
  [0.12, [240, 206, 168]],
  [0.08, [170, 186, 255]],
  [0.06, [255, 140, 110]],
  [0.04, [242, 214, 122]],
]

interface Star {
  /** 0~1 자리 */
  u: number
  v: number
  r: number
  a: number
  rgb: readonly [number, number, number]
  /** 반짝이는 별만 — 주기(초)·위상. 영상 t=30.43~30.70에 별 셋이 새로 나타났다 사라진다 */
  period: number
  phase: number
}

function makeStars(count: number, seed: number): Star[] {
  const rnd = seeded(seed)
  const stars: Star[] = []
  for (let i = 0; i < count; i++) {
    const pick = rnd()
    let acc = 0
    let rgb = STAR_COLORS[0][1]
    for (const [w, c] of STAR_COLORS) {
      acc += w
      if (pick <= acc) {
        rgb = c
        break
      }
    }
    const bright = rnd() < 0.1
    stars.push({
      u: rnd(),
      v: rnd(),
      r: bright ? 1 + rnd() * 0.8 : 0.5 + rnd() * 0.55,
      a: bright ? 0.6 + rnd() * 0.25 : 0.18 + rnd() * 0.34,
      rgb,
      period: rnd() < 0.35 ? 2.5 + rnd() * 4.5 : 0,
      phase: rnd() * Math.PI * 2,
    })
  }
  return stars
}

/**
 * 별 바탕 — 화면에 붙어 있다(카메라가 돌아도 그대로: t=30.23~31.90 별 16개가 0.1px도 안 움직인다).
 * 일부만 천천히 반짝인다. 화면 밖이면 멈춘다.
 */
export function StarField({ density = 260, twinkle = true, seed = 14, className }: StarFieldProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const live = twinkle && !reduce
    let stars: Star[] = []
    let w = 0
    let h = 0
    let dpr = 1
    let raf = 0
    let visible = true
    let frame = 0

    const draw = (time: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      // 별 크기는 무대 크기를 따라간다(영상 720px 폭 기준)
      const unit = Math.max(0.7, Math.min(1.6, Math.min(w, h) / 620))
      for (const s of stars) {
        let a = s.a
        if (live && s.period)
          a *= 0.25 + 0.75 * (0.5 + 0.5 * Math.sin((time / 1000) * ((2 * Math.PI) / s.period) + s.phase))
        ctx.fillStyle = `rgba(${s.rgb[0]},${s.rgb[1]},${s.rgb[2]},${a.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(s.u * w, s.v * h, s.r * unit, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    const tick = (time: number) => {
      raf = 0
      // 반짝임은 느려서 두 프레임에 한 번만 그린다
      if (frame++ % 2 === 0) draw(time)
      if (live && visible) raf = requestAnimationFrame(tick)
    }
    const kick = () => {
      if (!raf && live && visible) raf = requestAnimationFrame(tick)
    }
    const measure = () => {
      const box = canvas.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = box.width
      h = box.height
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      stars = makeStars(Math.round((w * h * density) / 1e6), seed)
      draw(performance.now())
    }
    const resize = new ResizeObserver(measure)
    resize.observe(canvas)
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) kick()
    })
    io.observe(canvas)
    measure()
    kick()
    return () => {
      cancelAnimationFrame(raf)
      resize.disconnect()
      io.disconnect()
    }
  }, [density, twinkle, seed])

  return <canvas ref={ref} className={cx('d14-stars', className)} aria-hidden="true" />
}
