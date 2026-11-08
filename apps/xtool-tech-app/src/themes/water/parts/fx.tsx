import { useCallback, useMemo } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { BlurMask, Canvas, Circle, Group, Oval, Path, rect, rrect, Skia } from '@shopify/react-native-skia';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { IndicatorPose } from './use-indicator';

// 물결·물방울(D7, 웹 ohq-ui/water/ripple.ts·fx.ts) — 누르면 그 자리에서 물결이 두 겹 퍼지고(반지름 22에서 초속
// 525px, 22px 간격, 0.3초, 1-u²로 흐려짐), 고르면 표시 알약 윗변에서 물방울이 튀어 올랐다 아이콘 위에 앉아 두 번
// 통통 튄 뒤(bounce) 닿은 자리에 물결이 퍼진다. 값은 영상 px라 작은 부품은 k(= 높이 / 50.5)로 줄인다(시간표는 같다).
// 그리기는 Skia — 시각 하나(공유 값)를 withTiming으로 흘리고 모양은 UI 스레드에서 계산한다(프레임마다 JS 없음).

export const WATER_RIPPLE = { r0: 22, speed: 525, gap: 22, life: 0.3, inner: 11 } as const;

export const WATER_DROP = {
  /** 고른 뒤 물방울이 나오기까지 — 한 칸 0.15s, 한 칸 더 갈 때마다 +32ms */
  delay: { base: 0.15, perStep: 0.032 },
  gravity: 4600,
  /** 윗변에서 534px/s로 튀어 올라 19px 아래(아이콘 위)에 앉아 두 번 통통(300·100px/s) */
  bounce: { launch: 534, sink: 19, rebound: 300, rebound2: 100, offsetX: 1.5 },
} as const;

