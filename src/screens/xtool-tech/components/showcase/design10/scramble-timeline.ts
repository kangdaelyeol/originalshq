// 텍스트 스크램블 한 바퀴(2초). 시간은 영상 F1 = 0초, 한 프레임 = 1/30초로 잰 값.
// 밑줄 막대의 길이가 곧 진행도다 — 막대 끝(F5 282.5px → F8 93.5px, F10 53.6px → F60 325.6px)이
// 두 구간 모두 곧은 줄(일정한 속도)이라 직선으로 맞췄고, 글자가 맞춰지는 프레임(F17·24·31·39·46·54·61)이
// 진행도 × 글자 수의 내림과 정확히 맞는다.

/** 뒤섞일 때 보이는 글자 — 영상에 나온 것: 영문 대문자·숫자·# % & ? */
export const SCRAMBLE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&?'

/** 흩어지기: F4.28 → F8.75(0.149초). 막대가 1 → 0으로 줄고 왼쪽 글자부터 뒤섞인다. */
export const SCRAMBLE_OUT: readonly [number, number] = [0.1093, 0.2583]

/** 맞춰지기: F8.75 → F60.38(1.721초). 막대가 0 → 1로 늘고 왼쪽부터 한 글자씩(글자당 7.38프레임) 맞춰진다. */
export const SCRAMBLE_IN: readonly [number, number] = [0.2583, 1.9793]

/** 뒤섞인 글자는 영상 프레임마다(30fps) 새로 뽑힌다. */
export const SCRAMBLE_FPS = 30

export interface ScrambleFrame {
  /** 밑줄 막대 길이(0~1) */
  progress: number
  chars: string[]
  /** 제자리에 맞춰진(초록) 글자 */
  settled: boolean[]
}

// 시각·자리로 정해지는 의사 난수 — 같은 시각이면 언제 그려도 같은 글자(되감기·캡처해도 같다)
function hash(a: number, b: number) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d)
  h ^= h >>> 12
  return h >>> 0
}

/** t초(0~2)의 글자 상태. 공백은 뒤섞지 않는다. */
export function scrambleFrame(text: string, t: number, charset = SCRAMBLE_CHARSET): ScrambleFrame {
  const letters = [...text]
  const n = letters.length
  const [o0, o1] = SCRAMBLE_OUT
  const [i0, i1] = SCRAMBLE_IN
  let progress = 1
  let isSettled: (i: number) => boolean = () => true
  if (t >= o0 && t < o1) {
    progress = 1 - (t - o0) / (o1 - o0)
    const kept = Math.floor(progress * n)
    isSettled = (i) => i >= n - kept
  } else if (t >= i0 && t < i1) {
    progress = (t - i0) / (i1 - i0)
    const done = Math.floor(progress * n)
    isSettled = (i) => i < done
  }
  const tick = Math.floor(t * SCRAMBLE_FPS)
  const settled = letters.map((ch, i) => ch === ' ' || isSettled(i))
  const chars = letters.map((ch, i) => (settled[i] ? ch : charset[hash(tick, i) % charset.length]))
  return { progress, chars, settled }
}
