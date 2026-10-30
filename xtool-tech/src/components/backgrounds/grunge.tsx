import { useId } from 'react'
import { mixHex } from '../../settings/accent'
import { round1, seededRandom } from './seeded'

// 그런지 — 받아 둔 그런지 텍스처와 같은 분위기(천 결 · 긁힘 · 얼룩)를 직접 생성한다.
// 원본은 VectorStock 워터마크가 찍힌 미리보기라 쓰지 않고 지웠다. 긁힘·얼룩에 강조색이 배어든다.

const W = 1600
const H = 1000

interface GrungeMarks {
  scratches: string
  brightScratches: string
  specks: string
  blots: string
}

function buildMarks(): GrungeMarks {
  const rand = seededRandom(20261030)
  const line = () => {
    // 대부분 세로로 긴 긁힘, 일부는 가로 — 원본의 결.
    const vertical = rand() < 0.78
    const angle = vertical ? Math.PI / 2 + (rand() - 0.5) * 0.45 : (rand() - 0.5) * 0.35
    const length = 14 + rand() ** 2.2 * 260
    const x = rand() * W
    const y = rand() * H
    const dx = Math.cos(angle) * length
    const dy = Math.sin(angle) * length
    return `M${round1(x)} ${round1(y)}L${round1(x + dx)} ${round1(y + dy)}`
  }
  const dot = (rMin: number, rMax: number) => {
    const r = rMin + rand() ** 2 * (rMax - rMin)
    const x = round1(rand() * W)
    const y = round1(rand() * H)
    const rr = round1(r)
    return `M${x - rr} ${y}a${rr} ${rr} 0 1 0 ${rr * 2} 0a${rr} ${rr} 0 1 0 ${-rr * 2} 0`
  }
  return {
    scratches: Array.from({ length: 320 }, line).join(''),
    brightScratches: Array.from({ length: 70 }, line).join(''),
    specks: Array.from({ length: 520 }, () => dot(0.6, 2.4)).join(''),
    blots: Array.from({ length: 46 }, () => dot(3, 10)).join(''),
  }
}

// 긁힘·얼룩 자리는 강조색과 상관없이 늘 같아서 처음 한 번만 만든다.
const MARKS = buildMarks()

export function Grunge({ accent }: { accent: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const ink = mixHex('#9aa3b5', accent, 0.35)
  const inkBright = mixHex('#d3d9e4', accent, 0.25)

  return (
    <div className="bg-art bg-art--grunge">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id={`${uid}-ground`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor={mixHex('#171a21', accent, 0.05)} />
            <stop offset="100%" stopColor="#090a0d" />
          </linearGradient>
          {/* 원본처럼 한쪽이 빛을 받아 밝은 세로 띠 */}
          <radialGradient id={`${uid}-band`} cx="0.42" cy="0.2" r="0.6" gradientTransform="translate(0.42 0.2) scale(0.55 1.4) translate(-0.42 -0.2)">
            <stop offset="0%" stopColor={inkBright} stopOpacity={0.16} />
            <stop offset="100%" stopColor={inkBright} stopOpacity={0} />
          </radialGradient>
          {/* 캔버스 천 결 — 가로세로 주파수가 다른 잡음 */}
          <filter id={`${uid}-weave`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9 0.55" numOctaves={2} seed={7} />
            <feColorMatrix type="matrix" values="0 0 0 0 0.72  0 0 0 0 0.75  0 0 0 0 0.8  0 0 0 1.4 -0.62" />
          </filter>
          {/* 얼룩 가장자리를 거칠게 */}
          <filter id={`${uid}-rough`} filterUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves={2} seed={3} result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={5} />
          </filter>
        </defs>

        <rect width={W} height={H} fill={`url(#${uid}-ground)`} />
        <rect width={W} height={H} fill={`url(#${uid}-band)`} />
        <rect width={W} height={H} filter={`url(#${uid}-weave)`} opacity={0.32} />

        <g fill="none" strokeLinecap="round">
          <path d={MARKS.scratches} stroke={ink} strokeWidth={1} strokeOpacity={0.32} />
          <path d={MARKS.brightScratches} stroke={inkBright} strokeWidth={1.3} strokeOpacity={0.55} />
        </g>
        <g filter={`url(#${uid}-rough)`}>
          <path d={MARKS.specks} fill={ink} fillOpacity={0.45} />
          <path d={MARKS.blots} fill={ink} fillOpacity={0.28} />
        </g>
      </svg>
      <div className="bg-art__vignette" />
    </div>
  )
}
