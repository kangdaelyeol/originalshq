/**
 * 프롬프트 망 저장소 — 퍼셉트론 화면에서 고치는 망을 Firestore에 둔다.
 *
 * - promptGraphs/default: 작업본. 화면이 손을 멈출 때마다 저장하고 version이
 *   하나씩 오른다. 저장할 때 화면이 알고 있던 version(baseVersion)이 지금과
 *   다르면 다른 곳에서 먼저 고친 것이라 거절한다(덮어쓰지 않게).
 * - promptGraphs/default/versions/{n}: 게시본. 게시하면 그때의 작업본이 그대로
 *   남고, 소재 분석 API는 마지막 게시본으로 프롬프트를 만든다.
 *
 * 망은 줄 값이 배열 안의 배열이라(Firestore가 못 담는다) JSON 문자열로 둔다.
 */
import type { DocumentData, DocumentReference } from 'firebase-admin/firestore'
import { db } from '../data'
import { checkGraph, type Graph } from './compose'

export class PromptGraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

interface GraphDoc {
  graphJson: string
  version: number
  savedAt: number
  publishedVersion?: number
  publishedAt?: number
}

export interface PromptGraphState {
  /** 작업본 — 아직 한 번도 저장하지 않았으면 null(화면은 기본 목업으로 시작). */
  draft: { graph: Graph; version: number; savedAt: number } | null
  /** 마지막 게시본 — 게시한 적 없으면 null. */
  published: { version: number; publishedAt: number } | null
}

/** 망 하나 — 지금은 xtool 소재 분석용 'default' 하나. */
const graphDoc = (): DocumentReference<DocumentData> =>
  db.collection('promptGraphs').doc('default')

const versionDoc = (version: number) =>
  graphDoc().collection('versions').doc(String(version))

const parse = (json: string): Graph => JSON.parse(json) as Graph

export async function getPromptGraphState(): Promise<PromptGraphState> {
  const snap = await graphDoc().get()
  if (!snap.exists) return { draft: null, published: null }
  const d = snap.data() as GraphDoc
  return {
    draft: {
      graph: parse(d.graphJson),
      version: d.version,
      savedAt: d.savedAt,
    },
    published: d.publishedVersion
      ? { version: d.publishedVersion, publishedAt: d.publishedAt ?? 0 }
      : null,
  }
}

/** 작업본 저장 — baseVersion은 화면이 마지막으로 받은(또는 저장한) 버전. */
export async function savePromptGraph(
  graph: unknown,
  baseVersion: number,
): Promise<{ version: number; savedAt: number }> {
  const error = checkGraph(graph)
  if (error) throw new PromptGraphError(error, 400)
  const graphJson = JSON.stringify(graph)
  if (graphJson.length > 500_000)
    throw new PromptGraphError('망이 너무 큽니다(500KB 이하)', 400)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(graphDoc())
    const current = snap.exists ? (snap.data() as GraphDoc).version : 0
    if (current !== baseVersion) {
      throw new PromptGraphError(
        `다른 곳에서 먼저 저장했습니다(지금 v${current}, 이 화면 v${baseVersion})`,
        409,
      )
    }
    const saved = { version: current + 1, savedAt: Date.now() }
    tx.set(graphDoc(), { graphJson, ...saved }, { merge: true })
    return saved
  })
}

/** 지금 작업본을 게시 — 소재 분석 API가 이 버전을 쓴다. */
export async function publishPromptGraph(): Promise<{
  version: number
  publishedAt: number
}> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(graphDoc())
    if (!snap.exists)
      throw new PromptGraphError(
        '저장된 망이 없습니다 — 먼저 고쳐서 저장하세요',
        400,
      )
    const d = snap.data() as GraphDoc
    const published = { version: d.version, publishedAt: Date.now() }
    tx.set(versionDoc(d.version), { graphJson: d.graphJson, ...published })
    tx.update(graphDoc(), {
      publishedVersion: published.version,
      publishedAt: published.publishedAt,
    })
    return published
  })
}

/** 미리보기·분석에 쓸 망 — 작업본이나 마지막 게시본. 없으면 null. */
export async function loadPromptGraph(
  source: 'draft' | 'published',
): Promise<{ graph: Graph; version: number } | null> {
  const snap = await graphDoc().get()
  if (!snap.exists) return null
  const d = snap.data() as GraphDoc
  if (source === 'draft')
    return { graph: parse(d.graphJson), version: d.version }
  if (!d.publishedVersion) return null
  const v = await versionDoc(d.publishedVersion).get()
  if (!v.exists) return null
  return {
    graph: parse((v.data() as GraphDoc).graphJson),
    version: d.publishedVersion,
  }
}
