import { fibonacciSphere, sampleText } from './shapes'

// ────────────────────────────────────────────────────────────────────────
// 입자 인트로 — 샘플 영상(particle-animation.mp4)의 흐름을 그대로 따른다.
//   sphere  → 3D 구로 피어난다(천천히 회전)
//   scatter → 폭발해서 화면 전체로 흩어진다
//   form    → 비스듬히 돌아가 있던 글자가 정면 쪽으로 돌며 모인다(3D 등장)
//   move    → 카드 위 자리(slot)로 작아지며 옮겨 가고, 일부는 배경 먼지가 된다
//   idle    → 마우스 따라 살짝 돌고, 커서 근처 입자는 밀려났다 돌아온다
//
// 입자는 "카메라 좌표"(화면 가운데가 원점, z가 클수록 멀다)에서 움직이고, 그릴 때
// 원근 투영(FOCAL/(FOCAL+z))한다 — 가까운 입자는 크고 밝게, 먼 입자는 작고 흐리게.
// ────────────────────────────────────────────────────────────────────────

type Phase = 'sphere' | 'scatter' | 'form' | 'move' | 'idle'

interface Placement {
  x: number
  y: number
  scale: number
  yaw: number
  pitch: number
}

export interface ParticleFieldOptions {
  canvas: HTMLCanvasElement
  /** 인트로가 끝난 뒤 글자가 자리 잡을 상자(카드 위) — 매 프레임 위치를 읽어 따라간다. */
  slot: HTMLElement
  text: string
  reducedMotion: boolean
  /** 글자가 카드 위로 옮겨 가기 시작할 때(= 카드를 보여 줄 때) 한 번 부른다. */
  onSettle: () => void
}

// 카메라 초점거리(px) — 작을수록 원근이 세다. 샘플의 CODEXR처럼 왼쪽 글자가 확연히 큰 정도.
const FOCAL = 1000
// 60fps 기준 프레임당 속도 감쇠 — 작을수록 끈적하게 멈춘다.
const DAMPING = 0.85
// 커서가 밀어내는 반경 — 큰 글자(인트로)는 넓게, 카드 위 작은 글자는 글자 하나를 다 지우지 않게 좁게.
const REPEL_RADIUS = 90
const REPEL_RADIUS_SMALL = 56
const REPEL_FORCE = 5.5
// 인트로가 끝나면 이 비율의 입자는 글자를 떠나 배경을 떠도는 먼지가 된다.
const DUST_RATIO = 0.45
// 글자 기본 방향(라디안) — 왼쪽이 앞으로 나온 비스듬한 3D.
const BASE_YAW = -0.36
// 글자 두께(글자 폭 대비) — 돌렸을 때 옆면이 보여 입체감이 난다.
const TEXT_DEPTH = 0.07
// 등장 회전 시작 각도 — 옆으로 돌아가 있던 글자가 정면 쪽으로 돈다.
const ENTRY_YAW = 1.05
const ENTRY_PITCH = 0.32
const TIMING = { sphere: 900, scatter: 800, rotateIn: 1250, hold: 800, move: 950, replayScatter: 620 }

