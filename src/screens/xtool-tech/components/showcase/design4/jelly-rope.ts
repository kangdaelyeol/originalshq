// 젤리 몸통의 뼈대 — 점 17개를 verlet 줄로 이은 2D 물리(세계 좌표 x = 홈을 따라, y = 위).
// 식은 TypeGPU 예제 "Jelly Slider"(Copyright (c) 2025 Software Mansion, MIT)의 slider.ts를 옮겼다.
// 영상(sample/design4.mp4)은 그 예제가 따라 만든 원작 쪽이라 모양이 조금 달라서, 값 몇 개를
// 매개변수로 빼 영상에 맞췄다(VIDEO_ROPE). 끝(손잡이)을 왼쪽으로 밀면 남는 길이가 위로 솟고,
// 오른쪽으로 끌면 펴진다 — 출렁임은 전부 이 계산에서 나온다.
//
// 이 파일은 브라우저 API를 쓰지 않는다(노드에서 그대로 돌려 영상과 맞춰 보려고 import도 없다).

/** 줄의 점 개수 — 마지막 구간은 둥근 끝(D 모양)으로 그린다 */
export const ROPE_POINTS = 17

/** 왼쪽 고정점 — 홈 왼쪽 끝 */
export const ROPE_ANCHOR_X = -1
/** 처음 놓인 오른쪽 끝 = 가장 멀리 끌 수 있는 자리(100%) */
export const ROPE_MAX_X = 0.9
/** 줄 전체 길이(고정점 → 끝) */
export const ROPE_LENGTH = ROPE_MAX_X - ROPE_ANCHOR_X
/** 홈 바닥에 붙어 있을 때 줄 중심 높이 — 띠(반두께 0.04) 밑면이 바닥(-0.06) 바로 위(-0.054)에 오게 */
export const ROPE_BASE_Y = -0.014
/** 손잡이 점은 바닥보다 0.08 들려 있다 — 끝이 살짝 고개를 든 모양 */
export const ROPE_KNOB_Y = ROPE_BASE_Y + 0.08

const N = ROPE_POINTS

/** 줄 물리 값 — 기본은 원본 예제(TypeGPU) 그대로, 영상에 맞춘 값은 jelly-engine.ts가 넘긴다 */
export interface RopeParams {
  /** 줄의 쉬는 길이 ÷ 고정점~끝 거리 — 1보다 작으면 끝까지 끌 때 늘어나고, 밀 때 덜 솟는다 */
  slack: number
  /** 이웃 점 사이 길이를 맞추는 세기(원본 0.1) — 작을수록 잘 늘고 줄어든다 */
  stretchStiffness: number
  iterations: number
  substeps: number
  damping: number
  bendingStrength: number
  bendingExponent: number
  /** 굽힘 저항의 좌우 치우침 — 0이면 양 끝이 똑같이 뻣뻣, 1이면 고정점 쪽만 무르다 */
  bendingSkew: number
  archStrength: number
  /** 끝까지 끌어도 남는 솟는 힘(눌린 정도의 바닥값) — 끌려가며 띠가 홈 위로 살짝 뜬 채 출렁이게 */
  archMin: number
  /** 솟는 힘이 가장 센 자리(0 = 고정점, 1 = 손잡이). 원본은 가운데(0.5) */
  archPeak: number
  archEdgeDeadzone: number
  /** 고정점 쪽 첫 점을 바닥으로 당기는 세기(원본 0.05) */
  endFlatLeft: number
  /** 손잡이 쪽 끝에서 두 번째 점을 바닥으로 당기는 세기(원본 0.05) */
  endFlatRight: number
}

export const TYPEGPU_ROPE: RopeParams = {
  slack: 1,
  stretchStiffness: 0.1,
  iterations: 16,
  substeps: 6,
  damping: 0.01,
  bendingStrength: 0.1,
  bendingExponent: 1.2,
  bendingSkew: 0,
  archStrength: 2,
  archMin: 0,
  archPeak: 0.5,
  archEdgeDeadzone: 0.01,
  endFlatLeft: 0.05,
  endFlatRight: 0.05,
}