/** 물결이 보일 유리 영역(층 좌표 px) — 이 밖으로는 안 퍼진다 */
export interface RippleClip {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

interface RippleSpec {
  x: number;
  y: number;
  k: number;
  clip: RippleClip;
}

const NONE: RippleSpec = { x: 0, y: 0, k: 1, clip: { x: 0, y: 0, width: 0, height: 0, radius: 0 } };

// ── 물방울 한 알(반지름 5.5 유리구슬, D7 liquid-drop) ──────────────────────────────

const CRESCENT = Skia.Path.MakeFromSVGString('M-4.9 1.1A5 5 0 0 0 4.9 1.1A6.8 6.8 0 0 1-4.9 1.1Z') ?? Skia.Path.Make();

/** 물방울 — 원점이 가운데. 아래쪽 밝은 초승달, 왼쪽 위 반짝임, 옅게 어두운 가장자리 */
export function SkBead() {
  return (
    <>
      <Circle cx={0} cy={0} r={5.5} color="rgba(255, 255, 255, 0.16)" />
      <Circle cx={0} cy={0} r={5.5} color="rgba(42, 40, 45, 0.42)" style="stroke" strokeWidth={0.9} />
      <Path path={CRESCENT} color="rgba(255, 255, 255, 0.92)" />
      <Oval x={-3.5} y={-3.7} width={3.2} height={2.6} color="rgba(255, 255, 255, 0.95)" />
    </>
  );
}

// ── 물결 두 겹 ─────────────────────────────────────────────────────────────────

/** 물결 고리 — rho(퍼진 지 초)·spec을 받아 그린다. Canvas 안에 넣는다 */
function RippleRings({
  rho,
  spec,
  dx = 0,
  dy = 0,
}: {
  rho: Readonly<SharedValue<number>>;
  spec: Readonly<SharedValue<RippleSpec>>;
  dx?: number;
  dy?: number;
}) {
  const R = WATER_RIPPLE;
  const opacity = useDerivedValue(() => {
    const r = rho.value;
    if (!(r >= 0 && r < R.life)) return 0;
    const u = r / R.life;
    return 1 - u * u;
  });
  const clip = useDerivedValue(() => {
    const c = spec.value.clip;
    return rrect(rect(c.x + dx, c.y + dy, c.width, c.height), c.radius, c.radius);
  });
  const ring = (i: number, dark: boolean) => {
    'worklet';
    const s = spec.value;
    const lead = (R.r0 + R.speed * Math.max(0, rho.value)) * s.k;
    const r = lead - R.gap * s.k * i;
    return Math.max(1, dark ? r - R.inner * s.k : r);
  };
  const shown = (i: number) => {
    'worklet';
    const s = spec.value;
    const lead = (R.r0 + R.speed * Math.max(0, rho.value)) * s.k;
    return lead - R.gap * s.k * i > 6 * s.k ? 1 : 0;
  };
  const cx = useDerivedValue(() => spec.value.x + dx);
  const cy = useDerivedValue(() => spec.value.y + dy);
  const blur = useDerivedValue(() => 2.2 * spec.value.k);
  const wDark = useDerivedValue(() => 8 * spec.value.k);
  const wBright = useDerivedValue(() => 7 * spec.value.k);
  const d0 = useDerivedValue(() => ring(0, true));
  const b0 = useDerivedValue(() => ring(0, false));
  const d1 = useDerivedValue(() => ring(1, true));
  const b1 = useDerivedValue(() => ring(1, false));
  const o0 = useDerivedValue(() => shown(0));
  const o1 = useDerivedValue(() => shown(1));
  return (
    <Group clip={clip} opacity={opacity}>
      <Group opacity={o0}>
        <Circle cx={cx} cy={cy} r={d0} style="stroke" strokeWidth={wDark} color="rgba(0, 0, 0, 0.13)">
          <BlurMask blur={blur} style="normal" />
        </Circle>
        <Circle cx={cx} cy={cy} r={b0} style="stroke" strokeWidth={wBright} color="rgba(255, 255, 255, 0.34)">
          <BlurMask blur={blur} style="normal" />
        </Circle>
      </Group>
      <Group opacity={o1}>
        <Circle cx={cx} cy={cy} r={d1} style="stroke" strokeWidth={wDark} color="rgba(0, 0, 0, 0.13)">
          <BlurMask blur={blur} style="normal" />
        </Circle>
        <Circle cx={cx} cy={cy} r={b1} style="stroke" strokeWidth={wBright} color="rgba(255, 255, 255, 0.34)">
          <BlurMask blur={blur} style="normal" />
        </Circle>
      </Group>
    </Group>
  );
}

export interface WaterRippleFx {
  rho: SharedValue<number>;
  spec: SharedValue<RippleSpec>;
  /** 누르자마자 퍼지는 물결 — x·y는 층 좌표, k는 부품 높이 / 50.5, clip은 유리 영역 */
  play: (s: RippleSpec) => void;
}

/** 누르자마자 퍼지는 물결(웹 WaterRipple) — 칩을 켤 때·토스트가 성공할 때·메뉴를 누를 때 */
export function useRippleFx(): WaterRippleFx {
  const rho = useSharedValue(-1);
  const spec = useSharedValue<RippleSpec>(NONE);
  const play = useCallback(
    (s: RippleSpec) => {
      cancelAnimation(rho);
      spec.value = s;
      rho.value = 0;
      rho.value = withTiming(WATER_RIPPLE.life, { duration: WATER_RIPPLE.life * 1000, easing: Easing.linear });
    },
    [rho, spec],
  );
  return useMemo(() => ({ rho, spec, play }), [rho, spec, play]);
}

/** 물결 층 — 부품 위(또는 표시 알약 밑)에 겹친다. 누르는 것을 막지 않는다 */
export function RippleLayer({ fx, style }: { fx: WaterRippleFx; style?: StyleProp<ViewStyle> }) {
  return (
    <Canvas style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <RippleRings rho={fx.rho} spec={fx.spec} />
    </Canvas>
  );
}

/** 누른 자리(부품 좌표)·부품 크기 → 물결 설정(웹 rippleAt) — 자리가 없으면 가운데 */
export function rippleAt(
  box: { x: number; y: number; width: number; height: number },
  point?: { x: number; y: number } | null,
  radius?: number,
): RippleSpec {
  return {
    x: point ? point.x : box.x + box.width / 2,
    y: point ? point.y : box.y + box.height / 2,
    k: box.height / 50.5,
    clip: { ...box, radius: radius ?? box.height / 2 },
  };
}

// ── 고를 때 물방울(bounce) + 닿은 자리 물결 ────────────────────────────────────────

interface DropEvent {
  /** 고른 칸 가운데 x(물결 자리) */
  x: number;
  /** 표시 알약 윗변 y — 여기서 튀어 오른다 */
  surface: number;
  /** 물결 가운데 y(표시 알약 가운데) */
  rippleY: number;
  k: number;
  delay: number;
  clip: RippleClip;
}

export interface WaterDropOptions {
  x: number;
  surface: number;
  rippleY: number;
  /** 표시 알약 높이 / 50.5 */
  scale: number;
  /** 몇 칸 옮겼는지 — 물방울이 늦게 나오는 정도 */
  steps: number;
  clip: RippleClip;
  /** 누른 시각부터 지난 초(최대 0.12) — 그만큼 시간표를 앞당긴다 */
  ago?: number;
}

export interface WaterDropFx {
  t: SharedValue<number>;
  ev: SharedValue<DropEvent>;
  /** 물방울이 따라갈 표시 알약(가로) — 있으면 아직 넘쳐 있는 알약을 따라 솟는다 */
  follow?: SharedValue<IndicatorPose>;
  trigger: (o: WaterDropOptions) => void;
}

/** 바닥에 앉는 시각(초) — 윗변에서 솟아 rest(윗변 + 19k)에 내려앉기까지 */
function landTime(k: number) {
  'worklet';
  const b = WATER_DROP.bounce;
  const g = WATER_DROP.gravity * k;
  const launch = b.launch * k;
  return (launch + Math.sqrt(launch * launch + 2 * g * b.sink * k)) / g;
}

export function useDropFx(follow?: SharedValue<IndicatorPose>): WaterDropFx {
  const t = useSharedValue(-1);
  const ev = useSharedValue<DropEvent>({ x: 0, surface: 0, rippleY: 0, k: 1, delay: 0, clip: NONE.clip });
  const trigger = useCallback(
    (o: WaterDropOptions) => {
      const steps = Math.max(1, o.steps);
      const delay = WATER_DROP.delay.base + WATER_DROP.delay.perStep * (steps - 1);
      const k = o.scale;
      const end = delay + landTime(k) + WATER_RIPPLE.life;
      const from = Math.min(0.12, Math.max(0, o.ago ?? 0));
      cancelAnimation(t);
      ev.value = { x: o.x, surface: o.surface, rippleY: o.rippleY, k, delay, clip: o.clip };
      t.value = from;
      t.value = withTiming(end, { duration: Math.max(1, (end - from) * 1000), easing: Easing.linear });
    },
    [t, ev],
  );
  return useMemo(() => ({ t, ev, follow, trigger }), [t, ev, follow, trigger]);
}

/** 물방울 한 알 — 층 좌표에서 dx·dy만큼 옮겨 그린다(층이 부품보다 크게 넘쳐 있을 때) */
function DropBead({ fx, dx, dy }: { fx: WaterDropFx; dx: number; dy: number }) {
  const { t, ev, follow } = fx;
  const pose = useDerivedValue(() => {
    const e = ev.value;
    const tau = t.value - e.delay;
    if (t.value < 0 || tau < 0) return { x: 0, y: 0, sx: 1, sy: 1, o: 0 };
    const k = e.k;
    const b = WATER_DROP.bounce;
    const g = WATER_DROP.gravity * k;
    const top = e.surface;
    const rest = e.surface + b.sink * k;
    const launch = b.launch * k;
    const land = landTime(k);
    const ix = follow && follow.value.placed ? follow.value.pos : e.x;
    let y: number;
    let vy: number;
    if (tau < land) {
      y = top - launch * tau + (g / 2) * tau * tau;
      vy = -launch + g * tau;
    } else {
      const s = tau - land;
      const r1 = b.rebound * k;
      const r2 = b.rebound2 * k;
      const b1 = (2 * r1) / g;
      const b2 = (2 * r2) / g;
      if (s < b1) {
        y = rest - r1 * s + (g / 2) * s * s;
        vy = -r1 + g * s;
      } else if (s < b1 + b2) {
        const u = s - b1;
        y = rest - r2 * u + (g / 2) * u * u;
        vy = -r2 + g * u;
      } else {
        y = rest;
        vy = 0;
      }
    }
    const s = tau - land;
    const o = s < 0.2 ? 1 : Math.max(0, 1 - (s - 0.2) / 0.09);
    // 표면에서 솟아날 때 작게 시작하고, 빠를수록 세로로 늘어난다
    const grow = Math.min(1, 0.45 + tau / 0.045);
    const stretch = 1 + 0.25 * Math.min(1, Math.abs(vy) / (650 * k));
    return { x: ix + b.offsetX * k, y, sx: (k * grow) / Math.sqrt(stretch), sy: k * grow * stretch, o };
  });
  const transform = useDerivedValue(() => [
    { translateX: pose.value.x + dx },
    { translateY: pose.value.y + dy },
    { scaleX: pose.value.sx },
    { scaleY: pose.value.sy },
  ]);
  const opacity = useDerivedValue(() => pose.value.o);
  return (
    <Group transform={transform} opacity={opacity}>
      <SkBead />
    </Group>
  );
}

/** 물방울이 닿은 자리 물결 — 앉는 순간부터 */
function DropRipple({ fx }: { fx: WaterDropFx }) {
  const { t, ev } = fx;
  const rho = useDerivedValue(() => {
    const e = ev.value;
    if (t.value < 0) return -1;
    return t.value - e.delay - landTime(e.k);
  });
  const spec = useDerivedValue<RippleSpec>(() => {
    const e = ev.value;
    return { x: e.x, y: e.rippleY, k: e.k, clip: e.clip };
  });
  return <RippleRings rho={rho} spec={spec} />;
}

/** 물방울이 닿은 자리 물결 층 — 표시 알약 밑에 깐다(D7: 유리 속 고리 위에 표시 알약) */
export function DropRippleLayer({ fx }: { fx: WaterDropFx }) {
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <DropRipple fx={fx} />
    </Canvas>
  );
}

/** 물방울 층 — 맨 위. 물방울이 부품 위로 솟으니 층을 위·옆으로 넉넉히 넘긴다 */
export function DropLayer({ fx, over = 44, side = 16 }: { fx: WaterDropFx; over?: number; side?: number }) {
  return (
    <Canvas style={[StyleSheet.absoluteFill, { top: -over, left: -side, right: -side }]} pointerEvents="none">
      <DropBead fx={fx} dx={side} dy={over} />
    </Canvas>
  );
}
