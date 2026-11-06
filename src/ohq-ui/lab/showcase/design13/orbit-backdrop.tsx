import { useId } from 'react'
import { D13_ORBIT, SCENE_H, SCENE_W, type Ellipse } from './orbit-geometry'
import { mulberry32 } from './particle-field'

interface OrbitBackdropProps {
  orbit?: Ellipse
  /** 별 개수(영상 중앙값 화면에서 고르게 흩어진 1px 점 90개 남짓) */
  stars?: number
}

interface Star {
  x: number
  y: number
  r: number
  o: number
}

function makeStars(count: number, seed: number): Star[] {
  const rand = mulberry32(seed)
  return Array.from({ length: count }, () => ({
    x: rand() * SCENE_W,
    y: rand() * SCENE_H,
    r: 0.45 + rand() * 0.45,
    o: 0.12 + rand() * 0.4,
  }))
}

const STARS = makeStars(95, 7)

/**
 * 장면 뒤 움직이지 않는 층 — 별, 궤도를 따라 흐릿하게 빛나는 띠. 띠는 원(반지름 280)에 굵기를 준 뒤 세로로
 * 눌러서(122.4/280) 옆은 두껍고(17px) 위아래는 얇다(7px) — 영상 30백분위 화면에서 잰 폭 비율 그대로.
 */
export function OrbitBackdrop({ orbit = D13_ORBIT, stars }: OrbitBackdropProps) {
  const blur = `d13-band-${useId().replace(/:/g, '')}`
  const list = stars === undefined ? STARS : STARS.slice(0, stars)
  const squash = orbit.ry / orbit.rx
  return (
    <svg className="d13-orbit__backdrop" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <filter id={blur} x="-10%" y="-30%" width="120%" height="160%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
      </defs>
      <g fill="#fff4fb">
        {list.map((s, i) => (
          <circle key={i} cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.r.toFixed(2)} opacity={s.o.toFixed(2)} />
        ))}
      </g>
      <g
        transform={`translate(${orbit.cx} ${orbit.cy}) rotate(${((orbit.tilt * 180) / Math.PI).toFixed(2)}) scale(1 ${squash.toFixed(4)})`}
      >
        <circle
          r={orbit.rx}
          fill="none"
          stroke="rgba(255, 214, 240, 0.075)"
          strokeWidth="22"
          filter={`url(#${blur})`}
        />
      </g>
    </svg>
  )
}
