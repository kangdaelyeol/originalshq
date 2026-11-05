import { createContext, useContext, useSyncExternalStore } from 'react'
import {
  checkGraph,
  composeCase,
  fallbackResult,
  fmtTokens,
  fmtUsd,
  GATE,
  plain,
  type Answer,
  type CaseDef,
  type Cost,
  type Graph,
  type NodeDef,
} from '../../../functions-cmip/src/prompt-graph/compose'
import { DEFAULT_CASES, DEFAULT_LAYERS, HEAD_ID } from './data'
import { MAX_ROWS, createLayout, type Layout } from './geometry'
import {
  getPromptGraph,
  publishPromptGraph,
  savePromptGraph,
} from './graph-client'
import { buildTimeline, type CaseTimeline } from './timeline'

// 편집할 수 있는 망 — 층마다 노드와 케이스 경로를 들고, 고칠 때마다 배치·
// 시간표·프롬프트·비용을 다시 만든다. 프롬프트·비용은 소재 분석 API와 같은
// 공용 모듈(composeCase)로 만든다. 망은 CMIP 서버에 저장되고(작업본·게시본),
// 서버에 못 닿으면 이 브라우저에 두었다가 다음에 올린다.

export type { Graph }
export { fallbackResult, fmtTokens, fmtUsd }

export interface NodeAt {
  node: NodeDef
  col: number
  row: number
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

/** 서버와 맞춰진 정도. */
export type SyncStatus =
  /** 서버에서 받는 중. */
  | 'loading'
  /** 서버 작업본과 같다. */
  | 'synced'
  /** 고쳤고 곧 저장한다. */
  | 'pending'
  | 'saving'
  /** 서버에 못 닿는다 — 이 브라우저에만 저장해 두었다. */
  | 'offline'
  /** 다른 곳에서 먼저 저장했다 — 불러오거나 덮어쓴다. */
  | 'conflict'

export interface Meta {
  /** 서버 작업본 버전(서버에 저장한 적 없으면 0). */
  version: number
  savedAt: number | null
  /** 마지막 게시본 — 소재 분석 API가 쓰는 망. */
  published: { version: number; publishedAt: number } | null
  status: SyncStatus
  /** 마지막으로 실패한 이유(오프라인·충돌·게시 실패). */
  error: string | null
}

export interface Model {
  graph: Graph
  layout: Layout
  nodes: Map<string, NodeAt>
  cases: CaseView[]
  meta: Meta
}

/** 14:32 — 저장·게시 시각. */
export const fmtTime = (at: number) =>
  new Date(at).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

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
  const composed = composeCase(graph, c)
  const { hold, results, prompt, cost } = composed
  // 입력 없이(목업) 만들면 늘 케이스의 답·기본 신뢰도로 잰다 — null이 아니다.
  const confidence = composed.confidence ?? c.confidence
  const path = c.path.map((id) => nodes.get(id)!.node)
  const verdict = `${confidence.toFixed(2)} ${hold ? '<' : '≥'} ${GATE.toFixed(2)}`
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
          : `prompt ${fmtTokens(cost.inTokens)} tok → ${fmtUsd(cost.total)}`,
      ],
    ],
  }
}

const EMPTY_META: Meta = {
  version: 0,
  savedAt: null,
  published: null,
  status: 'loading',
  error: null,
}

/** 망 → 화면에 필요한 것 전부. 노드 구성이 그대로면 배치는 다시 쓴다(섬유를
 * 새로 짜지 않게). */
