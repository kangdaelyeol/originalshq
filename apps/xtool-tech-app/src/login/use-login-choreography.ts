import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Easing,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
  type WithTimingConfig,
} from 'react-native-reanimated';
import { PIECE } from './shape';

// 웹(components/login/use-login-choreography.ts)의 "좌상·우하 조각" 연출을 Reanimated로 옮겼다. 값과 시간은 같다.
//   gather    — 내용이 흐려지며 사라지고, 두 조각이 빛나며 가운데로 모인다(검증 중).
//   celebrate — 성공: ◩ 위에 로고가 뜨고 링이 퍼진다.
//   reject    — 실패: 조각이 빨갛게 물들어 떨리고, ✕ · 붉은 링 · 카드 흔들림.
//   split     — 조각이 다시 모서리로 돌아가고 내용이 선명하게 나타난다.
//   exit      — 로그인 성공 뒤 화면을 넘기기 전 사라지기.
// 조각은 카드 가운데를 기준점으로 두고, 쉬는 동안엔 ±(폭/2, 높이/2)만큼 밀어 모서리에 둔다.

const HALF = PIECE / 2;
// 조각이 모서리 ↔ 가운데를 오가는 스프링 — 살짝 튕기며 멈춘다(웹 motion 스프링과 같은 값).
const TRAVEL = { stiffness: 210, damping: 23, mass: 0.9 };
const ARRIVE_MS = 300;
const REJECT_HOLD_MS = 260;
// split이 끝나는 시간 — 웹은 마지막 애니메이션(조각 빛 사라짐 0.25초 뒤 0.6초)까지 기다린다.
const SPLIT_MS = 850;

// motion의 이름 붙은 곡선
const EASE_IN = Easing.bezier(0.42, 0, 1, 1);
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1);

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** 여러 값을 같은 시간에 나눠 거치는 키프레임(motion의 [a, b, c] 배열) — 구간마다 같은 길이. */
function keyframes(values: number[], duration: number, easing = EASE_OUT) {
  const step = duration / (values.length - 1);
  const [, ...rest] = values;
  return withSequence(...rest.map(v => withTiming(v, { duration: step, easing })));
}

const tween = (to: number, duration: number, easing: WithTimingConfig['easing'] = EASE_OUT) =>
  withTiming(to, { duration, easing });

export interface CardSize {
  width: number;
  height: number;
}

export interface Choreography {
  tlX: SharedValue<number>;
  tlY: SharedValue<number>;
  brX: SharedValue<number>;
  brY: SharedValue<number>;
  shakeX: SharedValue<number>;
  /** 내용(폼) 불투명도·크기 */
  content: SharedValue<number>;
  contentScale: SharedValue<number>;
  /** 조각이 강조색으로 빛나는 정도 / 빨갛게 물든 정도 */
  active: SharedValue<number>;
  error: SharedValue<number>;
  flash: SharedValue<number>;
  flashError: SharedValue<number>;
  logoOk: SharedValue<number>;
  logoOkScale: SharedValue<number>;
  logoFail: SharedValue<number>;
  logoFailScale: SharedValue<number>;
  /** 링 진행(0 → 1, 퍼지며 사라짐) */
  ringOk: SharedValue<number>;
  ringOk2: SharedValue<number>;
  ringFail: SharedValue<number>;
  /** 성공 뒤 사라지기(0 → 1) */
  leave: SharedValue<number>;
}

/**
 * 조각 연출 — 크기가 바뀌면 쉬는 조각을 새 모서리로 옮긴다(연출 중엔 그대로). 함수들은 웹처럼 끝나는 때에 맞춰
 * 풀리는 Promise를 돌려준다.
 */
