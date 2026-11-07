import { BlendMode, Skia, type SkPicture } from '@shopify/react-native-skia';
import { mixHex } from '../theme';
import { sampleImage, sampleText, sampleXMark, type TextShape } from './shapes';

// ────────────────────────────────────────────────────────────────────────
// 입자 인트로 — 웹(components/login/particles/particle-field.ts)을 그대로 옮겼다. 다른 것:
// - 캔버스 2D 대신 매 프레임 Skia 그림(SkPicture)을 만들어 onFrame으로 넘긴다.
// - 마우스 대신 손가락(누르고 끄는 동안)이 입자를 밀어내고 글자를 살짝 돌린다.
// - 자리(slot)는 DOM 상자 대신 화면 좌표 상자를 함수로 받는다.
//
//   mark    → xTool의 X가 강조색 입자로 피어나 두께를 드러내며 3D로 돈다
//   scatter → 폭발해서 화면 전체로 흩어진다
//   form    → 비스듬히 돌아가 있던 글자가 정면 쪽으로 돌며 모인다(3D 등장)
//   move    → 카드 위 자리(slot)로 작아지며 옮겨 가고, 일부는 배경 먼지가 된다
//   idle    → 숨 쉬듯 흔들리고, 손가락 근처 입자는 밀려났다 돌아온다
// ────────────────────────────────────────────────────────────────────────

// RN이 전역에 두는 고해상도 시계(타입 선언에는 없다) — requestAnimationFrame이 넘기는 시각과 같은 기준.
declare const performance: { now(): number };

type Phase = 'mark' | 'scatter' | 'form' | 'move' | 'idle';

interface Placement {
  x: number;
  y: number;
  scale: number;
  yaw: number;
  pitch: number;
}

export interface SlotRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ParticleFieldOptions {
  width: number;
  height: number;
  /** 인트로가 끝난 뒤 글자가 자리 잡을 상자(카드 위, 화면 좌표) — 매 프레임 읽어 따라간다. */
  slot: () => SlotRect | null;
  /** 입자가 모일 로고 이미지(require한 투명 배경 PNG) — 녹색 픽셀은 강조색 입자가 된다. */
  logo: number;
  /** 이미지를 못 불러올 때 대신 글꼴로 쓸 글자 */
  fallbackText: string;
  /** 로고 아래 작은 부제(입자) */
  subtitle?: string;
  accentColor: string;
  reducedMotion: boolean;
  /** 글자가 카드 위로 옮겨 가기 시작할 때(= 카드를 보여 줄 때) 한 번 부른다. */
  onSettle: () => void;
  /** 새로 그린 그림 */
  onFrame: (picture: SkPicture) => void;
}

// 카메라 초점거리(px) — 작을수록 원근이 세다.
const FOCAL = 1000;
// 60fps 기준 프레임당 속도 감쇠 — 작을수록 끈적하게 멈춘다.
const DAMPING = 0.85;
// 손가락이 밀어내는 반경 — 큰 글자(인트로)는 넓게, 카드 위 작은 글자는 좁게.
const REPEL_RADIUS = 90;
const REPEL_RADIUS_SMALL = 56;
const REPEL_FORCE = 5.5;
// 인트로가 끝나면 이 비율의 입자는 글자를 떠나 배경을 떠도는 먼지가 된다.
const DUST_RATIO = 0.45;
const BASE_YAW = -0.36;
const TEXT_DEPTH = 0.07;
const LOGO_DEPTH = 0.035;
const ENTRY_YAW = 1.05;
const ENTRY_PITCH = 0.32;
const TIMING = { mark: 1500, scatter: 800, rotateIn: 1250, hold: 800, move: 950, replayScatter: 620 };
const MARK_DEPTH = 0.16;
const MARK_YAW_FROM = -1.25;
const MARK_YAW_TO = 0.4;
const MARK_PITCH = 0.18;

