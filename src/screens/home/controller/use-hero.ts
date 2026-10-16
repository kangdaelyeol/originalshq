import { useEffect, useRef } from 'react'

/** 별자리 점 하나 — 위치는 히어로 크기에 대한 비율(0~1)이라 창 크기가 바뀌어도
 * 같은 배치를 유지한다. */
interface Star {
  x: number
  y: number
  r: number
  /** 라일락(0) ~ 파랑(1) 사이 어디쯤의 색인지. */
  tone: number
}

// 로고 그러데이션 양 끝을 검정 위에서 보이게 밝힌 색(variables.scss의
// $brand-lilac-light, $brand-blue-light).
const LILAC = [211, 182, 220]
const BLUE = [140, 156, 240]

// 커서에서 이 거리(px) 안의 점끼리, 그리고 커서와 이어진다.
const LINK_RADIUS = 150

/** 매번 같은 배치가 나오는 난수 — 새로고침할 때마다 별자리가 바뀌지 않게. */
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

const makeStars = (count: number): Star[] => {
  const random = seeded(20240521)
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    r: 0.6 + random() * 1.4,
    tone: random(),
  }))
}

const colorOf = (tone: number, alpha: number) => {
  const mix = LILAC.map((c, i) => Math.round(c + (BLUE[i] - c) * tone))
  return `rgba(${mix[0]}, ${mix[1]}, ${mix[2]}, ${alpha})`
}

/**
 * 히어로의 움직임 세 가지 — 전부 사용자가 움직일 때만 반응하고, 가만히 있으면
 * 멈춰 있다(스스로 반복하는 애니메이션은 두지 않는다).
 *
 *   · 마우스: 커서 위치를 --mx, --my(-1~1)로 히어로에 써서, CSS가 로고를 살짝
 *     기울이고 배경 빛을 따라 움직인다. 별자리는 커서 근처의 점끼리 선으로 잇는다.
 *   · 스크롤: 히어로를 지나가는 정도를 --hero-progress(0~1)로 써서, CSS가
 *     내용을 작아지며 흐려지게 한다.
 *   · 별자리: 캔버스에 점을 한 번 찍어 두고, 커서가 움직일 때만 다시 그린다.
 *
 * 터치 기기와 "동작 줄이기" 설정에서는 마우스 반응과 스크롤 연출을 끄고 점만
 * 찍어 둔다.
 */
export const useHero = () => {
  const heroRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const hero = heroRef.current
    const canvas = canvasRef.current
    if (!hero || !canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const finePointer = window.matchMedia('(pointer: fine)').matches
    const interactive = !reduceMotion && finePointer

    let width = 0
    let height = 0
    let stars: Star[] = []
    let cursor: { x: number; y: number } | null = null
    let frame = 0

    const draw = () => {
      frame = 0
      context.clearRect(0, 0, width, height)

      const points = stars.map((star) => ({
        ...star,
        px: star.x * width,
        py: star.y * height,
      }))

      // 커서 근처의 점끼리, 그리고 커서와 잇는 선.
      if (cursor) {
        const near = points.filter(
          (p) => Math.hypot(p.px - cursor!.x, p.py - cursor!.y) < LINK_RADIUS,
        )
        context.lineWidth = 1
        for (let i = 0; i < near.length; i += 1) {
          const a = near[i]
          const fromCursor = Math.hypot(a.px - cursor.x, a.py - cursor.y)
          context.strokeStyle = colorOf(
            a.tone,
            0.35 * (1 - fromCursor / LINK_RADIUS),
          )
          context.beginPath()
          context.moveTo(cursor.x, cursor.y)
          context.lineTo(a.px, a.py)
          context.stroke()
          for (let j = i + 1; j < near.length; j += 1) {
            const b = near[j]
            const gap = Math.hypot(a.px - b.px, a.py - b.py)
            if (gap > LINK_RADIUS * 0.8) continue
            context.strokeStyle = colorOf(
              a.tone,
              0.18 * (1 - gap / LINK_RADIUS),
            )
            context.beginPath()
            context.moveTo(a.px, a.py)
            context.lineTo(b.px, b.py)
            context.stroke()
          }
        }
      }

      for (const p of points) {
        const lit =
          cursor && Math.hypot(p.px - cursor.x, p.py - cursor.y) < LINK_RADIUS
        context.fillStyle = colorOf(p.tone, lit ? 0.9 : 0.35)
        context.beginPath()
        context.arc(p.px, p.py, lit ? p.r + 0.6 : p.r, 0, Math.PI * 2)
        context.fill()
      }
    }

    const requestDraw = () => {
      if (!frame) frame = requestAnimationFrame(draw)
    }

    const resize = () => {
      const rect = hero.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      // 화면 넓이에 비례한 개수 — 휴대폰에서는 적게.
      stars = makeStars(Math.round(Math.min(110, Math.max(40, width / 14))))
      requestDraw()
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = hero.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      cursor = { x, y }
      hero.style.setProperty('--mx', ((x / rect.width) * 2 - 1).toFixed(3))
      hero.style.setProperty('--my', ((y / rect.height) * 2 - 1).toFixed(3))
      requestDraw()
    }

    const onPointerLeave = () => {
      cursor = null
      hero.style.setProperty('--mx', '0')
      hero.style.setProperty('--my', '0')
      requestDraw()
    }

    let scrollFrame = 0
    const onScroll = () => {
      if (scrollFrame) return
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0
        const rect = hero.getBoundingClientRect()
        const progress = Math.min(1, Math.max(0, -rect.top / rect.height))
        hero.style.setProperty('--hero-progress', progress.toFixed(3))
      })
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(hero)

    if (interactive) {
      hero.addEventListener('pointermove', onPointerMove)
      hero.addEventListener('pointerleave', onPointerLeave)
    }
    if (!reduceMotion) {
      window.addEventListener('scroll', onScroll, { passive: true })
      onScroll()
    }

    return () => {
      observer.disconnect()
      hero.removeEventListener('pointermove', onPointerMove)
      hero.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
      if (scrollFrame) cancelAnimationFrame(scrollFrame)
    }
  }, [])

  return { heroRef, canvasRef }
}