export function useLoginChoreography(size: CardSize) {
  const tlX = useSharedValue(0);
  const tlY = useSharedValue(0);
  const brX = useSharedValue(0);
  const brY = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const content = useSharedValue(1);
  const contentScale = useSharedValue(1);
  const active = useSharedValue(0);
  const error = useSharedValue(0);
  const flash = useSharedValue(0);
  const flashError = useSharedValue(0);
  const logoOk = useSharedValue(0);
  const logoOkScale = useSharedValue(0.6);
  const logoFail = useSharedValue(0);
  const logoFailScale = useSharedValue(0.6);
  const ringOk = useSharedValue(0);
  const ringOk2 = useSharedValue(0);
  const ringFail = useSharedValue(0);
  const leave = useSharedValue(0);
  const restingRef = useRef(true);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => {
    if (!restingRef.current || size.width === 0) return;
    const dx = size.width / 2 - HALF;
    const dy = size.height / 2 - HALF;
    tlX.value = -dx;
    tlY.value = -dy;
    brX.value = dx;
    brY.value = dy;
  }, [size.width, size.height, tlX, tlY, brX, brY]);

  const gather = useCallback(async () => {
    restingRef.current = false;
    flash.value = keyframes([0, 1, 0.6], 500);
    content.value = tween(0, 260, EASE_IN);
    contentScale.value = tween(0.97, 260, EASE_IN);
    active.value = tween(1, 260);
    await wait(260);
    tlX.value = withSpring(0, TRAVEL);
    tlY.value = withSpring(0, TRAVEL);
    brX.value = withSpring(0, TRAVEL);
    brY.value = withSpring(0, TRAVEL);
    // 스프링이 완전히 멈추길 기다리면 다음 표시가 늦어서, 조각이 만나는 시점에 맞춰 넘긴다.
    await wait(ARRIVE_MS);
  }, [flash, content, contentScale, active, tlX, tlY, brX, brY]);

  const celebrate = useCallback(() => {
    logoOk.value = tween(1, 300);
    logoOkScale.value = withSequence(withTiming(0.6, { duration: 0 }), tween(1, 300));
    // 링은 기다리지 않는다 — 퍼지는 동안 다음 단계(화면 이동·폼 교체)가 이어진다. 둘째 링은 0.17초 늦게.
    ringOk.value = withSequence(withTiming(0, { duration: 0 }), tween(1, 900));
    ringOk2.value = withSequence(withTiming(0, { duration: 0 }), withDelay(170, tween(1, 900)));
  }, [logoOk, logoOkScale, ringOk, ringOk2]);

  const merge = useCallback(async () => {
    await gather();
    celebrate();
  }, [gather, celebrate]);

  const reject = useCallback(async () => {
    flash.value = tween(0, 150);
    flashError.value = keyframes([0, 1, 0.5], 450);
    error.value = tween(1, 160);
    await wait(160);
    logoFail.value = tween(1, 240);
    logoFailScale.value = withSequence(withTiming(0.6, { duration: 0 }), tween(1, 240));
    ringFail.value = withSequence(withTiming(0, { duration: 0 }), tween(1, 600));
    shakeX.value = keyframes([0, -14, 12, -9, 6, -3, 0], 500, EASE_IN_OUT);
    // 맞물렸던 두 조각이 서로 어긋나듯 떨린다.
    tlX.value = keyframes([0, -7, 6, -4, 2, 0], 420);
    brX.value = keyframes([0, 7, -6, 4, -2, 0], 420);
    await wait(420 + REJECT_HOLD_MS);
  }, [flash, flashError, error, logoFail, logoFailScale, ringFail, shakeX, tlX, brX]);

  const split = useCallback(
    async (next?: CardSize) => {
      // 폼이 막 바뀐 직후면 새 크기를 넘겨받는다(onLayout보다 먼저).
      const { width, height } = next ?? sizeRef.current;
      const dx = width / 2 - HALF;
      const dy = height / 2 - HALF;
      logoOk.value = tween(0, 200);
      logoOkScale.value = tween(0.7, 200);
      logoFail.value = tween(0, 200);
      logoFailScale.value = tween(0.7, 200);
      tlX.value = withSpring(-dx, TRAVEL);
      tlY.value = withSpring(-dy, TRAVEL);
      brX.value = withSpring(dx, TRAVEL);
      brY.value = withSpring(dy, TRAVEL);
      active.value = withDelay(250, tween(0, 600));
      error.value = withDelay(250, tween(0, 600));
      flash.value = tween(0, 600);
      flashError.value = tween(0, 600);
      content.value = withDelay(180, tween(1, 420));
      contentScale.value = withDelay(180, tween(1, 420));
      await wait(SPLIT_MS);
      restingRef.current = true;
    },
    [
      logoOk,
      logoOkScale,
      logoFail,
      logoFailScale,
      tlX,
      tlY,
      brX,
      brY,
      active,
      error,
      flash,
      flashError,
      content,
      contentScale,
    ],
  );

  /** 로그인 직후 화면을 넘기기 전 — 유리는 살짝 커지며 사라지고, 로고는 앞으로 튀어나오며 흩어진다. */
  const exit = useCallback(async () => {
    leave.value = tween(1, 340, EASE_IN);
    await wait(340);
  }, [leave]);

  const values: Choreography = useMemo(
    () => ({
      tlX,
      tlY,
      brX,
      brY,
      shakeX,
      content,
      contentScale,
      active,
      error,
      flash,
      flashError,
      logoOk,
      logoOkScale,
      logoFail,
      logoFailScale,
      ringOk,
      ringOk2,
      ringFail,
      leave,
    }),
    [
      tlX,
      tlY,
      brX,
      brY,
      shakeX,
      content,
      contentScale,
      active,
      error,
      flash,
      flashError,
      logoOk,
      logoOkScale,
      logoFail,
      logoFailScale,
      ringOk,
      ringOk2,
      ringFail,
      leave,
    ],
  );

  return { values, gather, celebrate, merge, reject, split, exit };
}
