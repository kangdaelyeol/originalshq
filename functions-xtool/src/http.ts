// HTTP 함수의 공통 껍데기 — CORS, 허용 메서드 확인(405), 입력 검사(400),
// 실패 시 로그 + 500. 각 엔드포인트는 본 처리만 쓴다.
import cors from 'cors'
import type { Response } from 'express'
import * as logger from 'firebase-functions/logger'
import type { Request } from 'firebase-functions/https'
import { db } from './app'
import { ValidationResponse } from './types'

const corsHandler = cors({ origin: true })

type Method = 'GET' | 'POST'

interface EndpointOptions<T> {
  /** 함수 이름 — 실패 로그("<name> 처리 실패:")에 쓴다. */
  name: string
  /** 허용 메서드 — 그 밖은 405. */
  method: Method | Method[]
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
    (request: Request, response: Response): void => {
      corsHandler(request, response, async () => {
        try {
          const methods = ([] as Method[]).concat(options.method)
          if (!methods.includes(request.method as Method)) {
            response.status(405).send({ error: 'Method Not Allowed' })
            return
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
          logger.error(options.logLabel ?? `${options.name} 처리 실패:`, error)
          if (options.onError) await options.onError(error, response)
          else response.status(500).send({ error: '서버 오류' })
        }
      })
    }

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
