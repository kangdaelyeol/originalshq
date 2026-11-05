// 소재 유사도 — 프레임 지문(pHash)과 분석 결과의 컨셉으로 소재끼리 얼마나
// 겹치는지 재고, 겹치는 소재를 한 묶음(엔티티)으로 모은다. "안드로메다는 비슷한
// 소재를 한 광고처럼 다룬다"는 업계 해석을 가정으로 둔 것이다 — Meta 공식 글
// (2024-12-02, 2026-10-28)에는 그런 내용이 없어 Meta의 실제 판정과 같다고 볼 수
// 없다. 의존성 없는 계산만(읽기는 library.ts).
import {
  CONCEPT_WEIGHTS,
  FRAME_MATCH_BITS,
  SAME_ENTITY_MIN,
} from '../constants'
import { hashWords, popcount } from './phash'

/** 분석 결과(creatives/analyze.ts)에서 고른 컨셉 칸. */
export interface Concept {
  topic: string
  message: string
  /** 훅 방식(결과 먼저·문제 제기 등). */
  hook: string
  persona: string
  format: string
}

/** 비교할 소재 하나. */
export interface CreativePrint {
  id: string
  name: string
  /** 광고셋 키들 — '{채널}:adset:{ID}'. */
  adsetKeys: string[]
  /** 프레임 해시 — 지문을 아직 못 만든 소재는 비어 있다. */
  hashes: string[]
  /** 분석 전이면 null. */
  concept: Concept | null
}

export interface Similarity {
  /** 프레임 겹침(0~1) — 둘 중 하나라도 지문이 없으면 null. */
  visual: number | null
  /** 컨셉 겹침(0~1) — 둘 중 하나라도 분석 전이면 null. */
  concept: number | null
  /** 둘 중 큰 값 — 화면이든 컨셉이든 한쪽만 겹쳐도 겹친다고 본다. */
  score: number
}

/** 비교하기 좋게 미리 바꾼 소재 — 해시는 32비트 수 둘씩, 컨셉 칸은 글자 두
 * 개씩 묶음으로. 짝마다 다시 만들면 소재 240개(짝 2만 8천)에 27초가 걸렸다. */
interface Prepared {
  /** 해시 하나가 [앞, 뒤] 두 칸. */
  words: Uint32Array
  grams: Record<keyof Concept, Set<string>> | null
}

const CONCEPT_KEYS = Object.keys(CONCEPT_WEIGHTS) as (keyof Concept)[]

/** 글자 두 개씩(bigram) — 한글·영문·숫자만 남기고 소문자로. */
const bigrams = (text: string): Set<string> => {
  const s = text.toLowerCase().replace(/[^0-9a-z가-힣]+/g, '')
  const out = new Set<string>()
  if (s.length === 1) out.add(s)
  for (let i = 0; i + 1 < s.length; i++) out.add(s.slice(i, i + 2))
  return out
}

const prepare = (p: CreativePrint): Prepared => {
  const words = new Uint32Array(p.hashes.length * 2)
  p.hashes.forEach((h, i) => words.set(hashWords(h), i * 2))
  const concept = p.concept
  let grams: Prepared['grams'] = null
  if (concept) {
    grams = {} as Record<keyof Concept, Set<string>>
    for (const key of CONCEPT_KEYS) grams[key] = bigrams(concept[key])
  }
  return { words, grams }
}

/** from의 프레임 중 to에 거리 FRAME_MATCH_BITS 안의 짝이 있는 비율. */
const matchRate = (from: Uint32Array, to: Uint32Array) => {
  let matched = 0
  for (let i = 0; i < from.length; i += 2)
    for (let j = 0; j < to.length; j += 2)
      if (
        popcount((from[i] ^ to[j]) >>> 0) +
          popcount((from[i + 1] ^ to[j + 1]) >>> 0) <=
        FRAME_MATCH_BITS
      ) {
        matched++
        break
      }
  return matched / (from.length / 2)
}

/** 프레임 겹침 — 두 방향의 평균(다시 자른 짧은 영상은 한쪽 방향만 1이라
 * 평균이 된다). */
const visualOverlap = (a: Prepared, b: Prepared): number | null =>
  a.words.length && b.words.length
    ? (matchRate(a.words, b.words) + matchRate(b.words, a.words)) / 2
    : null

/** 겹침(Jaccard) — 둘 다 비었으면 null(그 칸은 빼고 무게를 다시 나눈다). */
const jaccard = (x: Set<string>, y: Set<string>): number | null => {
  if (!x.size && !y.size) return null
  let both = 0
  x.forEach((g) => {
    if (y.has(g)) both++
  })
  return both / (x.size + y.size - both)
}

