import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  runOnJS,
  useFrameCallback,
  useSharedValue,
  type FrameCallback,
  type FrameInfo,
  type SharedValue,
} from 'react-native-reanimated';
import { nowSec, springAt } from '../motion';
import { WATER_SPRING, WATER_STRETCH, type SpringSpec } from '../theme';

// 고른 표시 알약의 움직임(웹 ohq-ui/water/indicator.ts WaterIndicatorEngine) — 가운데·길이를 같은 스프링(ζ0.65·ω30.5,
// 7% 넘침)으로 옮기고, 달리는 빠르기만큼 진행 방향으로 늘고 옆으로 준다(최대 28%·옆은 0.64배, 15ms 늦게 따라감).
// 거리와 상관없이 같은 모양이 되게 빠르기를 이동 거리로 나눈다. 움직이는 도중 다시 골라도 지금 위치·빠르기에서 이어
// 간다. 계산은 UI 스레드 프레임 콜백(움직이는 동안만 돈다) — 결과 pose를 부품의 animated style이 읽는다.

export interface IndicatorTarget {
  /** 가운데 자리(px) */
  pos: number;
  /** 길이(px) */
  size: number;
}

/** 한 프레임 모양 — 가운데·길이와 늘어남(along 진행 방향 ≥ 1, across 옆 ≤ 1) */
export interface IndicatorPose {
  pos: number;
  size: number;
  along: number;
  across: number;
  /** 놓였는지 — 처음 set 전에는 그리지 않는다 */
  placed: boolean;
}

interface Track {
  x0: number;
  v0: number;
  target: number;
  start: number;
}

interface Request {
  pos: number;
  size: number;
  instant: boolean;
  step: number;
  /** 누른 뒤 지난 초(최대 0.12) — 움직임을 그만큼 앞당긴다(웹 since) */
  ago: number;
}

interface EngineState {
  pos: Track;
  size: Track;
  s: number;
  span: number;
  last: number;
}

const still = (v: number): Track => {
  'worklet';
  return { x0: v, v0: 0, target: v, start: -1e9 };
};

function sample(t: Track, at: number, spec: SpringSpec) {
  'worklet';
  const dt = at - t.start;
  if (dt > 2) return { x: t.target, v: 0 };
  if (dt <= 0) return { x: t.x0, v: t.v0 };
  return springAt(t.x0, t.v0, t.target, dt, spec);
}

export interface WaterIndicator {
  pose: SharedValue<IndicatorPose>;
  /** 새 자리로 — instant면 바로(처음·크기 바뀜), at은 누른 시각(nowSec), step은 한 칸 거리(늘어남 기준) */
  set: (target: IndicatorTarget, opts?: { instant?: boolean; at?: number; step?: number }) => void;
}

/** 표시 알약 엔진 — squash는 옆 찌그러짐 배율(1 = D7, 옆으로 긴 줄 알약은 작게) */
export function useWaterIndicator(opts: { spring?: SpringSpec; squash?: number } = {}): WaterIndicator {
  const spec = opts.spring ?? WATER_SPRING.indicator;
  const squashK = opts.squash ?? 1;
  const pose = useSharedValue<IndicatorPose>({ pos: 0, size: 0, along: 1, across: 1, placed: false });
  const req = useSharedValue<Request | null>(null);
  const state = useSharedValue<EngineState>({ pos: still(0), size: still(0), s: 0, span: 1, last: 0 });
  const squashSv = useSharedValue(squashK);

  useEffect(() => {
    squashSv.value = squashK;
  }, [squashK, squashSv]);

  // 멈춘 뒤 프레임 콜백을 끈다 — 그 사이 새 요청이 왔으면 그대로 둔다. 프레임 콜백은 아래에서 만들어지니 JS 쪽
  // 상자로 잇는다(worklet은 이 함수만 붙잡는다)
  const holder = useRef<FrameCallback | null>(null);
  const stop = useCallback(() => {
    if (req.value === null) holder.current?.setActive(false);
  }, [req]);

  const onFrame = useCallback(
    (info: FrameInfo) => {
      'worklet';
      const now = info.timestamp / 1000;
      const r = req.value;
      if (r) {
        req.value = null;
        if (r.instant || !pose.value.placed) {
          state.value = { pos: still(r.pos), size: still(r.size), s: 0, span: 1, last: now };
          pose.value = { pos: r.pos, size: r.size, along: 1, across: 1, placed: true };
          runOnJS(stop)();
          return;
        }
        const st = state.value;
        const start = now - r.ago;
        const p0 = sample(st.pos, start, spec);
        const z0 = sample(st.size, start, spec);
        state.value = {
          pos: { x0: p0.x, v0: p0.v, target: r.pos, start },
          size: { x0: z0.x, v0: z0.v, target: r.size, start },
          s: st.s,
          span: Math.max(Math.abs(r.pos - p0.x), r.step || r.size, 1),
          last: now,
        };
      }
      const cur = state.value;
      const dt = Math.max(0, Math.min(0.05, now - cur.last));
      const p = sample(cur.pos, now, spec);
      const z = sample(cur.size, now, spec);
      const { max, perSpeed, squash, lag } = WATER_STRETCH;
      const want = Math.min(max, (perSpeed * Math.abs(p.v)) / cur.span);
      const s = cur.s + (want - cur.s) * (1 - Math.exp(-dt / lag));
      if (now - cur.pos.start < 0.9 || s > 0.001) {
        state.value = { pos: cur.pos, size: cur.size, span: cur.span, s, last: now };
        pose.value = { pos: p.x, size: z.x, along: 1 + s, across: 1 - squash * squashSv.value * s, placed: true };
      } else {
        state.value = { pos: still(cur.pos.target), size: still(cur.size.target), s: 0, span: 1, last: now };
        pose.value = { pos: cur.pos.target, size: cur.size.target, along: 1, across: 1, placed: true };
        runOnJS(stop)();
      }
    },
    // 공유 값·스프링은 처음 만든 그대로 둔다(콜백이 바뀌면 프레임 콜백을 다시 등록한다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec, stop],
  );
  const frame = useFrameCallback(onFrame, false);
  holder.current = frame;

  const set = useCallback(
    (target: IndicatorTarget, o: { instant?: boolean; at?: number; step?: number } = {}) => {
      const ago = o.at === undefined ? 0 : Math.min(0.12, Math.max(0, nowSec() - o.at));
      req.value = { pos: target.pos, size: target.size, instant: !!o.instant, step: o.step ?? 0, ago };
      frame.setActive(true);
    },
    [req, frame],
  );

  return useMemo(() => ({ pose, set }), [pose, set]);
}