const FONT = { size: 200, weight: '900' } as const;
// 부제 — 카드 위에서는 글자 높이가 15~18px 정도라 너무 굵으면 획 사이 틈이 메워져 뭉개진다.
const SUBTITLE_FONT = { size: 120, weight: '700' } as const;
const SUBTITLE_TRACKING = 0.3;
const SUBTITLE_WIDTH = 0.6;
const SUBTITLE_GAP = 0.05;
const SUBTITLE_SHARE = 0.28;
const SUBTITLE_PARTICLE = 0.72;
// 그리기 묶음 — 불투명도 단계 수와, 겹친 곳이 밝아지게 나누는 층 수(drawParticles).
const ALPHA_LEVELS = 12;
const LAYERS = 2;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

export class ParticleField {
  private readonly opts: ParticleFieldOptions;
  private readonly width: number;
  private readonly height: number;
  private readonly whitePaint = Skia.Paint();
  private readonly accentPaint = Skia.Paint();

  private count = 0;
  private pos: Float32Array = new Float32Array(0);
  private vel: Float32Array = new Float32Array(0);
  private mark: Float32Array = new Float32Array(0);
  private scatter: Float32Array = new Float32Array(0);
  private text: Float32Array | null = null;
  private textHeight = 0.35;
  private stiffness: Float32Array = new Float32Array(0);
  private size: Float32Array = new Float32Array(0);
  private alpha: Float32Array = new Float32Array(0);
  private dust: Uint8Array = new Uint8Array(0);
  private tint: Uint8Array = new Uint8Array(0);
  private mix: Float32Array = new Float32Array(0);
  private screenX: Float32Array = new Float32Array(0);
  private screenY: Float32Array = new Float32Array(0);
  private screenR: Float32Array = new Float32Array(0);
  private screenA: Float32Array = new Float32Array(0);

  private phase: Phase = 'mark';
  private phaseStart = 0;
  private formFrom: 'big' | 'slot' = 'big';
  private replaying = false;
  private dustActive = false;
  private settled = false;
  private pendingMove = false;
  private destroyed = false;
  private raf = 0;
  private last = 0;

  private pointer: { x: number; y: number } | null = null;
  private look = { yaw: 0, pitch: 0 };
  private lookTarget = { yaw: 0, pitch: 0 };

  constructor(opts: ParticleFieldOptions) {
    this.opts = opts;
    this.width = opts.width;
    this.height = opts.height;
    // 겹칠수록 밝아진다(웹 'lighter') — 촘촘한 가장자리·이음매가 빛나 보인다.
    this.whitePaint.setColor(Skia.Color('#ffffff'));
    this.whitePaint.setBlendMode(BlendMode.Plus);
    // 강조색 입자 — 강조색보다 한 톤 밝게: 어두운 배경에서 겹쳐 빛날 때 같은 색으로 읽힌다.
    this.accentPaint.setColor(Skia.Color(mixHex(opts.accentColor, '#ffffff', 0.12)));
    this.accentPaint.setBlendMode(BlendMode.Plus);
  }

  start(): void {
    this.allocate();
    void this.loadShape();
    if (this.opts.reducedMotion) return;
    this.phase = 'mark';
    this.phaseStart = performance.now();
    this.last = this.phaseStart;
    this.raf = requestAnimationFrame(this.frame);
  }

  /** 인트로 건너뛰기 — 지금 있는 자리에서 바로 카드 위 글자로 모인다. */
  skip(): void {
    if (this.settled || this.opts.reducedMotion) return;
    if (this.text) this.enterMove(performance.now());
    else this.pendingMove = true;
  }