export const buildModel = (
  graph: Graph,
  prev?: Model,
  meta: Meta = prev?.meta ?? EMPTY_META,
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

/** 이 브라우저의 사본 — 서버에 못 닿을 때 고친 것을 잃지 않게. */
const CACHE_KEY = 'pn.graph.v1'

interface Cache {
  graph: Graph
  /** 이 사본이 기댄 서버 버전. */
  version: number
  /** 서버에 아직 못 올린 수정이 있는지. */
  dirty?: boolean
}

const defaults = (): Graph =>
  structuredClone({ layers: DEFAULT_LAYERS, cases: DEFAULT_CASES })

/** 입력 노드의 예전 기본 조각(고정 문구) — 손대지 않았으면 새 기본 조각(실제
 * 소재 값이 들어가는 {이름} 자리 틀)으로 바꾼다. */
const OLD_INPUT_PROMPTS: Record<string, string> = {
  'in:video': '- 소재: F2U 듀얼레이저 영상 · 15.1s · 9:16 · 프레임 34장',
  'in:setting': '- 광고셋: 목표 문의 · 일 예산 50,000원 · 소재 세트 F2U 영상 B',
  'in:perf': '- 성과 14일: CPA 48,352원 · CTR 1.49% · CVR 0.75%',
  'in:test': '- 매체별 테스트: 구간 A가 CPA −11.8%',
  'in:landing': '- 랜딩: 무료 상담 오퍼 · CTA "상담 신청" · 로딩 2.1s',
  'in:audience': '- 오디언스: broad · 기존 고객 제외 · KR',
  'in:brand': '- 브랜드: 친근·전문 톤 · "최저가" 금지 · 로고는 3초 안',
  'in:library': '- 소재 라이브러리: 37개 · 컨셉 12개 · 중복 4개',
}

/** 예전 망 — 나중에 생긴 값(입력 토큰·특징 답·응답 토큰)은 기본값으로 채우고,
 * 손대지 않은 입력 조각은 새 틀로 바꾼다. */
const migrate = (g: Graph): Graph => {
  const base = new Map(DEFAULT_LAYERS.flat().map((n) => [n.id, n] as const))
  return {
    layers: g.layers.map((l) =>
      l.map((n) => {
        const d = base.get(n.id)
        let next = n
        if (n.tokens === undefined && d?.tokens !== undefined)
          next = { ...next, tokens: d.tokens }
        if (d && OLD_INPUT_PROMPTS[n.id] === n.prompt)
          next = { ...next, prompt: d.prompt }
        return next
      }),
    ),
    cases: g.cases.map((c, i) => ({
      ...c,
      answers: c.answers ?? DEFAULT_CASES[i]?.answers ?? {},
      outTokens: c.outTokens ?? DEFAULT_CASES[i]?.outTokens ?? 800,
    })),
  }
}

/** 받은 망을 화면에 쓸 수 있게 — 어긋나면 null. */
const usable = (g: unknown): Graph | null => {
  if (!g || typeof g !== 'object') return null
  try {
    const graph = repair(migrate(g as Graph))
    return checkGraph(graph) ? null : graph
  } catch {
    return null
  }
}

const readCache = (): Cache | null => {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    const v = raw ? (JSON.parse(raw) as Partial<Cache> & Graph) : null
    if (!v) return null
    // 처음엔 망만 저장했다 — 그때 것은 서버에 올린 적 없는 수정으로 본다.
    const graph = usable('graph' in v ? v.graph : v)
    if (!graph) return null
    return 'graph' in v
      ? { graph, version: v.version ?? 0, dirty: v.dirty }
      : { graph, version: 0, dirty: true }
  } catch {
    return null
  }
}

const writeCache = (cache: Cache) => {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // 저장 공간을 못 쓰면 서버에만 둔다.
  }
}

const reason = (err: unknown) =>
  err instanceof Error ? err.message : '서버에 닿지 않습니다'

const statusOf = (err: unknown) =>
  typeof err === 'object' && err && 'status' in err
    ? Number((err as { status: unknown }).status)
    : 0

/** 고치기를 멈추고 이만큼 지나면 서버에 올린다. */
const SAVE_DELAY = 600

/**
 * 망을 들고 있는 곳 — 처음엔 이 브라우저의 사본(없으면 기본 목업)으로 그리고,
 * 서버 작업본을 받으면 바꿔 그린다. 고치면 모델을 다시 만들어 알리고, 손을
 * 멈추면 서버에 저장한다(버전이 오른다). 다른 곳에서 먼저 저장했으면 덮어쓰지
 * 않고 'conflict'로 멈춘다.
 */
export class GraphStore {
  private model: Model
  private listeners = new Set<() => void>()
  private saveTimer = 0
  private saving = false
  /** 저장하는 동안 또 고쳤는지 — 끝나면 한 번 더 올린다. */
  private dirtyDuringSave = false
  private cache: Cache | null
  private started = false

  constructor() {
    this.cache = readCache()
    this.model = buildModel(this.cache?.graph ?? defaults(), undefined, {
      ...EMPTY_META,
      version: this.cache?.version ?? 0,
    })
  }

  /** 서버에서 받아 오기 시작 — 화면이 붙을 때 한 번만(개발 모드에서 저장소가
   * 두 번 만들어져도 쓰는 쪽만 서버와 말하게). */
  start() {
    if (this.started) return
    this.started = true
    void this.pull(this.cache)
  }

  get = () => this.model

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private setMeta(patch: Partial<Meta>) {
    this.model = { ...this.model, meta: { ...this.model.meta, ...patch } }
    this.emit()
  }

