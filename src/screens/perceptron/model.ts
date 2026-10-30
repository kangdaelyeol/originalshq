import { createContext, useContext, useSyncExternalStore } from 'react'
import {
  DEFAULT_CASES,
  DEFAULT_LAYERS,
  GATE,
  HEAD_ID,
  PRICE,
  type Answer,
  type CaseDef,
  type Layers,
  type NodeDef,
} from './data'
import { MAX_ROWS, createLayout, type Layout } from './geometry'
import { buildTimeline, type CaseTimeline } from './timeline'

// 편집할 수 있는 망 — 층마다 노드와 케이스 경로를 들고, 고칠 때마다 배치·
// 시간표·프롬프트·비용을 다시 만든다. 이 브라우저(localStorage)에만 저장된다.

export interface Graph {
  layers: Layers
  cases: CaseDef[]
}

export interface NodeAt {
  node: NodeDef
  col: number
  row: number
}

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

/** 아래 PARALLEL FEATURES 한 줄 — 특징 노드 하나의 답. */
export interface FeatureRow {
  id: string
  /** "Choice · hook_type"에서 "hook_type". */
  name: string
  /** Choice · Score · Flag — 막대 색. */
  kind: string
  answer: string | null
  conf: number
  /** 이 케이스가 지나는 질문 — 이 답의 신뢰도로 게이트를 판정한다. */
  onPath: boolean
}

/** 누가 결정했나 — 망(특징·인코더·게이트) · Claude · 코드(입력·조립·저장). */
export interface Split {
  net: number
  claude: number
  code: number
}

export interface CaseView {
  def: CaseDef
  timeline: CaseTimeline
  /** 경로가 지나는 특징 질문의 답 신뢰도(답이 없으면 케이스 기본값). */
  confidence: number
  /** 신뢰도가 게이트 아래 — 게이트·출력이 빨갛게, 프롬프트는 보류. */
  hold: boolean
  /** 켜진 카드 아래 결과 띠 — 경로 노드 id별(특징은 답에서, 게이트·머리는 계산). */
  results: Record<string, string>
  /** 출력 노드가 만든 프롬프트(줄 단위). */
  prompt: string[]
  cost: Cost
  features: FeatureRow[]
  split: Split
  subtitle: string[]
  log: [string, string][]
}

export interface Model {
  graph: Graph
  layout: Layout
  nodes: Map<string, NodeAt>
  cases: CaseView[]
  /** 저장 횟수(망 버전)와 마지막 저장 시각 — 기본값 그대로면 0·null. */
  meta: { version: number; savedAt: number | null }
}

/** '→ 결과 먼저  0.97' → '결과 먼저 0.97'. */
const plain = (s = '') => s.replace(/^→\s*/, '').replace(/\s+/g, ' ').trim()

/** 1 234 → '1.2k', 41 800 → '42k'. */
export const fmtTokens = (n: number) =>
  n >= 10000
    ? `${Math.round(n / 1000)}k`
    : n >= 1000
      ? `${(n / 1000).toFixed(1)}k`
      : `${n}`

/** 14:32 — 마지막 저장 시각. */
export const fmtTime = (at: number) =>
  new Date(at).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

/** 1센트 아래는 소수 셋째 자리까지. */
export const fmtUsd = (x: number) =>
  x > 0 && x < 0.01 ? `$${x.toFixed(3)}` : `$${x.toFixed(2)}`

/** 이 케이스에 적힌 결과가 없는 노드 — 강조한 값(없으면 첫 값)을 결과로 쓴다. */
export const fallbackResult = (n: NodeDef) => {
  const row = n.rows.find((r) => r[2] === 'accent') ?? n.rows[0]
  return row ? `→ ${row[1]}` : ''
}

const answerResult = ([answer, conf]: Answer) =>
  `→ ${answer}  ${conf.toFixed(2)}`

/** 머리 칸 제목의 "·" 뒤 — 프롬프트 첫 줄에 붙는 모델 이름. */
const modelName = (head?: NodeDef) =>
  head?.title.split('·').slice(1).join('·').trim() || 'claude'

/** 단가 — 머리 칸 카드 값 "in $/M"·"out $/M"(없거나 숫자가 아니면 기본값). */
const priceOf = (head?: NodeDef) => {
  const read = (key: string, fallback: number) => {
    const row = head?.rows.find(([k]) => k.trim().toLowerCase().startsWith(key))
    const v = row ? parseFloat(row[1].replace(/[^\d.]/g, '')) : NaN
    return Number.isFinite(v) && v >= 0 ? v : fallback
  }
  return { in: read('in', PRICE.in), out: read('out', PRICE.out) }
}

