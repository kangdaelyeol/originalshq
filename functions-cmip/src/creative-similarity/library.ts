// 안드로메다 노드의 실제 값 — 이 광고 계정의 Meta 소재를 읽어(similarity.ts로
// 묶고) 퍼셉트론 노드 넷(in:library·ft:diversity·hd:concept·hd:andromeda)에
// 넣을 값을 만든다. 쓰기는 없다.
import { addDays, todayISO } from '../channel/utils/dates'
import { OVERLAP_LIST_MIN, SIMILARITY_ACTIVE_DAYS } from '../constants'
import { db } from '../data'
import type { ComposeInputs } from '../prompt-graph'
import { AD_CREATIVES, type AdCreative } from '../creatives/types'
import {
  adsetSpread,
  buildLibrary,
  diversityOf,
  type Concept,
  type CreativePrint,
  type Neighbor,
} from './similarity'

/** 이 값을 쓰는 노드 — 경로가 하나도 안 지나면 읽지 않아도 된다. */
export const LIBRARY_NODES = [
  'in:library',
  'ft:diversity',
  'hd:concept',
  'hd:andromeda',
]

const nameOf = (c: AdCreative) =>
  Object.values(c.ads)[0]?.name || c.upload?.fileName || c.id

const conceptOf = (c: AdCreative): Concept | null => {
  const r = c.analysis?.status === 'done' ? c.analysis.result : null
  return r
    ? {
        topic: r.topic,
        message: r.message,
        hook: r.hook.technique,
        persona: r.persona,
        format: r.format,
      }
    : null
}

export const printOf = (c: AdCreative): CreativePrint => ({
  id: c.id,
  name: nameOf(c),
  adsetKeys: c.adsetKeys,
  hashes: (c.media?.frames ?? [])
    .map((f) => f.phash)
    .filter((h): h is string => !!h),
  concept: conceptOf(c),
})

/** 처리된 Meta 소재 모두 — 수백 개라 한 번에 읽고 범위는 libraryInputs가 고른다. */
export async function loadMetaCreatives(): Promise<AdCreative[]> {
  const snap = await db
    .collection(AD_CREATIVES)
    .where('status', '==', 'ready')
    .where('channel', '==', 'meta')
    .get()
  return snap.docs.map((d) => d.data() as AdCreative)
}

/** 이 Meta 광고의 소재 — 광고 하나에 여럿이면 영상 먼저. */
export const creativeOfAd = (
  creatives: AdCreative[],
  adId: string,
): AdCreative | null => {
  const hits = creatives.filter((c) => !!c.ads[adId])
  return hits.find((c) => c.kind === 'video') ?? hits[0] ?? null
}

const fixed = (x: number) => x.toFixed(2)

/** "소재명 0.82(화면)" — 겹친 쪽을 괄호에(둘 다 재면 큰 쪽). */
const overlapLabel = (n: Neighbor) => {
  const by = (n.visual ?? -1) >= (n.concept ?? -1) ? '화면' : '컨셉'
  return `${n.name} ${fixed(n.score)}(${by})`
}

/**
 * 소재 하나(target)를 라이브러리와 견준 노드 값. 라이브러리는 같은 광고 계정의
 * Meta 소재 중 최근 SIMILARITY_ACTIVE_DAYS일 안에 집행한 것이고, target이 거기
 * 없으면(예전에 집행한 소재) 넣어서 견준다. 지문·분석이 없어 재지 못한 값은
 * 빈 vars로 둬서 프롬프트에 카드 값(목업)이 섞이지 않게 한다(compose.ts fill).
 */
export function libraryInputs(
  target: AdCreative,
  creatives: AdCreative[],
  notes: string[],
): ComposeInputs {
  const since = addDays(todayISO(), -(SIMILARITY_ACTIVE_DAYS - 1))
  const library = creatives.filter(
    (c) =>
      c.id !== target.id &&
      c.accountId === target.accountId &&
      c.lastSeenDate >= since,
  )
  const pool = [target, ...library]
  const prints = pool.map(printOf)
  const lib = buildLibrary(prints)
  const self = prints.find((p) => p.id === target.id)!
  const inputs: ComposeInputs = {}

  const adsetKey = target.adsetKeys[0]
  const spread = adsetKey ? adsetSpread(lib, prints, adsetKey) : null
  inputs['in:library'] = {
    result:
      `→ 컨셉 ${lib.entities} / 소재 ${lib.total}` +
      (spread ? ` · 광고셋 ${spread.entities} / ${spread.total}` : ''),
    vars: {
      total: String(lib.total),
      concepts: String(lib.entities),
      dupes: String(lib.duplicates),
    },
    // 라이브러리는 표·영상이 아니라 위의 글 줄로만 보낸다.
    tokens: 0,
  }
  if (lib.unmeasured)
    notes.push(
      `지문·분석이 없는 소재 ${lib.unmeasured}개는 비교하지 못해 혼자인 묶음으로 셌습니다`,
    )

  const measured = self.hashes.length > 0 || self.concept !== null
  if (!measured) {
    notes.push(
      '이 소재는 아직 프레임 지문도 분석도 없어 다양성을 재지 못했습니다',
    )
    inputs['ft:diversity'] = { vars: {} }
    inputs['hd:andromeda'] = { vars: {} }
  } else {
    const diversity = diversityOf(lib, target.id)
    const size = prints.filter(
      (p) => lib.entityOf[p.id] === lib.entityOf[target.id],
    ).length
    const top = lib.neighbors[target.id]
      .filter((n) => n.score >= OVERLAP_LIST_MIN)
      .slice(0, 3)
    inputs['ft:diversity'] = {
      result: `→ ${fixed(diversity)}`,
      // 코드가 잰 값이라 신뢰도는 1 — 게이트를 늘 통과한다.
      answer: [fixed(diversity), 1],
      vars: { vs: String(lib.total - 1) },
    }
    const entity = size > 1 ? `${size}개 묶음` : '혼자'
    inputs['hd:andromeda'] = {
      result: `→ ${entity} · ${fixed(diversity)}`,
      vars: {
        entity,
        diversity: fixed(diversity),
        overlaps: top.length ? top.map(overlapLabel).join(' · ') : '없음',
      },
    }
  }

  const concept = self.concept
  inputs['hd:concept'] = concept
    ? {
        result: `→ ${concept.topic}`,
        vars: { angle: concept.hook, format: concept.format },
      }
    : { vars: {} }
  if (!concept)
    notes.push(
      '이 소재는 아직 분석 전이라 컨셉 지문이 없습니다(소재 분석 버튼)',
    )

  return inputs
}
