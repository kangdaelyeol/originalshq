// cmip 함수 목록 — 엔드포인트는 endpoints/에 채널별로 있고, 여기서 모아 내보낸다
// (Firebase는 이 파일이 내보내는 이름을 함수 이름으로 배포한다). 비용 추적이
// 붙은 onRequest는 trace/functions.ts, 예약 동기화는 scheduled-sync.ts.
import cors from 'cors'
import * as logger from 'firebase-functions/logger'
import { metaAdsId } from './config'
import { gatherAdInputs } from './creative-analysis'
import { listMetaAdsForAnalysis } from './channel/meta/creatives'
import {
  PromptGraphError,
  checkGraph,
  composeCase,
  getPromptGraphState,
  loadPromptGraph,
  publishPromptGraph,
  savePromptGraph as savePromptGraphDoc,
  type Graph,
} from './prompt-graph'
import { onRequest } from './trace/functions'

export * from './endpoints/offline'
export * from './endpoints/meta'
export * from './endpoints/google'
export * from './endpoints/naver'
export * from './endpoints/openai'
export * from './endpoints/daangn'
export * from './endpoints/cafe24'
export * from './endpoints/ad-settings'
export * from './endpoints/creatives'
export * from './endpoints/platform-settings'
export * from './endpoints/ad-groups'

// 사전 확인 요청 결과를 브라우저가 기억할 시간(초) — http.ts와 같다.
const corsHandler = cors({ origin: true, maxAge: 86_400 })

function sendError(
  response: import('express').Response,
  status: number,
  message: string,
): void {
  response.status(status).send({ error: message })
}

// ────────────────────────────────
// 프롬프트 망 — 퍼셉트론 화면(/perceptron)에서 고치는 소재 분석 프롬프트의
// 설계도(prompt-graph/store.ts 주석 참고). 작업본은 화면이 손을 멈출 때마다
// 저장되고(버전), 게시하면 그 버전이 소재 분석 API가 쓰는 망이 된다.
// ────────────────────────────────

const sendPromptGraphError = (
  response: import('express').Response,
  err: unknown,
  fallback: string,
) => {
  if (err instanceof PromptGraphError) {
    sendError(response, err.status, err.message)
    return
  }
  sendError(response, 500, err instanceof Error ? err.message : fallback)
}

/** 작업본과 마지막 게시 정보(GET). 저장한 적 없으면 draft가 null. */
export const getPromptGraph = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    if (request.method !== 'GET') {
      sendError(response, 405, 'Method Not Allowed')
      return
    }
    try {
      response.status(200).send(await getPromptGraphState())
    } catch (err) {
      sendPromptGraphError(response, err, '프롬프트 망 조회 실패')
    }
  })
})

/** 저장·게시(POST) — { action: 'save', graph, baseVersion } |
 * { action: 'publish' }. 저장은 baseVersion이 지금 버전과 다르면 409. */
export const savePromptGraph = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    if (request.method !== 'POST') {
      sendError(response, 405, 'Method Not Allowed')
      return
    }
    const body = (request.body ?? {}) as Record<string, unknown>
    try {
      if (body.action === 'save') {
        if (typeof body.baseVersion !== 'number') {
          sendError(response, 400, 'baseVersion(수)이 필요합니다')
          return
        }
        const saved = await savePromptGraphDoc(body.graph, body.baseVersion)
        logger.info('프롬프트 망 저장:', saved.version)
        response.status(200).send(saved)
        return
      }
      if (body.action === 'publish') {
        const published = await publishPromptGraph()
        logger.info('프롬프트 망 게시:', published.version)
        response.status(200).send(published)
        return
      }
      sendError(response, 400, "action은 'save' 또는 'publish'")
    } catch (err) {
      sendPromptGraphError(response, err, '프롬프트 망 저장 실패')
    }
  })
})

/** 프롬프트 미리보기(POST) — Claude를 부르지 않고, 망으로 케이스마다 프롬프트·
 * 게이트 판정·비용만 만든다. { graph }를 주면 그 망(화면에서 아직 저장 전인
 * 것)으로, 아니면 { source: 'published'(기본) | 'draft' }의 저장된 망으로.
 * { caseIds }로 케이스를 고를 수 있다. { adId }(Meta 광고 ID)를 주면 그 광고의
 * 실제 입력(영상·문구·타겟팅·14일 성과·광고 설정·테스트)으로 만든다. */
export const previewPrompt = onRequest(
  { secrets: [metaAdsId] },
  (request, response) => {
    corsHandler(request, response, async () => {
      if (request.method !== 'POST') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      const body = (request.body ?? {}) as Record<string, unknown>
      try {
        let graph: Graph
        let version: number | null = null
        if (body.graph !== undefined) {
          const error = checkGraph(body.graph)
          if (error) {
            sendError(response, 400, error)
            return
          }
          graph = body.graph as Graph
        } else {
          const source = body.source === 'draft' ? 'draft' : 'published'
          const loaded = await loadPromptGraph(source)
          if (!loaded) {
            sendError(
              response,
              404,
              source === 'draft'
                ? '저장된 망이 없습니다'
                : '게시한 망이 없습니다',
            )
            return
          }
          graph = loaded.graph
          version = loaded.version
        }
        let gathered: Awaited<ReturnType<typeof gatherAdInputs>> | null = null
        if (body.adId !== undefined) {
          if (typeof body.adId !== 'string' || !/^\d{5,25}$/.test(body.adId)) {
            sendError(response, 400, 'adId는 Meta 광고 ID(숫자)여야 합니다')
            return
          }
          gathered = await gatherAdInputs(body.adId, metaAdsId.value())
        }
        const ids = Array.isArray(body.caseIds)
          ? body.caseIds.filter((id): id is number => typeof id === 'number')
          : null
        const cases = graph.cases
          .filter((c) => !ids || ids.indexOf(c.id) >= 0)
          .map((c) => ({
            id: c.id,
            title: c.title,
            ...composeCase(graph, c, gathered?.inputs),
          }))
        response.status(200).send({
          version,
          cases,
          ...(gathered
            ? {
                ad: gathered.ad,
                inputs: gathered.inputs,
                notes: gathered.notes,
              }
            : {}),
        })
      } catch (err) {
        sendPromptGraphError(response, err, '프롬프트 미리보기 실패')
      }
    })
  },
)

/** 소재 분석에 고를 광고 목록(GET) — 집행 중인 Meta 광고(계정마다 최대 50개). */
export const listAnalyzableAds = onRequest(
  { secrets: [metaAdsId] },
  (request, response) => {
    corsHandler(request, response, async () => {
      if (request.method !== 'GET') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      try {
        response
          .status(200)
          .send({ ads: await listMetaAdsForAnalysis(metaAdsId.value()) })
      } catch (err) {
        sendError(
          response,
          500,
          err instanceof Error ? err.message : '광고 목록 조회 실패',
        )
      }
    })
  },
)