/** 글의 토큰 — 한글이 섞인 글은 1.6자에 1토큰쯤으로 어림한다. */
const textTokens = (lines: string[]) =>
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
  const [head, ...sections] = layers[4]
  const out = [
    `# ${c.title.toLowerCase()} · ${modelName(head)}${hold ? '  [HOLD]' : ''}`,
  ]
  for (const s of sections) {
    const parts = [
      c.lines[s.id],
      s.prompt,
      ...path
        .filter((n) => n.feeds === s.id)
        .map((n) => n.prompt.replaceAll('{result}', plain(results[n.id]))),
    ].filter((p): p is string => !!p && p.trim() !== '')
    if (parts.length) out.push(s.title, ...parts.join('\n').split('\n'))
  }
  return out
}

/** 패널에 보일 특징 질문 6개 — 층 순서대로, 경로가 지나는 질문은 꼭 넣는다. */
const FEATURE_ROWS = 6

const featureRows = (layer: NodeDef[], c: CaseDef): FeatureRow[] => {
  const rows = layer.map((n) => {
    const [kind, ...rest] = n.title.split('·')
    const a = c.answers[n.id]
    return {
      id: n.id,
      name: rest.join('·').trim() || n.title,
      kind: kind.trim(),
      answer: a ? a[0] : null,
      conf: a ? a[1] : 0,
      onPath: c.path[1] === n.id,
    }
  })
  const shown = rows.slice(0, FEATURE_ROWS)
  const picked = rows.find((r) => r.onPath)
  if (picked && !shown.includes(picked)) shown[FEATURE_ROWS - 1] = picked
  return shown
}

const viewCase = (
  graph: Graph,
  nodes: Map<string, NodeAt>,
  layout: Layout,
  c: CaseDef,
): CaseView => {
  const path = c.path.map((id) => nodes.get(id)!.node)
  const asked = c.answers[path[1].id]
  const confidence = asked ? asked[1] : c.confidence
  const hold = confidence < GATE
  const results: Record<string, string> = {}
  for (const n of path.slice(0, 3)) {
    const a = c.answers[n.id]
    results[n.id] = c.results[n.id] ?? (a ? answerResult(a) : fallbackResult(n))
  }
  const verdict = `${confidence.toFixed(2)} ${hold ? '<' : '≥'} ${GATE.toFixed(2)}`
  results[path[3].id] = `${verdict}   ${hold ? 'hold' : 'pass'}`
  const prompt = compose(graph.layers, c, path.slice(0, 4), results, hold)

  const head = graph.layers[4][0]
  const price = priceOf(head)
  const text = textTokens(prompt)
  const attached = path
    .slice(0, 4)
    .reduce((sum, n) => sum + Math.max(0, n.tokens ?? 0), 0)
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

  const features = graph.layers[1]
  const answered = features.filter((n) => c.answers[n.id]).length
  const sections = prompt.filter((l) => /^#{2}\s/.test(l)).length
  return {
    def: c,
    timeline: buildTimeline(c.path, layout),
    confidence,
    hold,
    results,
    prompt,
    cost,
    features: featureRows(features, c),
    // 망: 답한 특징 질문 + 인코더 + 게이트 / Claude: 통과하면 한 번 /
    // 코드: 입력 가져오기 + 칸 조립 + 저장.
    split: { net: answered + 2, claude: hold ? 0 : 1, code: sections + 2 },
    subtitle: [
      path[1].title,
      plain(results[path[1].id]),
      path[3].title,
      hold ? 'human review' : `prompt · ${fmtUsd(cost.total)}`,
    ],
    log: [
      ['in', `${path[0].title}  ${plain(results[path[0].id])}`],
      ['ask', path[1].title.replace(' · ', ' ')],
      ['hid', `→ ${plain(results[path[1].id])}  ${c.ms}ms`],
      ['gate', `${verdict}  ${hold ? 'hold' : 'pass'}`],
      [
        'out',
        hold
          ? `${path[4].title.replace(/^#+\s*/, '')} → human review`
          : `prompt ${fmtTokens(inTokens)} tok → ${fmtUsd(cost.total)}`,
      ],
    ],
  }
}

/** 망 → 화면에 필요한 것 전부. 노드 구성이 그대로면 배치는 다시 쓴다(섬유를
 * 새로 짜지 않게). */
export const buildModel = (
  graph: Graph,
  prev?: Model,
  meta: Model['meta'] = prev?.meta ?? { version: 0, savedAt: null },
): Model => {
  const columns = graph.layers.map((l) => l.map((n) => n.id))
  const key = columns.map((c) => c.join(',')).join('|')
  const layout = prev?.layout.key === key ? prev.layout : createLayout(columns)
  const nodes = new Map<string, NodeAt>()
  graph.layers.forEach((layer, col) =>
    layer.forEach((node, row) => nodes.set(node.id, { node, col, row })),
  )
  return {
    graph,
    layout,
    nodes,
    cases: graph.cases.map((c) => viewCase(graph, nodes, layout, c)),
    meta,
  }
}

// ── 고치기 ──────────────────────────────────────────────────────────────

/** 고친 뒤 망이 어긋나지 않게 — 경로는 층마다 있는 노드를 가리키고(지워졌으면
 * 그 층의 첫 노드로), 조각은 있는 칸으로 간다(없으면 첫 칸으로). */
const repair = (g: Graph): Graph => {
  const sections = g.layers[4].filter((s) => s.id !== HEAD_ID)
  const sectionIds = new Set(sections.map((s) => s.id))
  const layers = g.layers.map((layer, col) =>
    col === 4
      ? layer
      : layer.map((n) =>
          sectionIds.has(n.feeds) ? n : { ...n, feeds: sections[0]?.id ?? '' },
        ),
  )
  const cases = g.cases.map((c) => {
    const path = c.path.map((id, col) => {
      const layer = col === 4 ? sections : layers[col]
      return layer.some((n) => n.id === id) ? id : layer[0].id
    })
    return path.every((id, i) => id === c.path[i]) ? c : { ...c, path }
  })
  return { layers, cases }
}

const omit = <T>(o: Record<string, T>, key: string) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => k !== key))