/** 컨셉 칸마다 겹침의 가중 평균(CONCEPT_WEIGHTS). 같은 이야기를 다른 말로 쓴
 * 것은 낮게 나온다 — 의미까지 보려면 임베딩이 필요하다(아직 없다). */
const conceptOverlap = (a: Prepared, b: Prepared): number | null => {
  if (!a.grams || !b.grams) return null
  let sum = 0
  let weight = 0
  for (const key of CONCEPT_KEYS) {
    const j = jaccard(a.grams[key], b.grams[key])
    if (j === null) continue
    sum += j * CONCEPT_WEIGHTS[key]
    weight += CONCEPT_WEIGHTS[key]
  }
  return weight ? sum / weight : null
}

const comparePrepared = (a: Prepared, b: Prepared): Similarity => {
  const visual = visualOverlap(a, b)
  const concept = conceptOverlap(a, b)
  return { visual, concept, score: Math.max(visual ?? 0, concept ?? 0) }
}

/** 소재 둘의 겹침. */
export const compare = (a: CreativePrint, b: CreativePrint): Similarity =>
  comparePrepared(prepare(a), prepare(b))

export interface Neighbor extends Similarity {
  id: string
  name: string
}

export interface Library {
  total: number
  /** 묶음 수 — 겹치는 소재를 하나로 센 컨셉 수. */
  entities: number
  /** total − entities. */
  duplicates: number
  /** 소재 id → 묶음 id(묶음 대표 소재의 id). */
  entityOf: Record<string, string>
  /** 소재 id → 겹치는 순으로 다른 소재(점수 0은 뺀다). */
  neighbors: Record<string, Neighbor[]>
  /** 지문도 분석도 없어 비교하지 못한 소재 수 — 모두 혼자인 묶음으로 센다. */
  unmeasured: number
}

/** 소재 모두를 서로 비교해 묶는다 — 앞에서부터, 이미 있는 묶음의 대표(묶음의
 * 첫 소재)와 SAME_ENTITY_MIN 이상 겹치면 그 묶음에, 아니면 새 묶음의 대표가
 * 된다. 대표와 직접 겹치는 것만 묶어서 A~B, B~C라도 A·C가 다르면 사슬처럼
 * 이어지지 않는다. 소재가 수백 개라 모두 비교해도 된다. */
export const buildLibrary = (prints: CreativePrint[]): Library => {
  const n = prints.length
  const prepared = prints.map(prepare)
  const neighbors: Record<string, Neighbor[]> = {}
  for (const p of prints) neighbors[p.id] = []
  // 짝마다 점수 — [i * n + j].
  const scores = new Float64Array(n * n)
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const a = prints[i]
      const b = prints[j]
      const s = comparePrepared(prepared[i], prepared[j])
      scores[i * n + j] = scores[j * n + i] = s.score
      if (s.score <= 0) continue
      neighbors[a.id].push({ ...s, id: b.id, name: b.name })
      neighbors[b.id].push({ ...s, id: a.id, name: a.name })
    }
  const entityOf: Record<string, string> = {}
  const leaders: number[] = []
  prints.forEach((p, i) => {
    const leader = leaders.find((l) => scores[i * n + l] >= SAME_ENTITY_MIN)
    entityOf[p.id] = leader === undefined ? p.id : prints[leader].id
    if (leader === undefined) leaders.push(i)
    neighbors[p.id].sort((x, y) => y.score - x.score)
  })
  const entities = new Set(Object.values(entityOf)).size
  return {
    total: prints.length,
    entities,
    duplicates: prints.length - entities,
    entityOf,
    neighbors,
    unmeasured: prints.filter((p) => !p.hashes.length && !p.concept).length,
  }
}

/** 이 소재가 라이브러리의 다른 소재와 다른 정도(0~1) — 1 − 가장 높은 겹침. */
export const diversityOf = (library: Library, id: string): number => {
  const top = library.neighbors[id]?.[0]
  return 1 - (top ? top.score : 0)
}

/** 광고셋 하나의 소재 수와 묶음 수. */
export const adsetSpread = (
  library: Library,
  prints: CreativePrint[],
  adsetKey: string,
) => {
  const ids = prints
    .filter((p) => p.adsetKeys.indexOf(adsetKey) >= 0)
    .map((p) => p.id)
  return {
    total: ids.length,
    entities: new Set(ids.map((id) => library.entityOf[id])).size,
  }
}
