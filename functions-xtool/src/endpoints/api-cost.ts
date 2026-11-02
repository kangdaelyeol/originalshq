import { onRequest } from 'firebase-functions/https'
import { ApiCostReport, buildApiCostReport } from '../api-cost'
import { endpoint } from '../http'

// 같은 기간을 이 시간 안에 다시 물으면 BigQuery를 부르지 않고 받아 둔 것을
// 준다(인스턴스 메모리 — 화면을 켜 두고 1분마다 다시 받아도 조회는 몇 분에 한
// 번). 로그가 BigQuery에 들어오는 데도 1분쯤 걸려 이보다 자주 볼 이유가 없다.
const CACHE_MS = 3 * 60_000
const cache = new Map<number, ApiCostReport>()

// ────────────────────────────────
// getApiCosts — API 비용 분석(/log "비용 분석" 탭). ?days=N(기본 7, 최대 30)일
// 동안의 함수별·날짜별 합계와 비싼 호출. 재료는 cost-trace.ts가 남긴 호출별
// 로그(BigQuery ops_logs), 금액(단가)은 화면이 계산한다.
// ────────────────────────────────
export const getApiCosts = onRequest(
  { memory: '512MiB', timeoutSeconds: 120 },
  endpoint(
    {
      name: 'getApiCosts',
      method: 'GET',
      admin: true,
      onError: (error, response) => {
        // 확인용 화면이라 원인(권한·테이블 없음 등)을 그대로 돌려준다.
        response.status(502).send({
          error: error instanceof Error ? error.message : String(error),
        })
      },
    },
    async ({ request, response }) => {
      const days = Math.min(Math.max(Number(request.query.days) || 7, 1), 30)
      const cached = cache.get(days)
      if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
        response.status(200).send({ ...cached, cached: true })
        return
      }
      const report = await buildApiCostReport(days)
      cache.set(days, report)
      response.status(200).send({ ...report, cached: false })
    },
  ),
)
