// 두뇌 지도 장면(BrainScene)에 넘기는 데이터 — 허브·자리·핵·YOU·글. D14 견본은 design14-data의 D14_MAP을,
// 다른 화면(관리 화면 시스템 지도 등)은 자기 데이터로 만든 것을 넘긴다. 좌표 단위 w는 design14-data 머리 주석(1em = 10w).
import { rad } from './brain-camera'
import { CORE_SATELLITES, DEPARTMENTS, YOU, YOU_TOPICS } from './design14-data'

export type Pt = readonly [number, number]

/** 자리 상태 다섯 — 모양(점·고리·호·숨쉬는 고리·▲)이 정해져 있고, 글은 BrainMapData.statusText로 바꾼다 */
export type SeatStatus = 'working' | 'runs-itself' | 'waiting' | 'not-running' | 'in-head'

/** 걷기 멈춤(허브 id 또는 'you')과 초점('overview' 더함) */
export type BrainStop = 'you' | (string & {})
export type BrainFocus = 'overview' | BrainStop

export interface BrainSeat {
  /** 자리 키 — 없으면 name. 한 허브 안에서 겹치지 않게 */
  id?: string
  name: string
  status: SeatStatus
  /** working 호 길이(0~1) */
  progress?: number
  /** 상태 줄 글 — 없으면 statusText[status] */
  note?: string
  /** 초점 화면에서 허브 가운데로부터 자리 가운데(w, x 오른쪽·y 아래) — 없으면 수에 따라 계산(seatLayout) */
  at?: Pt
}

export interface BrainHead {
  name: string
  /** 이름 위 작은 글 — 기본 HEAD */
  tag?: string
  /** 이름 아래 한 줄 */
  sub?: string
  /** 없으면 (0, −80) */
  at?: Pt
}

export interface BrainHub {
  /** 'overview'·'you'와 ':'는 쓰지 않는다(노드 키) */
  id: string
  name: string
  sub: string
  /** 방위각(도)·회전축 거리·높이(w) — hubPlaces로 고를 수 있다 */
  az: number
  rho: number
  h: number
  head: BrainHead
  seats: readonly BrainSeat[]
  /** 고리 안 숫자 — 없으면 자리 수 + 머리 */
  count?: number
}

export interface BrainTopic {
  at: Pt
  waiting?: boolean
}

export interface BrainMapData {
  hubs: readonly BrainHub[]
  /** 가운데 핵 — label은 원 안 글자, satellites는 곁 노란 점(w) */
  core: { name: string; sub: string; label: string; satellites: readonly Pt[] }
  /** YOU — label은 원 안 글자(기본 YOU), badge는 금빛 배지(0이면 숨김), topics는 둘레 점 */
  you: {
    name: string
    sub: string
    label?: string
    badge: number
    az: number
    rho: number
    h: number
    topics: readonly BrainTopic[]
  }
  /** 걷는 순서(← →) — 없으면 YOU 다음 허브 순서 */
  walk?: readonly BrainStop[]
  statusText: Record<SeatStatus, string>
  /** 아래 줄 범례 순서 */
  statusOrder: readonly SeatStatus[]
  /** 아래 줄 — 범례 뒤 두 마디, counts를 주면 범례 옆에 수 */
  hint: { walk: string; click: string; counts?: Partial<Record<SeatStatus, number>> }
  /** 위 줄 — 없으면 BRAIN · LIVE · 신호 수. stats를 주면 신호 수 대신 그 값 */
  bar?: { brand: string; live: string; stats?: readonly { value: string; unit: string }[] }
  /** 한 허브에 보이는 자리 수 — 넘으면 마지막 칸이 "+N" 자리. 없으면 다 보인다 */
  seatLimit?: number
  /** +N 자리 이름표 */
  more?: { name: (rest: number) => string; note?: string }
  /** 자리가 없는 허브의 빈 자리 이름표 */
  empty?: { name: string; note?: string }
  /** 장면 이름(스크린 리더) */
  label?: string
}

/** 기본값 — D14 영상의 YOU 자리·주제 점·코어 곁 점 */
export const BRAIN_DEFAULTS = {
  you: { az: YOU.az, rho: YOU.rho, h: YOU.h },
  topics: YOU_TOPICS,
  satellites: CORE_SATELLITES,
} as const

/** 허브 자리 — 6개면 D14 부서 자리 그대로(방위각 순서), 아니면 고르게 돌며 위아래 번갈아 */
export function hubPlaces(n: number): { az: number; rho: number; h: number }[] {
  if (n === DEPARTMENTS.length) return DEPARTMENTS.map(({ az, rho, h }) => ({ az, rho, h }))
  return Array.from({ length: n }, (_, i) => {
    const az = -48.8 + (360 / n) * i
    return { az: az > 180 ? az - 360 : az, rho: 315, h: i % 2 ? -130 : 130 }
  })
}

