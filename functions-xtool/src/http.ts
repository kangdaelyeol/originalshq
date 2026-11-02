// HTTP 함수의 공통 껍데기 — CORS, 허용 메서드 확인(405), 관리자 확인(401·403),
// 입력 검사(400), 실패 시 로그 + 500. 각 엔드포인트는 본 처리만 쓴다.
import cors from 'cors'
import type { Response } from 'express'
import * as logger from 'firebase-functions/logger'
import type { Request } from 'firebase-functions/https'
import { checkAdmin } from './admin-auth'
import { db } from './app'
import { traceRun } from './cost-trace'
import { ValidationResponse } from './types'

const corsHandler = cors({ origin: true })

type Method = 'GET' | 'POST'

interface EndpointOptions<T> {
  /** 함수 이름 — 실패 로그("<name> 처리 실패:")에 쓴다. */
  name: string
  /** 허용 메서드 — 그 밖은 405. */
  method: Method | Method[]
  /** 관리자만(/log) — Authorization: Bearer <Firebase ID 토큰>이 등록된
   * 관리자여야 한다(admin-auth.ts). 토큰이 없거나 만료면 401, 관리자가
   * 아니면 403. */
  admin?: boolean
  /** request.body 검사 — 실패하면 400 { error }, 통과하면 data로 넘긴다. */
  validate?: (body: Record<string, unknown>) => ValidationResponse<T>
  /** 실패 로그 문구를 바꿀 때만(기본 "<name> 처리 실패:"). */
  logLabel?: string
  /** 처리 중 예외의 응답을 바꿀 때만(기본 500 { error: '서버 오류' }). */
  onError?: (error: unknown, response: Response) => Promise<void> | void
}

/**
 * onRequest에 넘길 핸들러를 만든다.
 *
 *   export const updateLeadFn = onRequest(
 *     endpoint(
 *       { name: 'updateLeadFn', method: 'POST', validate: validateFn },
 *       async ({ data, response }) => { ... },
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
    }) => Promise<void>,
  ) =>
  (request: Request, response: Response): void =>
    // 호출마다 비용 추적(cost-trace.ts) — 핸들러가 끝나면 로그 한 줄. CORS
    // 사전 요청(OPTIONS)처럼 핸들러까지 오지 않고 끝난 응답은 응답이 끝날 때.
    traceRun(
      { fn: options.name, trigger: 'http', method: request.method },
      (trace) => {
        const endTrace = (error?: unknown) =>
          trace.end({
            status: response.statusCode,
            responseBytes: Number(response.getHeader('content-length') ?? 0),
            error,
          })
        let entered = false
        response.on('finish', () => {
          if (!entered) endTrace()
        })
        corsHandler(request, response, async () => {
          entered = true
          let failure: unknown
          try {
            const methods = ([] as Method[]).concat(options.method)
            if (!methods.includes(request.method as Method)) {
              response.status(405).send({ error: 'Method Not Allowed' })
              return
            }

            if (options.admin) {
              const access = await checkAdmin(request)
              if (!access.ok) {
                response.status(access.status).send({ error: access.error })
                return
              }
            }

            let data = undefined as T
            if (options.validate) {
              const validationRes = options.validate(request.body)
              if (!validationRes.ok) {
                response.status(400).send({ error: validationRes.error })
                return
              }
              data = validationRes.data
            }

            await run({ request, response, data })
          } catch (error) {
            failure = error
            logger.error(
              options.logLabel ?? `${options.name} 처리 실패:`,
              error,
            )
            if (options.onError) await options.onError(error, response)
            else response.status(500).send({ error: '서버 오류' })
          } finally {
            endTrace(failure)
          }
        })
      },
    )

/** 리드 문서를 찾는다 — 없으면 404 { error: 'lead not found' }를 보내고
 * null을 돌려준다(호출부는 그대로 return). */
export const findLead = async (response: Response, id: string) => {
  const docRef = db.collection('lead').doc(id)
  const snapshot = await docRef.get()

  if (!snapshot.exists) {
    response.status(404).send({ error: 'lead not found' })
    return null
  }

  return { docRef, snapshot }
}

/**
 * /log 화면의 이어 받기 기준(?since=) — 화면이 지난번 받은 응답의 fetchedAt
 * (서버 시각)을 보내면 그 뒤에 바뀐 것만 준다. 조회 기간 밖이거나 미래거나
 * 숫자가 아니면 null — 기간 전체를 다시 준다.
 */
export const parseSince = (
  value: unknown,
  windowStart: number,
  now: number,
): number | null => {
  const since = Number(value)
  return Number.isFinite(since) && since >= windowStart && since <= now
    ? since
    : null
}