export const editNode = (
  g: Graph,
  id: string,
  patch: Partial<NodeDef>,
): Graph => ({
  ...g,
  layers: g.layers.map((l) =>
    l.map((n) => (n.id === id ? { ...n, ...patch } : n)),
  ),
})

const PREFIX = ['in', 'ft', 'hd', 'gt', 'out']

/** 기둥 끝에 새 노드 — 새 id를 같이 돌려준다. */
export const addNode = (g: Graph, col: number): [Graph, string] => {
  const ids = new Set(g.layers.flat().map((n) => n.id))
  let k = 1
  while (ids.has(`${PREFIX[col]}:new${k}`)) k++
  const id = `${PREFIX[col]}:new${k}`
  const node: NodeDef =
    col === 4
      ? {
          id,
          title: `## new ${k}`,
          rows: [['note', '새 칸', 'accent']],
          prompt: '',
          feeds: '',
        }
      : {
          id,
          title: col === 1 ? `Choice · new_${k}` : `new node ${k}`,
          rows: [['key', 'value', 'accent']],
          prompt: '',
          feeds: 'out:context',
        }
  return [
    {
      ...g,
      layers: g.layers.map((l, i) =>
        i === col && l.length < MAX_ROWS ? [...l, node] : l,
      ),
    },
    id,
  ]
}

/** 노드를 지운다(머리 칸과 층의 마지막 하나는 남긴다) — 그 노드를 지나던
 * 경로는 그 층의 첫 노드로 옮겨진다. */
export const removeNode = (g: Graph, id: string): Graph => ({
  layers: g.layers.map((l) =>
    l.length > 1 && id !== HEAD_ID ? l.filter((n) => n.id !== id) : l,
  ),
  cases: g.cases.map((c) => ({
    ...c,
    results: omit(c.results, id),
    lines: omit(c.lines, id),
    answers: omit(c.answers, id),
  })),
})

const editCase = (g: Graph, slot: number, fn: (c: CaseDef) => CaseDef) => ({
  ...g,
  cases: g.cases.map((c, i) => (i === slot ? fn(c) : c)),
})

/** 이 케이스가 그 층에서 이 노드를 지나게. */
export const setPathStep = (g: Graph, slot: number, col: number, id: string) =>
  editCase(g, slot, (c) => ({
    ...c,
    path: c.path.map((p, k) => (k === col ? id : p)),
  }))

export const setCaseResult = (
  g: Graph,
  slot: number,
  id: string,
  text: string,
) =>
  editCase(g, slot, (c) => ({
    ...c,
    results: text ? { ...c.results, [id]: text } : omit(c.results, id),
  }))

export const setCaseLine = (g: Graph, slot: number, id: string, text: string) =>
  editCase(g, slot, (c) => ({
    ...c,
    lines: text ? { ...c.lines, [id]: text } : omit(c.lines, id),
  }))

/** 이 케이스 입력에 대한 특징 질문의 답(null이면 지운다). */
export const setCaseAnswer = (
  g: Graph,
  slot: number,
  id: string,
  answer: Answer | null,
) =>
  editCase(g, slot, (c) => ({
    ...c,
    answers: answer ? { ...c.answers, [id]: answer } : omit(c.answers, id),
  }))

/** 이 케이스 Claude 응답의 예상 토큰. */
export const setCaseOutTokens = (g: Graph, slot: number, outTokens: number) =>
  editCase(g, slot, (c) => ({ ...c, outTokens }))

// ── 저장 ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pn.graph.v1'