const HEAD_AT: Pt = [0, -80]

/**
 * 자리 수에 따른 초점 화면 자리(w) — D14 다섯·여섯 자리 모양을 늘린 것. 머리 둘레 타원 위에 왼쪽·오른쪽 번갈아
 * 위에서 아래로, 홀수면 마지막이 맨 아래 가운데. 많을수록 타원이 조금 커진다(이름표가 겹치지 않게 8자리까지 잼).
 */
export function seatLayout(n: number): Pt[] {
  if (n <= 0) return []
  if (n === 1) return [[116, 0]]
  const pairs = Math.floor(n / 2)
  const odd = n % 2 === 1
  const rx = 116 + 4 * Math.min(pairs, 4)
  const ry = 92 + 5 * Math.min(pairs, 4)
  const from = pairs === 1 ? (odd ? 70 : 90) : 58
  const to = odd ? 132 : 150
  const out: Pt[] = []
  for (let k = 0; k < pairs; k++) {
    const a = rad(pairs === 1 ? from : from + ((to - from) * k) / (pairs - 1))
    const x = Math.round(rx * Math.sin(a) * 10) / 10
    const y = Math.round(-ry * Math.cos(a) * 10) / 10
    out.push([-x, y], [x, y])
  }
  if (odd) out.push([0, ry + 8])
  return out
}

/** 허브 하나에 실제로 그리는 칸 — 사람 자리, 넘친 사람 묶음(+N), 빈 허브 표시 */
export interface BrainSlot {
  key: string
  kind: 'seat' | 'more' | 'empty'
  name: string
  status: SeatStatus
  progress?: number
  note?: string
  at: Pt
  /** kind = seat일 때 넘긴 자리 */
  seat?: BrainSeat
  /** kind = more일 때 남은 사람 수 */
  rest?: number
}

export interface ResolvedHub {
  hub: BrainHub
  head: Pt
  slots: BrainSlot[]
}

/** 자리 자르기·배치 — 다 보이고 모든 자리에 at이 있으면 그 자리 그대로(D14), 아니면 수에 따라 계산 */
export function resolveHub(hub: BrainHub, map: BrainMapData): ResolvedHub {
  const head = hub.head.at ?? HEAD_AT
  const all = hub.seats
  if (all.length === 0) {
    const [at] = seatLayout(1)
    const empty = map.empty ?? { name: 'nobody yet' }
    return {
      hub,
      head,
      slots: [{ key: '~empty', kind: 'empty', name: empty.name, note: empty.note, status: 'in-head', at }],
    }
  }
  const limit = map.seatLimit ?? Infinity
  const cut = all.length > limit
  const shown = cut ? all.slice(0, Math.max(0, limit - 1)) : all
  const fixed = !cut && shown.every((s) => s.at)
  const places = fixed ? shown.map((s) => s.at as Pt) : seatLayout(shown.length + (cut ? 1 : 0))
  const slots: BrainSlot[] = shown.map((seat, i) => ({
    key: seat.id ?? seat.name,
    kind: 'seat',
    name: seat.name,
    status: seat.status,
    progress: seat.progress,
    note: seat.note,
    at: places[i],
    seat,
  }))
  if (cut) {
    const rest = all.length - shown.length
    const more = map.more ?? { name: (n: number) => `+${n} more` }
    slots.push({
      key: '~more',
      kind: 'more',
      name: more.name(rest),
      note: more.note,
      status: 'runs-itself',
      at: places[shown.length],
      rest,
    })
  }
  return { hub, head, slots }
}

/** 엔진이 쓰는 세계 — 허브 자리와 점(0번이 머리), YOU·주제·코어 곁 점·걷는 순서 */
export interface BrainWorld {
  hubs: readonly {
    id: string
    az: number
    rho: number
    h: number
    /** 0번이 머리. line = 허브에서 그 자리로 가는 선·신호(빈 허브 표시는 없다) */
    points: readonly { at: Pt; line: boolean }[]
  }[]
  you: { az: number; rho: number; h: number }
  topics: readonly BrainTopic[]
  satellites: readonly Pt[]
  walk: readonly BrainStop[]
}

export function brainWorld(map: BrainMapData, hubs: readonly ResolvedHub[]): BrainWorld {
  return {
    hubs: hubs.map(({ hub, head, slots }) => ({
      id: hub.id,
      az: hub.az,
      rho: hub.rho,
      h: hub.h,
      points: [{ at: head, line: true }, ...slots.map((s) => ({ at: s.at, line: s.kind !== 'empty' }))],
    })),
    you: { az: map.you.az, rho: map.you.rho, h: map.you.h },
    topics: map.you.topics,
    satellites: map.core.satellites,
    walk: map.walk ?? ['you', ...map.hubs.map((h) => h.id)],
  }
}
