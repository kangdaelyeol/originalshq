// HTTP 함수의 공통 껍데기 — CORS, 허용 메서드 확인(405), 로그인 확인(401·403),
// 입력 검사(400), 실패 응답(HttpError는 그 상태 코드, 그 밖은 로그 + 500). 각
// 엔드포인트는 본 처리만 쓴다. 비용 추적은 trace/functions.ts의 onRequest가 붙인다.
import cors from 'cors'
import type { Response } from 'express'
import * as logger from 'firebase-functions/logger'
import type { Request } from 'firebase-functions/v2/https'
import { checkAdmin } from './auth'
import type { ValidationResponse } from './types'
import { validateGetInsightBody } from './util'

// 사전 확인 요청(OPTIONS) 결과를 브라우저가 기억할 시간(초) — 로그인 토큰을 붙인 요청은
// 보내기 전에 브라우저가 "보내도 되는지" 한 번 더 묻는다(전체 요청의 약 31%였다). 그 답을
// 기억하게 해서 같은 주소로 다시 부를 때는 묻지 않게 한다. 브라우저마다 상한이 있다
// (Chrome 2시간, Firefox 24시간, Safari 10분 — 더 길게 줘도 각자 상한까지만 쓴다).
const corsHandler = cors({ origin: true, maxAge: 86_400 })

type Method = 'GET' | 'POST'

/** 처리 중에 던지면 그 상태 코드·문구로 응답한다(400·404 등 — 로그는 안
 * 남긴다). */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

/** 조회 API의 공통 입력 — ?dateStart=&dateEnd=(YYYY-MM-DD). */
export const insightQuery = (request: Request) =>
  validateGetInsightBody(request.query)

// 광고 성과 탭의 조회(광고 단위·광고그룹 단위) — 하루 × 광고(그룹)마다 문서라
// 기간이 길면 문서 수만 건을 읽고, 날짜가 비면 저장된 것을 전부 읽는다.
const AD_PERFORMANCE_MAX_DAYS = 500
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** insightQuery에 형식(YYYY-MM-DD)·순서·길이(최대 AD_PERFORMANCE_MAX_DAYS일)
 * 검사를 더한다. */
export const adPerformanceQuery = (
  request: Request,
): ValidationResponse<{ dateStart: string; dateEnd: string }> => {
  const query = insightQuery(request)
  if (!query.ok) return query
  const { dateStart, dateEnd } = query.data
  const start = Date.parse(dateStart)
  const end = Date.parse(dateEnd)
  if (
    !ISO_DATE.test(dateStart) ||
    !ISO_DATE.test(dateEnd) ||
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    dateStart > dateEnd
  ) {
    return {
      ok: false,
      error: 'dateStart·dateEnd는 YYYY-MM-DD이고 dateStart가 dateEnd보다 늦으면 안 됩니다',
    }
  }
  if ((end - start) / 86_400_000 + 1 > AD_PERFORMANCE_MAX_DAYS) {
    return {
      ok: false,
      error: `최대 ${AD_PERFORMANCE_MAX_DAYS}일까지 조회할 수 있습니다`,
    }
  }
  return query
}

interface EndpointOptions<T> {
  /** 허용 메서드 — 그 밖은 405. */
  method: Method | Method[]
  /** 입력 검사 — 실패하면 400 { error }, 통과하면 data로 넘긴다. */
  validate?: (request: Request) => ValidationResponse<T>
  /** 500 응답 문구 — 던진 값이 Error가 아닐 때만 쓴다(기본 '서버 오류'). */
  fallback?: string
  /** 로그인 없이 부를 수 있게 — Google·Cafe24가 부르는 OAuth 콜백만. 그 밖은
   * xtool 관리자의 ID 토큰이 있어야 한다(auth.ts — 없거나 만료면 401, 관리자가
   * 아니면 403). */
  public?: boolean
}

/**
 * onRequest에 넘길 핸들러를 만든다. 핸들러가 값을 돌려주면 200으로 보내고,
 * 다른 상태로 응답할 때는 response로 직접 보낸다(그때는 아무것도 안 돌려준다).
 *
 *   export const getCafe24Revenue = onRequest(
 *     endpoint(
 *       { method: 'GET', validate: insightQuery },
 *       ({ data }) => fetchCafe24Revenue(data.dateStart, data.dateEnd),
 *     ),
 *   )
 */
export const endpoint =
  <T = undefined>(
    options: EndpointOptions<T>,
    run: (context: {
      request: Request
      response: Response
      data: T
      /** 로그인한 관리자 메일 — public이면 null. */
      adminEmail: string | null
    }) => Promise<unknown>,
  ) =>
  (request: Request, response: Response): void =>
    corsHandler(request, response, async () => {
      try {
        const methods = ([] as Method[]).concat(options.method)
        if (!methods.includes(request.method as Method)) {
          response.status(405).send({ error: 'Method Not Allowed' })
          return
        }

        let adminEmail: string | null = null
        if (!options.public) {
          const auth = await checkAdmin(request)
          if (!auth.ok) {
            response.status(auth.status).send({ error: auth.error })
            return
          }
          adminEmail = auth.email
        }

        let data = undefined as T
        if (options.validate) {
          const validation = options.validate(request)
          if (!validation.ok) {
            response.status(400).send({ error: validation.error })
            return
          }
          data = validation.data
        }

        const body = await run({ request, response, data, adminEmail })
        if (body !== undefined && !response.headersSent) {
          response.status(200).send(body)
        }
      } catch (err) {
        if (err instanceof HttpError) {
          response.status(err.status).send({ error: err.message })
          return
        }
        logger.error('요청 처리 실패:', err)
        response.status(500).send({
          error:
            err instanceof Error
              ? err.message
              : (options.fallback ?? '서버 오류'),
        })
      }
    })