  /** 카드 위 글자를 다시 흩었다 모은다(로고를 눌렀을 때). */
  replay(): void {
    if (this.phase !== 'idle' || this.opts.reducedMotion) return;
    const now = performance.now();
    const p = this.placement(now);
    for (let i = 0; i < this.count; i++) {
      if (this.dust[i]) continue;
      const o = i * 3;
      const dx = this.pos[o] - p.x;
      const dy = this.pos[o + 1] - p.y;
      const len = Math.hypot(dx, dy) || 1;
      const kick = rand(4, 11);
      this.vel[o] += (dx / len) * kick;
      this.vel[o + 1] += (dy / len) * kick;
      this.vel[o + 2] += rand(-6, 6);
    }
    this.replaying = true;
    this.setPhase('scatter', now);
  }

  /** 손가락 위치(화면 좌표) — null이면 손을 뗐다. */
  setPointer(point: { x: number; y: number } | null): void {
    this.pointer = point;
    if (!point) {
      this.lookTarget.yaw = 0;
      this.lookTarget.pitch = 0;
      return;
    }
    this.lookTarget.yaw = ((point.x / this.width) * 2 - 1) * 0.16;
    this.lookTarget.pitch = ((point.y / this.height) * 2 - 1) * -0.1;
  }

  /** 동작 줄이기에서 자리(slot)가 정해지거나 바뀌면 정지 화면을 다시 그린다. */
  redrawStatic(): void {
    if (this.opts.reducedMotion) this.drawStatic();
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
  }

  // ── 준비 ──────────────────────────────────────────────────────────────

