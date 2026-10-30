/**
 * 프롬프트 망 — 퍼셉트론 화면(src/screens/perceptron)과 소재 분석 API가 함께
 * 쓰는 순수 모듈. 망의 모양(층·노드·케이스)과, 케이스 하나가 지난 경로로
 * 프롬프트 한 장과 비용을 만드는 규칙이 여기 하나뿐이라 화면과 서버가 늘 같은
 * 결과를 낸다. 의존성이 없어야 한다 — 화면은 이 파일을 그대로 가져다 쓰고,
 * 서버(es2017)에서도 돈다(replaceAll·Object.fromEntries 같은 새 문법은 쓰지 않는다).
 */

export type Tone = 'accent' | 'white'

/** 카드의 값 줄 — [이름, 값, 색(기둥 강조색이면 'accent')]. */
export type NodeRow = [string, string, Tone?]

export interface NodeDef {
  id: string
  title: string
  /** 카드에 보이는 값 줄(최대 3줄). */
  rows: NodeRow[]
  /** 프롬프트 조각 — 이 노드를 지나는 케이스의 프롬프트에서 feeds 칸에 들어간다
   * ({result}는 그 케이스의 결과로 바뀐다). 출력 노드의 칸이면 모든 프롬프트에
   * 들어가는 기본 줄. */
  prompt: string
  /** 조각이 들어갈 출력 노드의 칸 id(출력 노드의 칸 자신은 빈 값). */
  feeds: string
  /** 이 노드를 지나면 프롬프트와 함께 Claude에 보내는 입력의 토큰 수(영상
   * 프레임·성과 표처럼) — 비용 계산에 들어간다. */
  tokens?: number
}

/** 층마다 노드 — 0 입력, 1 특징, 2 은닉(인코더), 3 게이트, 4 출력 노드의 칸
 * (맨 위는 머리). */
export type Layers = NodeDef[][]

/** 특징 질문의 답 — [답, 신뢰도(0~1)]. */
export type Answer = [string, number]

export interface CaseDef {
  /** 1~12 — 쓰임(USE CASES) 순번. */
  id: number
  title: string
  color: string
  /** 층마다 지날 노드 id 5개 — 마지막은 출력 노드의 칸. */
  path: string[]
  /** 켜진 카드 아래 결과 띠 — 노드 id별(특징 노드는 답에서, 게이트·머리는
   * 계산한다). */
  results: Record<string, string>
  /** 이 케이스 입력에 대한 특징 질문의 답 — 특징 노드 id별. 경로가 지나는
   * 질문의 신뢰도가 게이트 판정에 쓰인다. */
  answers: Record<string, Answer>
  /** 이 케이스만의 프롬프트 줄 — 출력 노드의 칸 id별(역할·과제처럼). */
  lines: Record<string, string>
  /** 경로의 특징 노드에 답이 없을 때 쓰는 신뢰도. */
  confidence: number
  /** 은닉층이 답하는 데 걸린 시간(ms). */
  ms: number
  /** Claude 응답의 예상 토큰 — 출력 형식이 길수록 크다. */
  outTokens: number
}

export interface Graph {
  layers: Layers
  cases: CaseDef[]
}

/** 출력 노드의 머리 칸 — 지울 수 없고, 제목의 "·" 뒤가 모델 이름이 된다. */
export const HEAD_ID = 'out:head'

/** 이 신뢰도 아래면 보류 — Claude를 부르지 않고 사람 검토로. */
export const GATE = 0.8

/** 단가($ / 100만 토큰) 기본값 — claude-opus-5-5. 머리 칸의 카드 값
 * "in $/M"·"out $/M"을 고치면 그 값을 쓴다(다른 모델로 바꿀 때). */
export const PRICE = { in: 4, out: 20 }

/** 이 프롬프트를 Claude에 보낼 때의 토큰과 비용. */
export interface Cost {
  /** 프롬프트 글의 토큰(대략). */
  textTokens: number
  /** 경로 노드가 함께 보내는 입력(영상 프레임·표 등)의 토큰. */
  attachedTokens: number
  inTokens: number
  outTokens: number
  inCost: number
  outCost: number
  /** 보류면 0 — Claude를 부르지 않는다. */
  total: number
  price: { in: number; out: number }
}

/** 케이스 하나를 망에 통과시킨 결과. */
export interface Composed {
  /** 경로가 지나는 특징 질문의 답 신뢰도(답이 없으면 케이스 기본값). */
  confidence: number
  hold: boolean
  /** 경로 노드 id별 결과 띠(게이트·머리 포함). */
  results: Record<string, string>
  /** 프롬프트(줄 단위). */
  prompt: string[]
  cost: Cost
}

/** '→ 결과 먼저  0.97' → '결과 먼저 0.97'. */
export const plain = (s = '') =>
  s.replace(/^→\s*/, '').replace(/\s+/g, ' ').trim()

/** 1 234 → '1.2k', 41 800 → '42k'. */
export const fmtTokens = (n: number) =>
  n >= 10000
    ? `${Math.round(n / 1000)}k`
    : n >= 1000
      ? `${(n / 1000).toFixed(1)}k`
      : `${n}`