interface Saved {
  graph: Graph
  version: number
  savedAt: number
}

const defaults = (): Graph =>
  structuredClone({ layers: DEFAULT_LAYERS, cases: DEFAULT_CASES })

const isNode = (n: unknown): n is NodeDef => {
  if (!n || typeof n !== 'object') return false
  const v = n as NodeDef
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.prompt === 'string' &&
    typeof v.feeds === 'string' &&
    Array.isArray(v.rows) &&
    v.rows.every(
      (r) =>
        Array.isArray(r) &&
        typeof r[0] === 'string' &&
        typeof r[1] === 'string',
    )
  )
}

/** 저장된 값이 지금 구조와 맞는지 — 안 맞으면 기본값으로 시작한다. */
const isGraph = (g: unknown): g is Graph => {
  if (!g || typeof g !== 'object') return false
  const { layers, cases } = g as Graph
  return (
    Array.isArray(layers) &&
    layers.length === 5 &&
    layers.every((l) => Array.isArray(l) && l.length > 0 && l.every(isNode)) &&
    layers[4][0].id === HEAD_ID &&
    Array.isArray(cases) &&
    cases.length === DEFAULT_CASES.length &&
    cases.every(
      (c, i) =>
        !!c &&
        c.id === DEFAULT_CASES[i].id &&
        Array.isArray(c.path) &&
        c.path.length === 5 &&
        c.path.every((id) => typeof id === 'string') &&
        !!c.results &&
        !!c.lines,
    )
  )
}

/** 예전에 저장한 망 — 나중에 생긴 값(입력 토큰·특징 답·응답 토큰)은 기본값으로 채운다. */
const migrate = (g: Graph): Graph => {
  const tokens = new Map(
    DEFAULT_LAYERS.flat().map((n) => [n.id, n.tokens] as const),
  )
  return {
    layers: g.layers.map((l) =>
      l.map((n) =>
        n.tokens === undefined && tokens.get(n.id) !== undefined
          ? { ...n, tokens: tokens.get(n.id) }
          : n,
      ),
    ),
    cases: g.cases.map((c, i) => ({
      ...c,
      answers: c.answers ?? DEFAULT_CASES[i].answers,
      outTokens: c.outTokens ?? DEFAULT_CASES[i].outTokens,
    })),
  }
}

const load = (): Saved | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const v: unknown = raw ? JSON.parse(raw) : null
    // 처음엔 망만 저장했다 — 그때 것은 버전 1로 읽는다.
    const saved =
      v && typeof v === 'object' && 'graph' in v
        ? (v as Saved)
        : { graph: v as Graph, version: 1, savedAt: 0 }
    return isGraph(saved.graph)
      ? { ...saved, graph: repair(migrate(saved.graph)) }
      : null
  } catch {
    return null
  }
}

/** 망을 들고 있는 곳 — 고치면 모델을 다시 만들어 알리고, 손을 멈추면(0.25초)
 * 저장하며 버전을 올린다. */
export class GraphStore {
  private model: Model
  private listeners = new Set<() => void>()
  private saveTimer = 0

  constructor() {
    const saved = load()
    this.model = saved
      ? buildModel(saved.graph, undefined, {
          version: saved.version,
          savedAt: saved.savedAt || null,
        })
      : buildModel(defaults())
  }

  get = () => this.model

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  update(fn: (g: Graph) => Graph) {
    this.model = buildModel(repair(fn(this.model.graph)), this.model)
    this.emit()
    window.clearTimeout(this.saveTimer)
    this.saveTimer = window.setTimeout(() => this.save(), 250)
  }

  private save() {
    const meta = { version: this.model.meta.version + 1, savedAt: Date.now() }
    try {
      const saved: Saved = { graph: this.model.graph, ...meta }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    } catch {
      // 저장 공간을 못 쓰면 이 화면에서만 유지된다(버전은 그대로).
      return
    }
    this.model = { ...this.model, meta }
    this.emit()
  }

  /** 기본 목업으로 되돌린다. */
  reset() {
    window.clearTimeout(this.saveTimer)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // 저장 공간을 못 쓰면 지울 것도 없다.
    }
    this.model = buildModel(defaults(), undefined, {
      version: 0,
      savedAt: null,
    })
    this.emit()
  }

  private emit() {
    for (const fn of this.listeners) fn()
  }
}

export const useGraphModel = (store: GraphStore) =>
  useSyncExternalStore(store.subscribe, store.get)

export const ModelContext = createContext<Model | null>(null)

/** 화면 조각에서 지금 모델을 — PerceptronScreen이 넣어 준다. */
export const useModel = () => {
  const model = useContext(ModelContext)
  if (!model) throw new Error('useModel은 ModelContext 안에서만 쓴다')
  return model
}
