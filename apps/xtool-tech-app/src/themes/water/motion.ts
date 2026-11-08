import type { SpringSpec } from './theme';

// 물 움직임 계산(웹 ohq-ui/water/motion.ts) — UI 스레드(worklet)에서도 부르게 'worklet'을 단다. 감쇠 스프링 식을 그대로
// 써서 움직이는 도중 목표가 바뀌어도 그 순간의 위치·빠르기에서 이어 간다(D7 표시 알약).

/** 멈춘 상태에서 출발하는 감쇠 스프링(0 → 1) — t초 뒤 */
export function spring(t: number, s: SpringSpec): number {
  'worklet';
  if (t <= 0) return 0;
  const { zeta, omega } = s;
  if (zeta >= 1) return 1 - Math.exp(-omega * t) * (1 + omega * t);
  const root = Math.sqrt(1 - zeta * zeta);
  const wd = omega * root;
  return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + (zeta / root) * Math.sin(wd * t));
}

/** 처음 위치·속도에서 target으로 가는 스프링의 t초 뒤 위치·속도 */
export function springAt(x0: number, v0: number, target: number, t: number, s: SpringSpec): { x: number; v: number } {
  'worklet';
  const { zeta, omega } = s;
  const a = x0 - target;
  if (zeta >= 1) {
    const e = Math.exp(-omega * t);
    const b = v0 + omega * a;
    return { x: target + e * (a + b * t), v: e * (b - omega * (a + b * t)) };
  }
  const root = Math.sqrt(1 - zeta * zeta);
  const wd = omega * root;
  const b = (v0 + zeta * omega * a) / wd;
  const e = Math.exp(-zeta * omega * t);
  const c = Math.cos(wd * t);
  const sn = Math.sin(wd * t);
  return {
    x: target + e * (a * c + b * sn),
    v: e * ((-zeta * omega * a + wd * b) * c + (-zeta * omega * b - wd * a) * sn),
  };
}

export function clamp01(v: number): number {
  'worklet';
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** 부드러운 계단(smoothstep) */
export function smooth(v: number): number {
  'worklet';
  const c = v < 0 ? 0 : v > 1 ? 1 : v;
  return c * c * (3 - 2 * c);
}

/** 1-(1-u)² — 표시 알약이 제자리에서 진해지는 곡선(ease-shade) */
export function shade(u: number): number {
  'worklet';
  const c = u < 0 ? 0 : u > 1 ? 1 : u;
  return 1 - (1 - c) * (1 - c);
}

/** 지금 시각(초) — 누른 시각과 움직임 시작을 같은 시계로 잰다 */
export const nowSec = (): number => Date.now() / 1000;

/** 누른 시각 → 움직임 시작 시각(D7 since) — 너무 옛날이면 0.12초까지만 거슬러 간다 */
export const since = (at: number | undefined, now: number = nowSec()): number =>
  at === undefined ? now : Math.min(now, Math.max(at, now - 0.12));