/** 1센트 아래는 소수 셋째 자리까지. */
export const fmtUsd = (x: number) =>
  x > 0 && x < 0.01 ? `$${x.toFixed(3)}` : `$${x.toFixed(2)}`

/** 이 케이스에 적힌 결과가 없는 노드 — 강조한 값(없으면 첫 값)을 결과로 쓴다. */
export const fallbackResult = (n: NodeDef) => {
  const row = n.rows.find((r) => r[2] === 'accent') || n.rows[0]
  return row ? `→ ${row[1]}` : ''
}

const answerResult = ([answer, conf]: Answer) =>
  `→ ${answer}  ${conf.toFixed(2)}`

/** 머리 칸 제목의 "·" 뒤 — 프롬프트 첫 줄에 붙는 모델 이름. */
export const modelName = (head?: NodeDef) =>
  (head ? head.title.split('·').slice(1).join('·').trim() : '') || 'claude'

/** 단가 — 머리 칸 카드 값 "in $/M"·"out $/M"(없거나 숫자가 아니면 기본값). */
export const priceOf = (head?: NodeDef) => {
  const read = (key: string, fallback: number) => {
    const row = head
      ? head.rows.find(([k]) => k.trim().toLowerCase().indexOf(key) === 0)
      : undefined
    const v = row ? parseFloat(row[1].replace(/[^\d.]/g, '')) : NaN
    return isFinite(v) && v >= 0 ? v : fallback
  }
  return { in: read('in', PRICE.in), out: read('out', PRICE.out) }
}

/** 글의 토큰 — 한글이 섞인 글은 1.6자에 1토큰쯤으로 어림한다. */
export const textTokens = (lines: string[]) =>
  Math.round(lines.join('\n').length / 1.6)

/** 프롬프트 한 장 — 출력 노드의 칸 순서대로, 칸마다 [이 케이스만의 줄, 칸의
 * 기본 줄, 경로 노드 중 이 칸으로 오는 조각]을 모은다. 빈 칸은 건너뛴다. */
const compose = (
  layers: Layers,
  c: CaseDef,
  path: NodeDef[],
  results: Record<string, string>,
  hold: boolean,
) => {
  const head = layers[4][0]
  const sections = layers[4].slice(1)
  const out = [
    `# ${c.title.toLowerCase()} · ${modelName(head)}${hold ? '  [HOLD]' : ''}`,
  ]
  for (const s of sections) {
    const parts = [c.lines[s.id], s.prompt]
      .concat(
        path
          .filter((n) => n.feeds === s.id)
          .map((n) => n.prompt.split('{result}').join(plain(results[n.id]))),
      )
      .filter((p): p is string => !!p && p.trim() !== '')
    if (parts.length) out.push(s.title, ...parts.join('\n').split('\n'))
  }
  return out
}

/** 케이스 하나를 망에 통과시킨다 — 경로의 특징 답으로 게이트를 판정하고,
 * 프롬프트를 조합하고, 비용을 셈한다. 경로의 노드가 망에 없으면 던진다
 * (checkGraph를 통과한 망이면 없다). */
export const composeCase = (graph: Graph, c: CaseDef): Composed => {
  const byId: Record<string, NodeDef> = {}
  for (const layer of graph.layers) for (const n of layer) byId[n.id] = n
  const path = c.path.map((id) => {
    const n = byId[id]
    if (!n) throw new Error(`경로의 노드 ${id}가 망에 없습니다`)
    return n
  })
  const asked = c.answers[path[1].id]
  const confidence = asked ? asked[1] : c.confidence
  const hold = confidence < GATE
  const results: Record<string, string> = {}
  for (const n of path.slice(0, 3)) {
    const a = c.answers[n.id]
    results[n.id] = c.results[n.id] || (a ? answerResult(a) : fallbackResult(n))
  }
  const verdict = `${confidence.toFixed(2)} ${hold ? '<' : '≥'} ${GATE.toFixed(2)}`
  results[path[3].id] = `${verdict}   ${hold ? 'hold' : 'pass'}`
  const prompt = compose(graph.layers, c, path.slice(0, 4), results, hold)

  const price = priceOf(graph.layers[4][0])
  const text = textTokens(prompt)
  const attached = path
    .slice(0, 4)
    .reduce((sum, n) => sum + Math.max(0, n.tokens || 0), 0)
  const inTokens = text + attached
  const inCost = (inTokens / 1e6) * price.in
  const outCost = (c.outTokens / 1e6) * price.out
  const cost: Cost = {
    textTokens: text,
    attachedTokens: attached,
    inTokens,
    outTokens: c.outTokens,
    inCost,
    outCost,
    total: hold ? 0 : inCost + outCost,
    price,
  }
  results[HEAD_ID] = hold
    ? '→ hold · human review'
    : `→ ${fmtTokens(inTokens)} tok · ${fmtUsd(cost.total)}`
  return { confidence, hold, results, prompt, cost }
}

// ── 검사 ────────────────────────────────────────────────────────────────