/**
 * 영상에 맞춘 값 — 영상 프레임 13장(F44~F150)의 젤리 윗 테두리를 이 물리로 따라 그린 것과 비교해
 * (손잡이는 프레임마다 영상의 둥근 끝 위치에 맞춤) 오차가 가장 작은 조합을 골랐다(평균 24 → 13px).
 * 원본보다 줄이 20% 짧고 잘 늘어나서(0.015), 밀면 덜 솟고 고정점 가까이에서부터 일어서며,
 * 솟는 힘은 고정점 쪽 1/4 지점이 가장 세다 — 영상처럼 혹이 왼쪽 끝에 붙어 선다.
 */
export const VIDEO_ROPE: RopeParams = {
  ...TYPEGPU_ROPE,
  slack: 0.8,
  stretchStiffness: 0.015,
  bendingStrength: 0.2,
  archStrength: 4,
  archPeak: 0.25,
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1)
  return t * t * (3 - 2 * t)
}

/**
 * 젤리 줄 — `target`(손잡이 x)을 정하고 `update(dt)`를 부르면 점·법선·베지어 조절점이 갱신된다.
 * 값은 Float32Array에 담는다(예제가 f32 벡터로 계산해서, 같은 반올림을 따라간다).
 */
export class JellyRope {
  /** 점 위치 [x0, y0, x1, y1, …] */
  readonly pos = new Float32Array(N * 2)
  /** 점마다 줄에 수직인 단위 법선 */
  readonly normals = new Float32Array(N * 2)
  /** 구간(i → i+1)마다 이차 베지어 조절점 */
  readonly controls = new Float32Array((N - 1) * 2)
  readonly #prev = new Float32Array(N * 2)
  readonly #invMass = new Float32Array(N)
  readonly #p: RopeParams
  readonly #restLen: number
  #target = ROPE_MAX_X

  constructor(params: RopeParams = VIDEO_ROPE) {
    this.#p = params
    this.#restLen = (ROPE_LENGTH * params.slack) / (N - 1)
    this.reset()
  }