const FONT_FAMILY = '"Pretendard Variable", Pretendard, "Arial Black", sans-serif'
const FONT = `900 200px ${FONT_FAMILY}`

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export class ParticleField {
  private readonly canvas: HTMLCanvasElement
  private readonly slot: HTMLElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly opts: ParticleFieldOptions

  private width = 0
  private height = 0
  private dpr = 1
  private count = 0

  // 입자마다 xyz — 타입 배열로 둬서 수천 개도 가볍게.
  private pos: Float32Array = new Float32Array(0)
  private vel: Float32Array = new Float32Array(0)
  private sphere: Float32Array = new Float32Array(0)
  private scatter: Float32Array = new Float32Array(0)
  private text: Float32Array | null = null
  // 글자 높이(폭 = 1 기준) — 샘플링 뒤 실제 값으로 바뀐다.
  private textHeight = 0.35
  private stiffness: Float32Array = new Float32Array(0)
  private size: Float32Array = new Float32Array(0)
  private alpha: Float32Array = new Float32Array(0)
  private dust: Uint8Array = new Uint8Array(0)

  private phase: Phase = 'sphere'
  private phaseStart = 0
  private formFrom: 'big' | 'slot' = 'big'
  private replaying = false
  private dustActive = false
  private settled = false
  private pendingMove = false
  private destroyed = false
  private raf = 0
  private last = 0

  private pointer: { x: number; y: number } | null = null
  private look = { yaw: 0, pitch: 0 }
  private lookTarget = { yaw: 0, pitch: 0 }

  constructor(opts: ParticleFieldOptions) {
    this.opts = opts
    this.canvas = opts.canvas
    this.slot = opts.slot
    const ctx = opts.canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d를 쓸 수 없어요')
    this.ctx = ctx
  }

  start(): void {
    this.resize()
    this.allocate()
    window.addEventListener('resize', this.onResize)
    void this.loadText()

    if (this.opts.reducedMotion) {
      // 동작 줄이기 — 인트로 없이 글자만 정지 화면으로 그린다(창 크기·스크롤이 바뀔 때만 다시).
      window.addEventListener('scroll', this.drawStatic, { passive: true })
      return
    }
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerEnd)
    window.addEventListener('pointercancel', this.onPointerEnd)
    document.documentElement.addEventListener('pointerleave', this.onPointerEnd)

    this.phase = 'sphere'
    this.phaseStart = performance.now()
    this.last = this.phaseStart
    this.raf = requestAnimationFrame(this.frame)
  }

  /** 인트로 건너뛰기 — 지금 있는 자리에서 바로 카드 위 글자로 모인다. */
  skip(): void {
    if (this.settled || this.opts.reducedMotion) return
    if (this.text) this.enterMove(performance.now())
    else this.pendingMove = true
  }

  /** 카드 위 글자를 다시 흩었다 모은다(로고를 눌렀을 때). */
  replay(): void {
    if (this.phase !== 'idle' || this.opts.reducedMotion) return
    const now = performance.now()
    const p = this.placement(now)
    for (let i = 0; i < this.count; i++) {
      if (this.dust[i]) continue
      const o = i * 3
      const dx = this.pos[o] - p.x
      const dy = this.pos[o + 1] - p.y
      const len = Math.hypot(dx, dy) || 1
      const kick = rand(4, 11)
      this.vel[o] += (dx / len) * kick
      this.vel[o + 1] += (dy / len) * kick
      this.vel[o + 2] += rand(-6, 6)
    }
    this.replaying = true
    this.setPhase('scatter', now)
  }

  destroy(): void {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('scroll', this.drawStatic)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerEnd)
    window.removeEventListener('pointercancel', this.onPointerEnd)
    document.documentElement.removeEventListener('pointerleave', this.onPointerEnd)
  }

  // ── 준비 ──────────────────────────────────────────────────────────────

  private allocate(): void {
    // 화면이 넓을수록 많이 — 1440×900에서 약 5,400개(샘플처럼 글자 속이 촘촘하게 차는 정도).
    this.count = Math.round(Math.min(6500, Math.max(2200, (this.width * this.height) / 240)))
    const n = this.count
    this.pos = new Float32Array(n * 3)
    this.vel = new Float32Array(n * 3)
    this.sphere = fibonacciSphere(n)
    this.scatter = new Float32Array(n * 3)
    this.stiffness = new Float32Array(n)
    this.size = new Float32Array(n)
    this.alpha = new Float32Array(n)
    this.dust = new Uint8Array(n)
    this.fillScatter()

    const radius = this.sphereRadius()
    for (let i = 0; i < n; i++) {
      const o = i * 3
      // 구 안쪽 작은 핵에서 시작해 표면으로 피어난다.
      const start = rand(0.08, 0.3) * radius
      this.pos[o] = this.sphere[o] * start
      this.pos[o + 1] = this.sphere[o + 1] * start - this.height * 0.03
      this.pos[o + 2] = this.sphere[o + 2] * start
      this.stiffness[i] = rand(0.024, 0.062)
      this.size[i] = rand(1, 2.3)
      this.dust[i] = Math.random() < DUST_RATIO ? 1 : 0
    }
  }

  /** 흩어질 자리 — 화면 전체 + 깊이(먼 쪽을 더 넓게 둬서 별밭처럼). */
  private fillScatter(): void {
    for (let i = 0; i < this.count; i++) {
      const o = i * 3
      this.scatter[o] = rand(-0.56, 0.56) * this.width
      this.scatter[o + 1] = rand(-0.56, 0.56) * this.height
      this.scatter[o + 2] = rand(-300, 900)
    }
  }

  private async loadText(): Promise<void> {
    // 글꼴이 늦게 오면 기본 글꼴로라도 — 1.5초 넘게 기다리지 않는다.
    try {
      await Promise.race([document.fonts.load(FONT), wait(1500)])
    } catch {
      /* 글꼴 로딩 실패 — 대체 글꼴로 그린다 */
    }
    if (this.destroyed) return
    const shape = sampleText(this.opts.text, FONT, this.count, TEXT_DEPTH)
    this.text = shape.points
    this.textHeight = Math.max(0.1, shape.height)
    if (this.opts.reducedMotion) {
      this.settled = true
      this.phase = 'idle'
      this.opts.onSettle()
      this.drawStatic()
    } else if (this.pendingMove) {
      this.enterMove(performance.now())
    }
  }

  private resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = Math.round(this.width * this.dpr)
    this.canvas.height = Math.round(this.height * this.dpr)
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  private onResize = (): void => {
    this.resize()
    this.fillScatter()
    if (this.opts.reducedMotion) this.drawStatic()
  }

  private onPointerMove = (e: PointerEvent): void => {
    this.pointer = { x: e.clientX, y: e.clientY }
    this.lookTarget.yaw = ((e.clientX / this.width) * 2 - 1) * 0.16
    this.lookTarget.pitch = ((e.clientY / this.height) * 2 - 1) * -0.1
  }

  private onPointerEnd = (e: PointerEvent): void => {
    // 마우스는 화면을 벗어날 때만, 터치는 손을 뗄 때 커서를 지운다.
    if (e.type === 'pointerleave' || e.pointerType !== 'mouse') {
      this.pointer = null
      this.lookTarget.yaw = 0
      this.lookTarget.pitch = 0
    }
  }

  // ── 단계 ──────────────────────────────────────────────────────────────

  private setPhase(phase: Phase, now: number): void {
    this.phase = phase
    this.phaseStart = now
  }

  private enterScatter(now: number): void {
    // 구 가운데에서 바깥으로 터진다.
    for (let i = 0; i < this.count; i++) {
      const o = i * 3
      const x = this.pos[o]
      const y = this.pos[o + 1] + this.height * 0.03
      const z = this.pos[o + 2]
      const len = Math.hypot(x, y, z) || 1
      const kick = rand(6, 16)
      this.vel[o] += (x / len) * kick
      this.vel[o + 1] += (y / len) * kick
      this.vel[o + 2] += (z / len) * kick
    }
    this.setPhase('scatter', now)
  }

  private enterMove(now: number): void {
    this.pendingMove = false
    this.dustActive = true
    this.setPhase('move', now)
    if (!this.settled) {
      this.settled = true
      this.opts.onSettle()
    }
  }

  private advance(now: number): void {
    const t = now - this.phaseStart
    switch (this.phase) {
      case 'sphere':
        if (t > TIMING.sphere) this.enterScatter(now)
        break
      case 'scatter':
        if (!this.text) break // 글꼴이 아직이면 흩어진 채로 조금 더 기다린다
        if (this.replaying && t > TIMING.replayScatter) {
          this.formFrom = 'slot'
          this.setPhase('form', now)
        } else if (!this.replaying && t > TIMING.scatter) {
          this.formFrom = 'big'
          this.setPhase('form', now)
        }
        break
      case 'form':
        if (this.formFrom === 'big' && t > TIMING.rotateIn + TIMING.hold) this.enterMove(now)
        else if (this.formFrom === 'slot' && t > TIMING.rotateIn) {
          this.replaying = false
          this.setPhase('idle', now)
        }
        break
      case 'move':
        if (t > TIMING.move) this.setPhase('idle', now)
        break
      case 'idle':
        break
    }
  }

  // ── 글자 놓을 자리(가운데·크기·회전) ───────────────────────────────────────

  private sphereRadius(): number {
    return Math.min(this.width, this.height) * 0.22
  }

  private bigPlacement(): Placement {
    return {
      x: 0,
      y: -this.height * 0.03,
      scale: Math.min(this.width * 0.64, 880, (this.height * 0.42) / this.textHeight),
      yaw: BASE_YAW + this.look.yaw,
      pitch: 0.05 + this.look.pitch,
    }
  }

  private slotPlacement(now: number): Placement {
    const r = this.slot.getBoundingClientRect()
    // 가만히 있어도 숨 쉬듯 살짝 흔들린다.
    const sway = Math.sin(now * 0.0006) * 0.06
    return {
      x: r.left + r.width / 2 - this.width / 2,
      y: r.top + r.height / 2 - this.height / 2,
      // 상자 폭과 높이 둘 다에 들어가게 — 좁은 화면에서 글자가 카드에 닿지 않도록.
      scale: Math.min(r.width, (r.height * 0.92) / this.textHeight),
      yaw: BASE_YAW * 0.6 + sway + this.look.yaw * 0.7,
      pitch: 0.04 + this.look.pitch * 0.7,
    }
  }

  private placement(now: number): Placement {
    const t = now - this.phaseStart
    if (this.phase === 'form') {
      const p = easeOutCubic(clamp01(t / TIMING.rotateIn))
      const base = this.formFrom === 'big' ? this.bigPlacement() : this.slotPlacement(now)
      return {
        ...base,
        scale: base.scale * lerp(0.72, 1, p),
        yaw: lerp(ENTRY_YAW, base.yaw, p),
        pitch: lerp(ENTRY_PITCH, base.pitch, p),
      }
    }
    if (this.phase === 'move') {
      const p = easeInOutCubic(clamp01(t / TIMING.move))
      const a = this.bigPlacement()
      const b = this.slotPlacement(now)
      return {
        x: lerp(a.x, b.x, p),
        y: lerp(a.y, b.y, p),
        scale: lerp(a.scale, b.scale, p),
        yaw: lerp(a.yaw, b.yaw, p),
        pitch: lerp(a.pitch, b.pitch, p),
      }
    }
    return this.slotPlacement(now)
  }

  // ── 매 프레임 ──────────────────────────────────────────────────────────

  private frame = (now: number): void => {
    if (this.destroyed) return
    const f = Math.min(3, (now - this.last) / 16.667) // 60fps 기준 배수(탭 전환 뒤 튀지 않게 상한)
    this.last = now
    this.advance(now)

    this.look.yaw += (this.lookTarget.yaw - this.look.yaw) * 0.06 * f
    this.look.pitch += (this.lookTarget.pitch - this.look.pitch) * 0.06 * f

    const t = now - this.phaseStart
    const phase = this.phase
    const text = this.text
    const usesText = text !== null && (phase === 'form' || phase === 'move' || phase === 'idle' || (phase === 'scatter' && this.replaying))
    const place = usesText ? this.placement(now) : null
    // 작은 글자일수록 입자도 작게 — 큰 글자 그대로면 뭉개진다.
    const textSize = place ? Math.min(1.1, Math.max(0.68, place.scale / 900)) : 1

    const sphereYaw = now * 0.0007
    const sphereR = this.sphereRadius()
    const sphereY = -this.height * 0.03
    const sphereFade = phase === 'sphere' ? clamp01(t / 500) : 1
    const cyS = Math.cos(sphereYaw)
    const syS = Math.sin(sphereYaw)
    const cpS = Math.cos(0.4)
    const spS = Math.sin(0.4)

    const cy = place ? Math.cos(place.yaw) : 1
    const sy = place ? Math.sin(place.yaw) : 0
    const cp = place ? Math.cos(place.pitch) : 1
    const sp = place ? Math.sin(place.pitch) : 0

    const damp = DAMPING ** f
    const pointer = this.pointer
    const repel = pointer !== null && phase !== 'sphere'
    const radius = this.settled ? REPEL_RADIUS_SMALL : REPEL_RADIUS
    const r2 = radius * radius
    const halfW = this.width / 2
    const halfH = this.height / 2

    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)
    // 겹칠수록 밝아진다 — 샘플처럼 촘촘한 가장자리·이음매가 빛나 보인다.
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = '#fff'

    for (let i = 0; i < this.count; i++) {
      const o = i * 3
      const isDust = this.dustActive && this.dust[i] === 1
      let tx: number
      let ty: number
      let tz: number
      let k: number
      let targetAlpha: number

      if (phase === 'sphere') {
        const mx = this.sphere[o] * sphereR
        const my = this.sphere[o + 1] * sphereR
        const mz = this.sphere[o + 2] * sphereR
        const x1 = mx * cyS + mz * syS
        const z1 = -mx * syS + mz * cyS
        tx = x1
        ty = my * cpS - z1 * spS + sphereY
        tz = my * spS + z1 * cpS
        k = 0.11
        targetAlpha = 0.85 * sphereFade
      } else if (isDust || (phase === 'scatter' && !this.replaying) || !place || !text) {
        // 흩어진 자리 — 먼지는 그 근처를 천천히 떠돈다.
        tx = this.scatter[o]
        ty = this.scatter[o + 1]
        tz = this.scatter[o + 2]
        if (isDust) {
          tx += Math.sin(now * 0.00023 + i) * 26
          ty += Math.cos(now * 0.00019 + i * 1.3) * 20
        }
        k = isDust ? 0.006 : 0.008
        targetAlpha = isDust ? 0.3 : 0.75
      } else if (phase === 'scatter') {
        // 다시 모으기(replay) 중 흩어짐 — 글자 입자만, 글자 근처 넓게.
        tx = this.scatter[o] * 0.5 + place.x * 0.5
        ty = this.scatter[o + 1] * 0.5 + place.y * 0.5
        tz = this.scatter[o + 2] * 0.5
        k = 0.01
        targetAlpha = 0.8
      } else {
        // 글자 — 모델 좌표를 돌리고(yaw→pitch) 키운 뒤 자리로 옮긴다.
        const mx = text[o] * place.scale
        const my = text[o + 1] * place.scale
        const mz = text[o + 2] * place.scale
        const x1 = mx * cy + mz * sy
        const z1 = -mx * sy + mz * cy
        tx = place.x + x1
        ty = place.y + my * cp - z1 * sp
        tz = my * sp + z1 * cp
        k = this.stiffness[i]
        targetAlpha = 0.92
      }

      // 스프링 + 감쇠
      let vx = (this.vel[o] + (tx - this.pos[o]) * k * f) * damp
      let vy = (this.vel[o + 1] + (ty - this.pos[o + 1]) * k * f) * damp
      const vz = (this.vel[o + 2] + (tz - this.pos[o + 2]) * k * f) * damp

      let x = this.pos[o]
      let y = this.pos[o + 1]
      const z = this.pos[o + 2]
      let s = FOCAL / (FOCAL + z)

      // 커서 근처는 밀어낸다(화면 거리 기준) — 스프링이 다시 끌어와서 구멍이 메워진다.
      if (repel) {
        const dx = halfW + x * s - pointer.x
        const dy = halfH + y * s - pointer.y
        const d2 = dx * dx + dy * dy
        if (d2 < r2 && d2 > 0.01) {
          const d = Math.sqrt(d2)
          const push = (1 - d / radius) ** 2 * REPEL_FORCE * f
          vx += ((dx / d) * push) / s
          vy += ((dy / d) * push) / s
        }
      }

      x += vx * f
      y += vy * f
      const nz = z + vz * f
      this.vel[o] = vx
      this.vel[o + 1] = vy
      this.vel[o + 2] = vz
      this.pos[o] = x
      this.pos[o + 1] = y
      this.pos[o + 2] = nz

      this.alpha[i] += (targetAlpha - this.alpha[i]) * Math.min(1, 0.08 * f)
      if (FOCAL + nz < 60) continue
      s = FOCAL / (FOCAL + nz)
      const depthFade = 1 - clamp01((nz + 300) / 1500) * 0.65
      const a = this.alpha[i] * depthFade
      if (a < 0.02) continue
      const r = Math.max(0.7, this.size[i] * s * (isDust ? 0.9 : textSize))
      ctx.globalAlpha = Math.min(1, a)
      ctx.fillRect(halfW + x * s - r / 2, halfH + y * s - r / 2, r, r)
    }
    ctx.globalAlpha = 1
    this.raf = requestAnimationFrame(this.frame)
  }

  /** 동작 줄이기용 — 글자를 제자리에 바로 그린다. */
  private drawStatic = (): void => {
    const text = this.text
    if (!text || this.destroyed) return
    const place = this.slotPlacement(0)
    const ctx = this.ctx
    const halfW = this.width / 2
    const halfH = this.height / 2
    const cy = Math.cos(place.yaw)
    const sy = Math.sin(place.yaw)
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = '#fff'
    ctx.globalAlpha = 0.85
    for (let i = 0; i < this.count; i++) {
      if (this.dust[i]) continue
      const o = i * 3
      const mx = text[o] * place.scale
      const mz = text[o + 2] * place.scale
      const z = -mx * sy + mz * cy
      const s = FOCAL / (FOCAL + z)
      const x = place.x + mx * cy + mz * sy
      const y = place.y + text[o + 1] * place.scale
      const r = Math.max(0.7, this.size[i] * s * 0.75)
      ctx.fillRect(halfW + x * s - r / 2, halfH + y * s - r / 2, r, r)
    }
    ctx.globalAlpha = 1
  }
}