/** 한 층에 둘 수 있는 노드 수(화면의 배치와 같다). */
export const MAX_NODES = 12
const MAX_TEXT = 4000

const isStr = (v: unknown, max = 200): v is string =>
  typeof v === 'string' && v.length <= max
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const checkNode = (v: unknown, where: string): string | null => {
  if (!isRecord(v)) return `${where}: 노드가 객체가 아닙니다`
  if (!isStr(v.id, 60) || !/^[a-z]+:[\w-]+$/.test(v.id))
    return `${where}: id가 "층:이름" 모양이 아닙니다`
  if (!isStr(v.title)) return `${v.id}: 제목이 없거나 깁니다`
  if (!isStr(v.prompt, MAX_TEXT))
    return `${v.id}: 프롬프트 조각이 없거나 깁니다`
  if (!isStr(v.feeds, 60)) return `${v.id}: 들어갈 칸이 없습니다`
  if (
    v.tokens !== undefined &&
    !(typeof v.tokens === 'number' && v.tokens >= 0)
  )
    return `${v.id}: 입력 토큰은 0 이상의 수여야 합니다`
  if (
    !Array.isArray(v.rows) ||
    v.rows.length > 3 ||
    !v.rows.every(
      (r) =>
        Array.isArray(r) &&
        isStr(r[0], 60) &&
        isStr(r[1], 120) &&
        (r[2] === undefined ||
          r[2] === null ||
          r[2] === 'accent' ||
          r[2] === 'white'),
    )
  )
    return `${v.id}: 카드 값 줄이 잘못됐습니다`
  return null
}

const checkCase = (v: unknown, i: number, ids: string[][]): string | null => {
  const where = `케이스 ${i + 1}`
  if (!isRecord(v)) return `${where}: 객체가 아닙니다`
  if (typeof v.id !== 'number' || !isStr(v.title) || !isStr(v.color, 20))
    return `${where}: id·제목·색이 잘못됐습니다`
  if (
    !Array.isArray(v.path) ||
    v.path.length !== 5 ||
    !v.path.every(
      (id, col) => typeof id === 'string' && ids[col].indexOf(id) >= 0,
    )
  )
    return `${where}: 경로는 층마다 그 층에 있는 노드 하나씩(5개)이어야 합니다`
  if (v.path[4] === HEAD_ID)
    return `${where}: 경로 끝은 머리 칸이 아닌 칸이어야 합니다`
  for (const key of ['results', 'lines'] as const) {
    const rec = v[key]
    if (
      !isRecord(rec) ||
      !Object.keys(rec).every((k) => isStr(rec[k], MAX_TEXT))
    )
      return `${where}: ${key}가 잘못됐습니다`
  }
  const answers = v.answers
  if (
    !isRecord(answers) ||
    !Object.keys(answers).every((k) => {
      const a = answers[k]
      return (
        Array.isArray(a) &&
        isStr(a[0], 120) &&
        typeof a[1] === 'number' &&
        a[1] >= 0 &&
        a[1] <= 1
      )
    })
  )
    return `${where}: 특징 답은 [답, 0~1 신뢰도]여야 합니다`
  for (const key of ['confidence', 'ms', 'outTokens'] as const) {
    if (
      typeof v[key] !== 'number' ||
      !isFinite(v[key] as number) ||
      (v[key] as number) < 0
    )
      return `${where}: ${key}는 0 이상의 수여야 합니다`
  }
  return null
}

/** 망이 이 모양을 지키는지 — 어긋나면 이유(한 줄), 맞으면 null. 서버는 저장·
 * 미리보기 전에, 화면은 저장해 둔 값을 읽을 때 쓴다. */
export const checkGraph = (v: unknown): string | null => {
  if (!isRecord(v)) return '망이 객체가 아닙니다'
  const { layers, cases } = v
  if (!Array.isArray(layers) || layers.length !== 5)
    return '층은 5개여야 합니다'
  const ids: string[][] = []
  const seen: Record<string, true> = {}
  for (let col = 0; col < 5; col++) {
    const layer = layers[col]
    if (!Array.isArray(layer) || layer.length < 1 || layer.length > MAX_NODES)
      return `${col + 1}번째 층은 노드가 1~${MAX_NODES}개여야 합니다`
    for (let row = 0; row < layer.length; row++) {
      const err = checkNode(layer[row], `${col + 1}층 ${row + 1}번`)
      if (err) return err
      const id = (layer[row] as NodeDef).id
      if (seen[id]) return `노드 id ${id}가 두 번 있습니다`
      seen[id] = true
    }
    ids.push(layer.map((n: NodeDef) => n.id))
  }
  if (ids[4][0] !== HEAD_ID) return `출력층 맨 위는 ${HEAD_ID}여야 합니다`
  if (!Array.isArray(cases) || cases.length < 1 || cases.length > 12)
    return '케이스는 1~12개여야 합니다'
  for (let i = 0; i < cases.length; i++) {
    const err = checkCase(cases[i], i, ids)
    if (err) return err
  }
  return null
}
