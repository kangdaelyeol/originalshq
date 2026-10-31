/**
 * 프롬프트 망 클라이언트 — functions-cmip `getPromptGraph`(GET)·`savePromptGraph`
 * (POST 저장·게시)·`previewPrompt`(POST). 작업본은 저장할 때마다 버전이
 * 오르고, 저장할 때 알고 있던 버전(baseVersion)이 서버와 다르면 409로 거절된다
 * (functions-cmip/src/prompt-graph/store.ts).
 */
import { CallableError } from '@/screens/cmip/client/csv-client'
import { CMIP_API_BASE } from '@/screens/xtool-lead-manager/constants'
import type {
  ComposeInputs,
  Composed,
  Graph,
} from '../../../functions-cmip/src/prompt-graph/compose'

export interface PromptGraphState {
  /** 작업본 — 서버에 저장한 적 없으면 null. */
  draft: { graph: Graph; version: number; savedAt: number } | null
  /** 마지막 게시본 — 소재 분석 API가 쓰는 버전. */
  published: { version: number; publishedAt: number } | null
}

export interface PreviewResult {
  /** 저장된 망으로 만들었으면 그 버전, 넘긴 망이면 null. */
  version: number | null
  cases: (Composed & { id: number; title: string })[]
}

const call = async <T>(endpoint: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${CMIP_API_BASE}/${endpoint}`, init)
  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new CallableError(
      `${endpoint} 응답을 해석할 수 없습니다.`,
      res.status,
    )
  }
  if (!res.ok) {
    throw new CallableError(
      (body as { error?: string })?.error ??
        `${endpoint} 호출에 실패했습니다. (HTTP ${res.status})`,
      res.status,
    )
  }
  return body as T
}

const post = <T>(endpoint: string, body: unknown) =>
  call<T>(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export const getPromptGraph = () => call<PromptGraphState>('getPromptGraph')

/** 작업본 저장 — 다른 곳에서 먼저 저장했으면 status 409로 던진다. */
export const savePromptGraph = (graph: Graph, baseVersion: number) =>
  post<{ version: number; savedAt: number }>('savePromptGraph', {
    action: 'save',
    graph,
    baseVersion,
  })

/** 지금 작업본을 게시 — 소재 분석 API가 이 버전을 쓴다. */
export const publishPromptGraph = () =>
  post<{ version: number; publishedAt: number }>('savePromptGraph', {
    action: 'publish',
  })

/** 서버에서 만든 프롬프트(Claude 호출 없음) — 넘긴 망으로. */
export const previewPrompt = (graph: Graph, caseIds?: number[]) =>
  post<PreviewResult>('previewPrompt', { graph, caseIds })

/** 소재 분석에 고를 광고 — functions-cmip listAnalyzableAds. */
export interface AdListItem {
  adId: string
  adName: string
  adsetName: string
  accountId: string
  thumbnailUrl: string | null
  hasVideo: boolean
}

export const listAnalyzableAds = () =>
  call<{ ads: AdListItem[] }>('listAnalyzableAds')

/** 실제 소재로 만든 미리보기 — 광고와 노드별로 모은 값, 못 모은 이유. */
export interface AdPreviewResult extends PreviewResult {
  ad: {
    id: string
    name: string
    adsetId: string
    campaignId: string
    thumbnailUrl: string | null
    hasVideo: boolean
    frameTimes: number[]
  }
  inputs: ComposeInputs
  notes: string[]
}

/** Meta 광고 하나의 실제 입력(영상·문구·타겟팅·성과·설정·테스트)으로 만든
 * 프롬프트 — Claude는 부르지 않는다. */
export const previewAdPrompt = (
  graph: Graph,
  adId: string,
  caseIds: number[],
) => post<AdPreviewResult>('previewPrompt', { graph, adId, caseIds })
