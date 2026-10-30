import { useId } from 'react'
import { mixHex } from '../../settings/accent'
import { round1, seededRandom } from './seeded'

// 실크 웨이브 — 받아 둔 보라 비단 물결 텍스처를 벡터로 다시 그린 것(원본 이미지는 쓰지 않아 지웠다).
// 리본마다 같은 곡선을 따라 "몸통(넓고 흐림) · 빛 받는 면 · 날카로운 광택선 · 접힌 그림자"
// 네 겹을 겹쳐 비단 주름처럼 보이게 하고, 색은 전부 강조색에서 만든다.

const W = 1600
const H = 1000
const STEP = 24
// 겹마다 흐림 정도 — 몸통은 크게, 광택선은 거의 안 흐리게.
const BLUR = { body: 30, face: 18, fold: 13, gloss: 2.6 } as const

interface Ribbon {
  /** 리본 가운데 곡선에서 dy만큼 위아래로 민 path */
  path: (dy: number) => string
  thickness: number
  strength: number
  blur: number
}

function buildRibbons(): Ribbon[] {
  const rand = seededRandom(424242)
  const ribbons: Ribbon[] = []
  for (let i = 0; i < 6; i++) {
    const y0 = -240 + i * 205 + rand() * 60
    const slope = 0.28 + rand() * 0.1
    const a1 = 55 + rand() * 75
    const l1 = 900 + rand() * 700
    const p1 = rand() * Math.PI * 2
    const a2 = 18 + rand() * 30
    const l2 = 380 + rand() * 260
    const p2 = rand() * Math.PI * 2
    const curve = (x: number) =>
      y0 + slope * x + a1 * Math.sin((x / l1) * Math.PI * 2 + p1) + a2 * Math.sin((x / l2) * Math.PI * 2 + p2)
    ribbons.push({
      path: (dy) => {
        let d = ''
        for (let x = -160; x <= W + 160; x += STEP) d += `${d ? 'L' : 'M'}${x} ${round1(curve(x) + dy)}`
        return d
      },
      thickness: 130 + rand() * 170,
      // 가운데 몇 줄이 가장 밝게 — 원본처럼 왼쪽 위에서 오른쪽 아래로 흐르는 빛.
      strength: 0.35 + 0.65 * Math.exp(-(((i - 2.7) / 2) ** 2)),
      blur: 6 + rand() * 10,
    })
  }
  return ribbons
}

// 모양은 강조색과 상관없이 늘 같아서 처음 한 번만 만든다(색만 렌더 때 입힌다).
const RIBBONS = buildRibbons()

export function SilkWaves({ accent }: { accent: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const light = mixHex(accent, '#ffffff', 0.45)
  const deep = mixHex(accent, '#000000', 0.55)
  const ground = mixHex(accent, '#000000', 0.95)

  return (
    <div className="bg-art bg-art--silk">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id={`${uid}-ground`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={ground} />
            <stop offset="100%" stopColor="#020203" />
          </linearGradient>
          <radialGradient id={`${uid}-glow`} cx="0.3" cy="0.25" r="0.75">
            <stop offset="0%" stopColor={accent} stopOpacity={0.16} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </radialGradient>
          {Object.entries(BLUR).map(([name, s]) => (
            <filter key={name} id={`${uid}-${name}`} filterUnits="userSpaceOnUse" x={-200} y={-300} width={W + 400} height={H + 600}>
              <feGaussianBlur stdDeviation={s} />
            </filter>
          ))}
        </defs>

        <rect width={W} height={H} fill={`url(#${uid}-ground)`} />
        <rect width={W} height={H} fill={`url(#${uid}-glow)`} />

        <g fill="none" strokeLinecap="round">
          {RIBBONS.map((r, i) => (
            <g key={i} opacity={r.strength}>
              {/* 몸통 — 넓고 흐린 짙은 색 */}
              <path d={r.path(0)} stroke={deep} strokeWidth={r.thickness} strokeOpacity={0.55} filter={`url(#${uid}-body)`} />
              {/* 빛 받는 면 — 위쪽으로 치우친 강조색 */}
              <path d={r.path(-r.thickness * 0.18)} stroke={accent} strokeWidth={r.thickness * 0.5} strokeOpacity={0.6} filter={`url(#${uid}-face)`} />
              {/* 접힌 그림자 — 아래쪽 검은 띠 */}
              <path d={r.path(r.thickness * 0.34)} stroke="#000" strokeWidth={r.thickness * 0.38} strokeOpacity={0.6} filter={`url(#${uid}-fold)`} />
              {/* 광택선 — 비단 주름 위 날카로운 빛 */}
              <path d={r.path(-r.thickness * 0.36)} stroke={light} strokeWidth={3.2} strokeOpacity={0.42} filter={`url(#${uid}-gloss)`} />
            </g>
          ))}
        </g>
      </svg>
      <div className="bg-art__vignette" />
    </div>
  )
}
