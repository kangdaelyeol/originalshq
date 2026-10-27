import { onRequest } from 'firebase-functions/https'
import {
  listUsageSegments,
  parseUsageSegments,
  saveUsageSegments,
} from '../usage'
import { listBatchRuns } from '../batch-log'
import { db } from '../app'
import { endpoint } from '../http'

// ────────────────────────────────
// logUsage — 사용 분석 수집(xtool-lead-manager·cmip 화면이 보낸다). 창을 닫을
// 때도 빠지지 않도록 화면은 navigator.sendBeacon으로 보내는데, beacon은
// text/plain 본문이라(JSON 형식은 CORS 사전 요청이 필요해 beacon으로 못 보낸다)
// 본문을 직접 JSON으로 푼다. 응답 본문은 쓰지 않는다.
// ────────────────────────────────
export const logUsage = onRequest(
  endpoint(
    { name: 'logUsage', method: 'POST' },
    async ({ request, response }) => {
      let body: unknown = request.body
      if (typeof body === 'string' || !body || Buffer.isBuffer(body)) {
        try {
          body = JSON.parse(request.rawBody?.toString('utf8') ?? '')
        } catch {
          response.status(400).send({ error: '본문을 해석할 수 없습니다' })
          return
        }
      }
      const segments = parseUsageSegments(body, Date.now())
      await saveUsageSegments(db, segments)
      response.status(204).send()
    },
  ),
)

// ────────────────────────────────
// getUsageSegments — 사용 분석 기록(/log). ?days=N(기본 7, 최대 90)일 안에
// 시작한 탭 방문을 최근 것부터 최대 20,000건.
// ────────────────────────────────
export const getUsageSegments = onRequest(
  { memory: '512MiB' },
  endpoint(
    { name: 'getUsageSegments', method: 'GET' },
    async ({ request, response }) => {
      const days = Math.min(
        Math.max(Number(request.query.days) || 7, 1),
        90,
      )
      const segments = await listUsageSegments(
        db,
        Date.now() - days * 86_400_000,
        20_000,
      )
      response.status(200).send({ segments, days, fetchedAt: Date.now() })
    },
  ),
)

// ────────────────────────────────
// getBatchRuns — 배치(예약 실행) 함수들의 실행 기록(/log 화면). xtool과 cmip
// 두 코드베이스가 같은 batchRuns 컬렉션에 쌓으므로 여기 하나에서 같이 준다.
// ?days=N(기본 7, 최대 90)일 안의 기록을 최근 것부터 최대 2,000건.
// ────────────────────────────────
export const getBatchRuns = onRequest(
  endpoint(
    { name: 'getBatchRuns', method: 'GET' },
    async ({ request, response }) => {
      const days = Math.min(
        Math.max(Number(request.query.days) || 7, 1),
        90,
      )
      const runs = await listBatchRuns(
        db,
        Date.now() - days * 86_400_000,
        2_000,
      )
      response.status(200).send({ runs, days, fetchedAt: Date.now() })
    },
  ),
)