  /** 서버 작업본을 받아 온다. 사본에 못 올린 수정이 있고 서버가 그 뒤로 안
   * 바뀌었으면 그 수정을 올린다. */
  private async pull(cache: Cache | null) {
    try {
      const state = await getPromptGraph()
      const draft = state.draft
      const graph = draft ? usable(draft.graph) : null
      if (cache?.dirty && (draft?.version ?? 0) === cache.version) {
        // 이 브라우저에서 고친 게 최신이다 — 서버에 올린다.
        this.setMeta({ version: cache.version, published: state.published })
        this.schedule(0)
        return
      }
      if (draft && graph) {
        // 받은 망을 새 구조로 옮겼으면(예전 고정 조각 → 틀 등) 그대로 다시 저장한다.
        const changed = JSON.stringify(graph) !== JSON.stringify(draft.graph)
        this.model = buildModel(graph, this.model, {
          version: draft.version,
          savedAt: draft.savedAt,
          published: state.published,
          status: changed ? 'pending' : 'synced',
          error: null,
        })
        writeCache({ graph, version: draft.version, dirty: changed })
        this.emit()
        if (changed) this.schedule(0)
        return
      }
      this.setMeta({
        version: 0,
        published: state.published,
        status: 'synced',
        error: draft ? '서버 망 모양이 맞지 않아 기본 망으로 시작합니다' : null,
      })
    } catch (err) {
      this.setMeta({ status: 'offline', error: reason(err) })
    }
  }

  update(fn: (g: Graph) => Graph) {
    const graph = repair(fn(this.model.graph))
    const status =
      this.model.meta.status === 'conflict' ? 'conflict' : 'pending'
    this.model = buildModel(graph, this.model, { ...this.model.meta, status })
    writeCache({ graph, version: this.model.meta.version, dirty: true })
    this.emit()
    if (status === 'pending') this.schedule(SAVE_DELAY)
  }

  private schedule(delay: number) {
    window.clearTimeout(this.saveTimer)
    this.saveTimer = window.setTimeout(() => void this.push(), delay)
  }

  /** 지금 망을 서버에 저장한다. */
  private async push() {
    if (this.saving) {
      this.dirtyDuringSave = true
      return
    }
    this.saving = true
    this.dirtyDuringSave = false
    const graph = this.model.graph
    this.setMeta({ status: 'saving' })
    try {
      const saved = await savePromptGraph(graph, this.model.meta.version)
      const changed = this.model.graph !== graph
      this.setMeta({
        version: saved.version,
        savedAt: saved.savedAt,
        status: changed ? 'pending' : 'synced',
        error: null,
      })
      writeCache({
        graph: this.model.graph,
        version: saved.version,
        dirty: changed,
      })
      if (changed) this.schedule(SAVE_DELAY)
    } catch (err) {
      this.setMeta(
        statusOf(err) === 409
          ? { status: 'conflict', error: reason(err) }
          : { status: 'offline', error: reason(err) },
      )
    } finally {
      this.saving = false
      if (this.dirtyDuringSave) this.schedule(SAVE_DELAY)
    }
  }

  /** 오프라인이었으면 다시 올려 본다. */
  retry() {
    this.schedule(0)
  }

  /** 충돌 — 서버 것을 받아 이 화면의 수정을 버린다. */
  async takeServer() {
    window.clearTimeout(this.saveTimer)
    this.setMeta({ status: 'loading', error: null })
    await this.pull(null)
  }

  /** 충돌 — 서버 것 위에 이 화면의 망을 덮어쓴다. */
  async overwrite() {
    try {
      const state = await getPromptGraph()
      this.setMeta({
        version: state.draft?.version ?? 0,
        status: 'pending',
        error: null,
      })
      this.schedule(0)
    } catch (err) {
      this.setMeta({ status: 'offline', error: reason(err) })
    }
  }

  /** 지금 망을 게시 — 저장이 밀려 있으면 먼저 올리고 게시한다. 소재 분석 API가
   * 이 버전을 쓴다. */
  async publish() {
    const { status } = this.model.meta
    if (status === 'conflict' || status === 'loading') return
    if (status !== 'synced') {
      window.clearTimeout(this.saveTimer)
      await this.push()
      if (this.model.meta.status !== 'synced') return
    }
    try {
      const published = await publishPromptGraph()
      this.setMeta({ published, error: null })
    } catch (err) {
      this.setMeta({ error: `게시 실패 — ${reason(err)}` })
    }
  }

  /** 기본 목업으로 되돌린다 — 이것도 한 번의 수정이라 서버에 저장된다. */
  reset() {
    this.update(() => defaults())
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