  /** 처음 모양 — 고정점에서 오른쪽 끝(100%)까지 곧게 */
  reset() {
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1)
      const x = ROPE_ANCHOR_X * (1 - t) + ROPE_MAX_X * t
      this.pos[i * 2] = this.#prev[i * 2] = x
      this.pos[i * 2 + 1] = this.#prev[i * 2 + 1] = ROPE_BASE_Y
      this.normals[i * 2] = 0
      this.normals[i * 2 + 1] = 1
      this.#invMass[i] = i === 0 || i === N - 1 ? 0 : 1
    }
    this.#target = ROPE_MAX_X
    this.#computeNormals()
    this.#computeControlPoints()
  }

  /** 다른 줄의 상태를 그대로 옮겨 온다(견본 정지 화면·되감기용) */
  copyFrom(other: JellyRope) {
    this.pos.set(other.pos)
    this.normals.set(other.normals)
    this.controls.set(other.controls)
    this.#prev.set(other.#prev)
    this.#target = other.#target
  }

  get target() {
    return this.#target
  }

  /** 손잡이를 둘 x — 고정점에서 줄 길이만큼까지만(예제의 setDragX) */
  set target(x: number) {
    this.#target = Math.min(Math.max(x, ROPE_ANCHOR_X - ROPE_LENGTH), ROPE_ANCHOR_X + ROPE_LENGTH)
  }

  /** 끝에서 두 번째 점 — 둥근 끝의 중심이고, 숫자(%)도 이 점의 x로 정한다 */
  get capX() {
    return this.pos[(N - 2) * 2]
  }

  /** 한 프레임 진행(dt초). 예제처럼 프레임마다 6번 나눠 적분하고 제약을 16번 맞춘다. */
  update(dt: number) {
    if (dt <= 0) return
    const h = dt / this.#p.substeps
    const compression = Math.max(0, 1 - Math.abs(this.#target - ROPE_ANCHOR_X) / ROPE_LENGTH)
    for (let s = 0; s < this.#p.substeps; s++) {
      this.#integrate(h, compression)
      this.#projectConstraints()
    }
    this.#computeNormals()
    this.#computeControlPoints()
  }

  /** 지난 프레임 대비 가장 많이 움직인 점의 거리 — 멈췄는지 볼 때 쓴다 */
  get motion() {
    let max = 0
    for (let i = 1; i < N - 1; i++) {
      const d = Math.hypot(this.pos[i * 2] - this.#prev[i * 2], this.pos[i * 2 + 1] - this.#prev[i * 2 + 1])
      if (d > max) max = d
    }
    return max
  }

  #pinEnds() {
    const p = this.pos
    p[0] = ROPE_ANCHOR_X
    p[1] = ROPE_BASE_Y
    p[(N - 1) * 2] = this.#target
    p[(N - 1) * 2 + 1] = ROPE_KNOB_Y
  }

  #integrate(h: number, compression: number) {
    const p = this.pos
    const prev = this.#prev
    const { damping, archStrength, archMin, archEdgeDeadzone: edge, archPeak } = this.#p
    const push = Math.max(compression, archMin)
    const damp = 1 - damping
    for (let i = 0; i < N; i++) {
      if (i === 0 || i === N - 1) {
        const x = i === 0 ? ROPE_ANCHOR_X : this.#target
        const y = i === 0 ? ROPE_BASE_Y : ROPE_KNOB_Y
        p[i * 2] = prev[i * 2] = x
        p[i * 2 + 1] = prev[i * 2 + 1] = y
        continue
      }
      const px = p[i * 2]
      const py = p[i * 2 + 1]
      const vx = (px - prev[i * 2]) * damp
      const vy = (py - prev[i * 2 + 1]) * damp

      // 눌린 만큼(compression) 가운데를 위로 미는 힘 — 양 끝은 0, 가운데가 가장 세다
      let ay = 0
      if (push > 0) {
        // archPeak가 0.5가 아니면 t를 휘어 봉우리를 옮긴다(0.5면 원본 그대로)
        const t0 = i / (N - 1)
        const t = archPeak === 0.5 ? t0 : t0 ** (Math.log(0.5) / Math.log(archPeak))
        const window = smoothstep(edge, 1 - edge, t) * smoothstep(edge, 1 - edge, 1 - t)
        ay = archStrength * Math.sin(Math.PI * t) * window * push
      }

      prev[i * 2] = px
      prev[i * 2 + 1] = py
      p[i * 2] = px + vx
      // 홈 바닥 아래로는 못 내려간다
      p[i * 2 + 1] = Math.max(py + vy + ay * h * h, ROPE_BASE_Y)
    }
  }

  #projectConstraints() {
    const { iterations, stretchStiffness, bendingStrength, bendingExponent, bendingSkew, endFlatLeft, endFlatRight } = this.#p
    const rest = this.#restLen
    for (let it = 0; it < iterations; it++) {
      // 이웃 점 사이 길이 유지
      for (let i = 0; i < N - 1; i++) this.#projectDistance(i, i + 1, rest, stretchStiffness)
      // 굽힘 저항 — 한 칸 건너 점 사이 길이, 양 끝으로 갈수록 세다(bendingSkew만큼 고정점 쪽은 무르게)
      for (let i = 1; i < N - 1; i++) {
        const t = i / (N - 1)
        const side = t < 0.5 ? 1 - bendingSkew : 1
        const strength = (Math.abs(t - 0.5) * 2) ** bendingExponent * side
        this.#projectDistance(i - 1, i + 1, 2 * rest, bendingStrength * (0.05 + 0.95 * strength))
      }
      // 양 끝 바로 옆 점은 바닥 쪽으로 살짝 당긴다(끝이 홈에 눕게)
      this.#projectLineY(1, endFlatLeft)
      this.#projectLineY(N - 2, endFlatRight)
      this.#pinEnds()
    }
  }

  #projectDistance(i: number, j: number, rest: number, k: number) {
    const p = this.pos
    const dx = p[j * 2] - p[i * 2]
    const dy = p[j * 2 + 1] - p[i * 2 + 1]
    const len = Math.hypot(dx, dy)
    if (len < 1e-8) return
    const w1 = this.#invMass[i]
    const w2 = this.#invMass[j]
    const wsum = w1 + w2
    if (wsum <= 0) return
    const diff = (len - rest) / len
    const c1 = (w1 / wsum) * k
    const c2 = (w2 / wsum) * k
    p[i * 2] += dx * diff * c1
    p[i * 2 + 1] += dy * diff * c1
    p[j * 2] -= dx * diff * c2
    p[j * 2 + 1] -= dy * diff * c2
  }

  #projectLineY(i: number, k: number) {
    if (k <= 0 || i <= 0 || i >= N - 1 || this.#invMass[i] <= 0) return
    const y = this.pos[i * 2 + 1]
    this.pos[i * 2 + 1] = y + (ROPE_BASE_Y - y) * Math.min(k, 1)
  }

  #computeNormals() {
    const p = this.pos
    const nrm = this.normals
    for (let i = 0; i < N; i++) {
      const a = i === 0 ? 0 : i === N - 1 ? N - 2 : i - 1
      const b = i === 0 ? 1 : i === N - 1 ? N - 1 : i + 1
      let dx = p[b * 2] - p[a * 2]
      let dy = p[b * 2 + 1] - p[a * 2 + 1]
      let len = Math.hypot(dx, dy)
      if (len < 1e-6) {
        if (i > 0) {
          dx = p[i * 2] - p[(i - 1) * 2]
          dy = p[i * 2 + 1] - p[(i - 1) * 2 + 1]
          len = Math.hypot(dx, dy)
        }
        if (len < 1e-6 && i < N - 1) {
          dx = p[(i + 1) * 2] - p[i * 2]
          dy = p[(i + 1) * 2 + 1] - p[i * 2 + 1]
          len = Math.hypot(dx, dy)
        }
        if (len < 1e-6) {
          nrm[i * 2] = i > 0 ? nrm[(i - 1) * 2] : 0
          nrm[i * 2 + 1] = i > 0 ? nrm[(i - 1) * 2 + 1] : 1
          continue
        }
      }
      nrm[i * 2] = -dy / len
      nrm[i * 2 + 1] = dx / len
    }
  }

  // 구간마다 양 끝 접선이 만나는 점을 조절점으로 — 점 17개를 매끈한 곡선으로 잇는다.
  #computeControlPoints() {
    const p = this.pos
    const nrm = this.normals
    const c = this.controls
    for (let i = 0; i < N - 1; i++) {
      const ax = p[i * 2]
      const ay = p[i * 2 + 1]
      const bx = p[(i + 1) * 2]
      const by = p[(i + 1) * 2 + 1]
      const midX = (ax + bx) * 0.5
      const midY = (ay + by) * 0.5
      const nax = nrm[i * 2]
      const nay = nrm[i * 2 + 1]
      const nbx = nrm[(i + 1) * 2]
      const nby = nrm[(i + 1) * 2 + 1]
      // 양 끝 구간·거의 나란한 구간은 가운데 점(폭주 방지)
      if (i === 0 || i === N - 2 || nax * nbx + nay * nby > 0.99) {
        c[i * 2] = midX
        c[i * 2 + 1] = midY
        continue
      }
      const tax = nay
      const tay = -nax
      const tbx = nby
      const tby = -nbx
      const denom = tax * tby - tay * tbx
      if (Math.abs(denom) <= 1e-6) {
        c[i * 2] = midX
        c[i * 2 + 1] = midY
        continue
      }
      const t = ((bx - ax) * tby - (by - ay) * tbx) / denom
      c[i * 2] = ax + t * tax
      c[i * 2 + 1] = ay + t * tay
    }
  }
}