  private allocate(): void {
    // 화면이 넓을수록 많이 — 폰(393×852)은 하한인 2,200개.
    this.count = Math.round(Math.min(6500, Math.max(2200, (this.width * this.height) / 240)));
    const n = this.count;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.mark = sampleXMark(n, MARK_DEPTH);
    this.scatter = new Float32Array(n * 3);
    this.stiffness = new Float32Array(n);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.dust = new Uint8Array(n);
    this.tint = new Uint8Array(n);
    this.mix = new Float32Array(n);
    this.screenX = new Float32Array(n);
    this.screenY = new Float32Array(n);
    this.screenR = new Float32Array(n);
    this.screenA = new Float32Array(n);
    this.fillScatter();

    const markScale = this.markScale();
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      // X 가운데 작은 핵에서 시작해 제 모양으로 피어난다.
      const start = rand(0.05, 0.25) * markScale;
      this.pos[o] = this.mark[o] * start;
      this.pos[o + 1] = this.mark[o + 1] * start - this.height * 0.03;
      this.pos[o + 2] = this.mark[o + 2] * start;
      this.stiffness[i] = rand(0.024, 0.062);
      this.size[i] = rand(1, 2.3);
      this.dust[i] = Math.random() < DUST_RATIO ? 1 : 0;
    }
  }

  /** 흩어질 자리 — 화면 전체 + 깊이(먼 쪽을 더 넓게 둬서 별밭처럼). */
  private fillScatter(): void {
    for (let i = 0; i < this.count; i++) {
      const o = i * 3;
      this.scatter[o] = rand(-0.56, 0.56) * this.width;
      this.scatter[o + 1] = rand(-0.56, 0.56) * this.height;
      this.scatter[o + 2] = rand(-300, 900);
    }
  }

  private async loadShape(): Promise<void> {
    const subtitle = this.opts.subtitle?.trim() ?? '';
    const logoCount = subtitle ? Math.round(this.count * (1 - SUBTITLE_SHARE)) : this.count;

    let logo: TextShape;
    try {
      logo = await sampleImage(this.opts.logo, logoCount, LOGO_DEPTH);
    } catch {
      logo = sampleText(this.opts.fallbackText, FONT, logoCount, TEXT_DEPTH);
    }
    let shape = logo;
    if (subtitle) {
      const sub = sampleText(subtitle, SUBTITLE_FONT, this.count - logoCount, LOGO_DEPTH, SUBTITLE_TRACKING);
      shape = stackShapes(logo, sub, SUBTITLE_WIDTH, SUBTITLE_GAP);
      // 부제 입자는 먼지로 빠지지 않게(작은 글자라 입자가 줄면 바로 안 읽힌다), 크기는 작게.
      this.dust.fill(0, logoCount);
      for (let i = logoCount; i < this.count; i++) this.size[i] *= SUBTITLE_PARTICLE;
    }
    if (this.destroyed) return;
    this.text = shape.points;
    this.textHeight = Math.max(0.05, shape.height);
    if (shape.accent) this.tint = shape.accent;
    if (this.opts.reducedMotion) {
      this.settled = true;
      this.phase = 'idle';
      this.opts.onSettle();
      this.drawStatic();
    } else if (this.pendingMove) {
      this.enterMove(performance.now());
    }
  }

  // ── 단계 ──────────────────────────────────────────────────────────────

  private setPhase(phase: Phase, now: number): void {
    this.phase = phase;
    this.phaseStart = now;
  }

  private enterScatter(now: number): void {
    for (let i = 0; i < this.count; i++) {
      const o = i * 3;
      const x = this.pos[o];
      const y = this.pos[o + 1] + this.height * 0.03;
      const z = this.pos[o + 2];
      const len = Math.hypot(x, y, z) || 1;
      const kick = rand(6, 16);
      this.vel[o] += (x / len) * kick;
      this.vel[o + 1] += (y / len) * kick;
      this.vel[o + 2] += (z / len) * kick;
    }
    this.setPhase('scatter', now);
  }

  private enterMove(now: number): void {
    this.pendingMove = false;
    this.dustActive = true;
    this.setPhase('move', now);
    if (!this.settled) {
      this.settled = true;
      this.opts.onSettle();
    }
  }

  private advance(now: number): void {
    const t = now - this.phaseStart;
    switch (this.phase) {
      case 'mark':
        if (t > TIMING.mark) this.enterScatter(now);
        break;
      case 'scatter':
        if (!this.text) break; // 모양을 아직 못 뽑았으면 흩어진 채로 조금 더 기다린다
        if (this.replaying && t > TIMING.replayScatter) {
          this.formFrom = 'slot';
          this.setPhase('form', now);
        } else if (!this.replaying && t > TIMING.scatter) {
          this.formFrom = 'big';
          this.setPhase('form', now);
        }
        break;
      case 'form':
        if (this.formFrom === 'big' && t > TIMING.rotateIn + TIMING.hold) this.enterMove(now);
        else if (this.formFrom === 'slot' && t > TIMING.rotateIn) {
          this.replaying = false;
          this.setPhase('idle', now);
        }
        break;
      case 'move':
        if (t > TIMING.move) this.setPhase('idle', now);
        break;
      case 'idle':
        break;
    }
  }

  // ── 글자 놓을 자리(가운데·크기·회전) ───────────────────────────────────────

  private markScale(): number {
    return Math.min(this.width, this.height) * 0.44;
  }

  private bigPlacement(): Placement {
    return {
      x: 0,
      y: -this.height * 0.03,
      scale: Math.min(this.width * 0.64, 880, (this.height * 0.42) / this.textHeight),
      yaw: BASE_YAW + this.look.yaw,
      pitch: 0.05 + this.look.pitch,
    };
  }

  private slotPlacement(now: number): Placement {
    const r = this.opts.slot() ?? { x: 0, y: 0, width: this.width, height: 108 };
    // 가만히 있어도 숨 쉬듯 살짝 흔들린다.
    const sway = Math.sin(now * 0.0006) * 0.06;
    return {
      x: r.x + r.width / 2 - this.width / 2,
      y: r.y + r.height / 2 - this.height / 2,
      scale: Math.min(r.width, (r.height * 0.92) / this.textHeight),
      yaw: BASE_YAW * 0.6 + sway + this.look.yaw * 0.7,
      pitch: 0.04 + this.look.pitch * 0.7,
    };
  }

  private placement(now: number): Placement {
    const t = now - this.phaseStart;
    if (this.phase === 'form') {
      const p = easeOutCubic(clamp01(t / TIMING.rotateIn));
      const base = this.formFrom === 'big' ? this.bigPlacement() : this.slotPlacement(now);
      return {
        ...base,
        scale: base.scale * lerp(0.72, 1, p),
        yaw: lerp(ENTRY_YAW, base.yaw, p),
        pitch: lerp(ENTRY_PITCH, base.pitch, p),
      };
    }
    if (this.phase === 'move') {
      const p = easeInOutCubic(clamp01(t / TIMING.move));
      const a = this.bigPlacement();
      const b = this.slotPlacement(now);
      return {
        x: lerp(a.x, b.x, p),
        y: lerp(a.y, b.y, p),
        scale: lerp(a.scale, b.scale, p),
        yaw: lerp(a.yaw, b.yaw, p),
        pitch: lerp(a.pitch, b.pitch, p),
      };
    }
    return this.slotPlacement(now);
  }

  // ── 매 프레임 ──────────────────────────────────────────────────────────

  private frame = (now: number): void => {
    if (this.destroyed) return;
    const f = Math.min(3, (now - this.last) / 16.667); // 60fps 기준 배수(앱 전환 뒤 튀지 않게 상한)
    this.last = now;
    this.advance(now);

    this.look.yaw += (this.lookTarget.yaw - this.look.yaw) * 0.06 * f;
    this.look.pitch += (this.lookTarget.pitch - this.look.pitch) * 0.06 * f;

    const t = now - this.phaseStart;
    const phase = this.phase;
    const text = this.text;
    const usesText =
      text !== null &&
      (phase === 'form' || phase === 'move' || phase === 'idle' || (phase === 'scatter' && this.replaying));
    const place = usesText ? this.placement(now) : null;
    // 작은 글자일수록 입자도 작게 — 큰 글자 그대로면 뭉개진다.
    const textSize = place ? Math.min(1.1, Math.max(0.68, place.scale / 900)) : 1;

    const markYaw = lerp(MARK_YAW_FROM, MARK_YAW_TO, easeInOutCubic(clamp01(t / TIMING.mark)));
    const markScale = this.markScale();
    const markY = -this.height * 0.03;
    const markFade = phase === 'mark' ? clamp01(t / 400) : 1;
    const cyM = Math.cos(markYaw);
    const syM = Math.sin(markYaw);
    const cpM = Math.cos(MARK_PITCH);
    const spM = Math.sin(MARK_PITCH);

    const cy = place ? Math.cos(place.yaw) : 1;
    const sy = place ? Math.sin(place.yaw) : 0;
    const cp = place ? Math.cos(place.pitch) : 1;
    const sp = place ? Math.sin(place.pitch) : 0;

    const damp = DAMPING ** f;
    const pointer = this.pointer;
    const repel = pointer !== null && phase !== 'mark';
    const radius = this.settled ? REPEL_RADIUS_SMALL : REPEL_RADIUS;
    const r2 = radius * radius;
    const halfW = this.width / 2;
    const halfH = this.height / 2;

    for (let i = 0; i < this.count; i++) {
      const o = i * 3;
      const isDust = this.dustActive && this.dust[i] === 1;
      let tx: number;
      let ty: number;
      let tz: number;
      let k: number;
      let targetAlpha: number;

      if (phase === 'mark') {
        const mx = this.mark[o] * markScale;
        const my = this.mark[o + 1] * markScale;
        const mz = this.mark[o + 2] * markScale;
        const x1 = mx * cyM + mz * syM;
        const z1 = -mx * syM + mz * cyM;
        tx = x1;
        ty = my * cpM - z1 * spM + markY;
        tz = my * spM + z1 * cpM;
        k = 0.11;
        targetAlpha = 0.9 * markFade;
      } else if (isDust || (phase === 'scatter' && !this.replaying) || !place || !text) {
        // 흩어진 자리 — 먼지는 그 근처를 천천히 떠돈다.
        tx = this.scatter[o];
        ty = this.scatter[o + 1];
        tz = this.scatter[o + 2];
        if (isDust) {
          tx += Math.sin(now * 0.00023 + i) * 26;
          ty += Math.cos(now * 0.00019 + i * 1.3) * 20;
        }
        k = isDust ? 0.006 : 0.008;
        targetAlpha = isDust ? 0.3 : 0.75;
      } else if (phase === 'scatter') {
        // 다시 모으기(replay) 중 흩어짐 — 글자 입자만, 글자 근처 넓게.
        tx = this.scatter[o] * 0.5 + place.x * 0.5;
        ty = this.scatter[o + 1] * 0.5 + place.y * 0.5;
        tz = this.scatter[o + 2] * 0.5;
        k = 0.01;
        targetAlpha = 0.8;
      } else {
        // 글자 — 모델 좌표를 돌리고(yaw→pitch) 키운 뒤 자리로 옮긴다.
        const mx = text[o] * place.scale;
        const my = text[o + 1] * place.scale;
        const mz = text[o + 2] * place.scale;
        const x1 = mx * cy + mz * sy;
        const z1 = -mx * sy + mz * cy;
        tx = place.x + x1;
        ty = place.y + my * cp - z1 * sp;
        tz = my * sp + z1 * cp;
        k = this.stiffness[i];
        targetAlpha = 0.92;
      }

      // 스프링 + 감쇠
      let vx = (this.vel[o] + (tx - this.pos[o]) * k * f) * damp;
      let vy = (this.vel[o + 1] + (ty - this.pos[o + 1]) * k * f) * damp;
      const vz = (this.vel[o + 2] + (tz - this.pos[o + 2]) * k * f) * damp;

      let x = this.pos[o];
      let y = this.pos[o + 1];
      const z = this.pos[o + 2];
      let s = FOCAL / (FOCAL + z);

      // 손가락 근처는 밀어낸다(화면 거리 기준) — 스프링이 다시 끌어와서 구멍이 메워진다.
      if (repel) {
        const dx = halfW + x * s - pointer.x;
        const dy = halfH + y * s - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < r2 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (1 - d / radius) ** 2 * REPEL_FORCE * f;
          vx += ((dx / d) * push) / s;
          vy += ((dy / d) * push) / s;
        }
      }

      x += vx * f;
      y += vy * f;
      const nz = z + vz * f;
      this.vel[o] = vx;
      this.vel[o + 1] = vy;
      this.vel[o + 2] = vz;
      this.pos[o] = x;
      this.pos[o + 1] = y;
      this.pos[o + 2] = nz;

      this.alpha[i] += (targetAlpha - this.alpha[i]) * Math.min(1, 0.08 * f);
      // 로고의 녹색 X에서 뽑힌 입자는 글자로 모였을 때만 강조색으로 물든다(흩어지면 다시 흰색).
      const tinted = phase === 'mark' || (this.tint[i] === 1 && !isDust && usesText && phase !== 'scatter') ? 1 : 0;
      this.mix[i] += (tinted - this.mix[i]) * Math.min(1, 0.06 * f);

      if (FOCAL + nz < 60) {
        this.screenA[i] = 0;
        continue;
      }
      s = FOCAL / (FOCAL + nz);
      const depthFade = 1 - clamp01((nz + 300) / 1500) * 0.65;
      this.screenX[i] = halfW + x * s;
      this.screenY[i] = halfH + y * s;
      this.screenR[i] = Math.max(0.7, this.size[i] * s * (isDust ? 0.9 : textSize));
      this.screenA[i] = this.alpha[i] * depthFade;
    }
    this.drawParticles();
    this.raf = requestAnimationFrame(this.frame);
  };

  /**
   * 흰색 → 강조색 두 번에 나눠 그린다. 물드는 중인 입자는 두 번 모두 그려(불투명도를 나눠) 자연스럽게 넘어간다.
   * 입자마다 Skia 사각형을 만들면 느려서, 불투명도를 ALPHA_LEVELS 단계로 묶어 단계마다 SVG 경로 하나로 그린다.
   * 한 경로 안에서는 겹쳐도 밝아지지 않아서 묶음을 LAYERS개로 나눠 겹친 곳이 조금은 밝아지게 한다.
   */
  private drawParticles(): void {
    const buckets: string[][] = Array.from({ length: 2 * ALPHA_LEVELS * LAYERS }, () => []);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < this.count; i++) {
        const a = this.screenA[i] * (pass === 1 ? this.mix[i] : 1 - this.mix[i]);
        if (a < 0.02) continue;
        const level = Math.max(1, Math.round(Math.min(1, a) * ALPHA_LEVELS));
        const r = Math.round(this.screenR[i] * 10) / 10;
        const x = Math.round((this.screenX[i] - r / 2) * 10) / 10;
        const y = Math.round((this.screenY[i] - r / 2) * 10) / 10;
        buckets[(pass * ALPHA_LEVELS + level - 1) * LAYERS + (i % LAYERS)].push(`M${x} ${y}h${r}v${r}h-${r}z`);
      }
    }
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, this.width, this.height));
    buckets.forEach((parts, b) => {
      if (parts.length === 0) return;
      const path = Skia.Path.MakeFromSVGString(parts.join(''));
      if (!path) return;
      const pass = Math.floor(b / (ALPHA_LEVELS * LAYERS));
      const level = (Math.floor(b / LAYERS) % ALPHA_LEVELS) + 1;
      const paint = pass === 1 ? this.accentPaint : this.whitePaint;
      paint.setAlphaf(level / ALPHA_LEVELS);
      canvas.drawPath(path, paint);
    });
    this.opts.onFrame(recorder.finishRecordingAsPicture());
  }

  /** 동작 줄이기용 — 글자를 제자리에 바로 그린다. */
  private drawStatic = (): void => {
    const text = this.text;
    if (!text || this.destroyed) return;
    const place = this.slotPlacement(0);
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const cy = Math.cos(place.yaw);
    const sy = Math.sin(place.yaw);
    for (let i = 0; i < this.count; i++) {
      const o = i * 3;
      const mx = text[o] * place.scale;
      const mz = text[o + 2] * place.scale;
      const z = -mx * sy + mz * cy;
      const s = FOCAL / (FOCAL + z);
      const x = place.x + mx * cy + mz * sy;
      const y = place.y + text[o + 1] * place.scale;
      this.screenX[i] = halfW + x * s;
      this.screenY[i] = halfH + y * s;
      this.screenR[i] = Math.max(0.7, this.size[i] * s * 0.75);
      this.screenA[i] = this.dust[i] ? 0 : 0.85;
      this.mix[i] = this.tint[i];
    }
    this.drawParticles();
  };
}

/** 로고 아래에 부제를 붙여 하나의 모양으로 합친다(폭 = 로고 폭 1 기준). */
function stackShapes(logo: TextShape, sub: TextShape, subWidth: number, gap: number): TextShape {
  const logoN = logo.points.length / 3;
  const subN = sub.points.length / 3;
  const subHeight = sub.height * subWidth;
  const total = logo.height + gap + subHeight;
  const logoShift = logo.height / 2 - total / 2;
  const subShift = total / 2 - subHeight / 2;
  const points = new Float32Array((logoN + subN) * 3);
  points.set(logo.points);
  for (let i = 0; i < logoN; i++) points[i * 3 + 1] += logoShift;
  for (let i = 0; i < subN; i++) {
    const o = (logoN + i) * 3;
    points[o] = sub.points[i * 3] * subWidth;
    points[o + 1] = sub.points[i * 3 + 1] * subWidth + subShift;
    points[o + 2] = sub.points[i * 3 + 2] * subWidth;
  }
  const accent = new Uint8Array(logoN + subN);
  if (logo.accent) accent.set(logo.accent);
  return { points, height: total, accent };
}
