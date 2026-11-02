// 영상 속 끌기 — sample/design4.mp4(30fps)에서 손잡이가 움직인 길과 바닥 숫자를 프레임마다 적었다.
// 영상은 5초(150프레임) 동작을 두 번 이어 붙인 것: F1~F40 48%에 멈춤 → F41~F52 오른쪽 끝까지
// 끌기 → F53~F73 왼쪽(숫자 34%)까지 → F74~F95 48%로 천천히 돌아옴 → F96~F150 멈춤.

/** 영상 첫 장면·멈춘 값 */
export const DEMO_REST_VALUE = 48

/** 적어 둔 첫 프레임(이 앞은 쉬는 중) */
export const DEMO_FIRST_FRAME = 36

/**
 * F36부터 프레임마다 손잡이(줄 마지막 점) x. 영상의 둥근 끝 오른쪽 가장자리(F36 406px →
 * F52 559px → F72 315px → F100 407px)를 재고, 줄 물리(VIDEO_ROPE)를 돌리며 그 가장자리가 같은
 * 자리에 오도록 프레임마다 맞춘 값이다.
 */
export const DEMO_KNOB_PATH: readonly number[] = [
  0.162, 0.1665, 0.1661, 0.1664, 0.1707, 0.2009, 0.264, 0.3369, 0.4309, 0.5256, 0.6084, 0.6806, 0.7383,
  0.7813, 0.8106, 0.8297, 0.8399, 0.8378, 0.8329, 0.8155, 0.7962, 0.7612, 0.7155, 0.6477, 0.5728, 0.4842,
  0.3973, 0.306, 0.2159, 0.1219, 0.0401, -0.045, -0.1144, -0.1659, -0.2004, -0.2219, -0.2274, -0.2281, -0.221,
  -0.2049, -0.1856, -0.1589, -0.1339, -0.1033, -0.081, -0.0528, -0.0296, -0.005, 0.0169, 0.0341, 0.0549, 0.0685,
  0.0846, 0.1025, 0.1152, 0.1235, 0.1365, 0.1406, 0.1492, 0.1536, 0.1577, 0.1621, 0.1618, 0.1665, 0.1661,
]

/**
 * F36부터 프레임마다 바닥 숫자 — 영상에서 읽었다(F49~F57은 젤리가 덮어 안 보여 앞뒤를 이었다).
 * 숫자는 손잡이를 바로 따르지 않고 조금 늦게 따라온다(오른쪽으로 갈 땐 덜, 돌아올 땐 천천히).
 */
export const DEMO_PERCENT: readonly number[] = [
  48, 48, 48, 48, 48, 50, 52, 55, 59, 65, 71, 78, 84,
  89, 93, 96, 98, 99, 99, 98, 96, 93, 91, 89, 86, 83,
  79, 75, 71, 66, 62, 57, 52, 48, 44, 40, 37, 36, 34,
  34, 35, 36, 37, 38, 38, 39, 40, 41, 42, 43, 44, 44,
  45, 45, 46, 46, 47, 47, 47, 48, 48, 48, 48, 48, 48,
]

/** 이 프레임 뒤로는 멈춰 있다 */
export const DEMO_LAST_FRAME = DEMO_FIRST_FRAME + DEMO_KNOB_PATH.length - 1

const sample = (table: readonly number[], frame: number) => {
  const f = Math.min(Math.max(frame - DEMO_FIRST_FRAME, 0), table.length - 1)
  const i = Math.floor(f)
  const t = f - i
  return i + 1 < table.length ? table[i] + (table[i + 1] - table[i]) * t : table[i]
}

/** 영상 프레임(소수 가능) → 손잡이 x */
export const demoKnobAt = (frame: number) => sample(DEMO_KNOB_PATH, frame)

/** 영상 프레임 → 그 프레임에 보이던 바닥 숫자 */
export const demoPercentAt = (frame: number) =>
  DEMO_PERCENT[Math.min(Math.max(Math.floor(frame + 1e-6) - DEMO_FIRST_FRAME, 0), DEMO_PERCENT.length - 1)]
