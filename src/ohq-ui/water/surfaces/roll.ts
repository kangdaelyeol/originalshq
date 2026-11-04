// 숫자 굴림(오도미터) — 값 글자를 숫자 칸과 나머지 글자로 나눠, 바뀐 숫자 칸마다 0~9가 다섯 바퀴 적힌 띠를
// 위아래로 굴린다. 띠의 자리 p는 칸 수(0 = 맨 위 0, 1 = 1 …)이고 쉬는 자리는 가운데 바퀴(20 + 숫자)다 — 넘침·
// 이어 굴리기가 위아래로 한 바퀴씩 밀려도 띠 밖(빈칸)이 보이지 않게.

export type RollToken = { kind: 'text'; key: string; text: string } | { kind: 'digit'; key: string; digit: number }

/** 띠 한 칸 높이(em) — 숫자 줄 높이와 같다(styles/_surfaces.scss .water-number) */
export const ROLL_CELL = 1.15
/** 띠 바퀴 수와 쉬는 바퀴 */
export const ROLL_CYCLES = 5
const REST = 20

/** 띠 글자 — 0~9를 ROLL_CYCLES 바퀴(줄바꿈으로 한 칸씩) */
export const ROLL_STRIP = Array.from({ length: ROLL_CYCLES * 10 }, (_, i) => i % 10).join('\n')

// 글자 안의 첫 숫자 — 부호·천 단위 쉼표·소수점까지(예: "1,284건", "-3.5%", "1.4일")
const NUMBER = /-?\d[\d,]*(?:\.\d+)?/

/** 값 글자 → 칸. 정수 자리는 오른쪽(일의 자리)부터 i0·i1…, 소수 자리는 왼쪽부터 f0·f1… — 자리 수가 바뀌어도
 * 같은 자리끼리 굴린다(9 → 12면 일의 자리 9 → 2, 십의 자리는 새로 0 → 1) */
export function rollTokens(text: string): RollToken[] {
  const m = NUMBER.exec(text)
  if (!m) return [{ kind: 'text', key: 'all', text }]
  const tokens: RollToken[] = []
  const head = text.slice(0, m.index)
  const tail = text.slice(m.index + m[0].length)
  if (head) tokens.push({ kind: 'text', key: 'head', text: head })
  const [int, frac] = m[0].split('.')
  let place = int.replace(/\D/g, '').length
  for (const ch of int) {
    if (ch >= '0' && ch <= '9') {
      place -= 1
      tokens.push({ kind: 'digit', key: `i${place}`, digit: Number(ch) })
    } else tokens.push({ kind: 'text', key: ch === '-' ? 'minus' : `sep${place}`, text: ch })
  }
  if (frac !== undefined) {
    tokens.push({ kind: 'text', key: 'dot', text: '.' })
    for (let k = 0; k < frac.length; k++) tokens.push({ kind: 'digit', key: `f${k}`, digit: Number(frac[k]) })
  }
  if (tail) tokens.push({ kind: 'text', key: 'tail', text: tail })
  return tokens
}

/** 글자 안 첫 숫자의 값 — 없으면 null */
export function rollValue(text: string): number | null {
  const m = NUMBER.exec(text)
  return m ? Number(m[0].replace(/,/g, '')) : null
}

export interface RollMove {
  key: string
  /** 굴리기 시작할 숫자(새로 생긴 자리는 0) */
  from: number
  digit: number
}

export interface RollPlan {
  tokens: RollToken[]
  /** 굴릴 칸 — 왼쪽부터(차례로 출발하는 순서) */
  moves: RollMove[]
  /** 값이 커지면 위로(띠가 올라간다), 작아지면 아래로 */
  up: boolean
}

/** 이전 글자 → 새 글자 굴림 계획 — 숫자가 아니거나 바뀐 숫자 칸이 없으면 null(그냥 바꾼다) */
export function planRoll(prev: string, next: string): RollPlan | null {
  const a = rollValue(prev)
  const b = rollValue(next)
  if (a === null || b === null || prev === next) return null
  const old = new Map<string, number>()
  for (const t of rollTokens(prev)) if (t.kind === 'digit') old.set(t.key, t.digit)
  const tokens = rollTokens(next)
  const moves: RollMove[] = []
  for (const t of tokens) {
    if (t.kind !== 'digit') continue
    // 그대로인 칸, 새로 생긴 0 칸은 굴리지 않는다
    const from = old.get(t.key) ?? 0
    if (from === t.digit) continue
    moves.push({ key: t.key, from, digit: t.digit })
  }
  return moves.length ? { tokens, moves, up: b >= a } : null
}

/** 쉬는 자리 */
export const rollRest = (digit: number): number => REST + digit

/** 지금 띠 자리 x를 가운데 바퀴로 옮긴다(한 바퀴 = 10칸 — 띠가 되풀이라 보이는 모양은 같다) */
export function rollNormalize(x: number): number {
  let v = x
  while (v >= REST + 9.5) v -= 10
  while (v < REST - 0.5) v += 10
  return v
}

/** x에서 digit으로 굴러갈 끝 자리 — 커지면 아래쪽(큰 자리)으로, 작아지면 위쪽으로만 간다 */
export function rollTarget(x: number, digit: number, up: boolean): number {
  let t = REST + digit
  if (up && t < x - 1e-3) t += 10
  if (!up && t > x + 1e-3) t -= 10
  return t
}
