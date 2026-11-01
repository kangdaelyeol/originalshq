// 비용 추적이 붙은 onRequest·onSchedule — firebase-functions의 것과 똑같이 쓰고,
// 부를 때마다 cost-trace.ts의 측정 상자 안에서 핸들러를 돌린 뒤 로그 한 줄을
// 남긴다. index.ts는 import 한 줄만 이쪽으로 바꿨다(핸들러 코드는 그대로).
//
// 함수 이름은 실행 중 환경변수에서 읽는다 — Cloud Run에 배포된 2세대 함수는
// FUNCTION_TARGET에 내보낸 이름(previewCsv 등)이 들어 있다. 없으면 서비스
// 이름(K_SERVICE, 소문자)으로.
import type { Response } from 'express'
import {
  onRequest as baseOnRequest,
  type HttpsFunction,
  type HttpsOptions,
  type Request,
} from 'firebase-functions/v2/https'
import {
  onSchedule as baseOnSchedule,
  type ScheduledEvent,
  type ScheduleFunction,
  type ScheduleOptions,
} from 'firebase-functions/v2/scheduler'
import { traceRun, traced } from './cost-trace'

const fnName = () =>
  process.env.FUNCTION_TARGET ?? process.env.K_SERVICE ?? 'unknown'

type HttpHandler = (
  request: Request,
  response: Response,
) => void | Promise<void>

/** HTTP 핸들러 — 응답이 끝나면(상태 코드·응답 크기와 함께) 로그. */
const traceHttp =
  (handler: HttpHandler): HttpHandler =>
  (request, response) =>
    traceRun(
      { fn: fnName(), trigger: 'http', method: request.method },
      (trace) => {
        response.on('finish', () =>
          trace.end({
            status: response.statusCode,
            responseBytes: Number(response.getHeader('content-length') ?? 0),
          }),
        )
        return handler(request, response)
      },
    )

export function onRequest(handler: HttpHandler): HttpsFunction
export function onRequest(opts: HttpsOptions, handler: HttpHandler): HttpsFunction
export function onRequest(
  optsOrHandler: HttpsOptions | HttpHandler,
  handler?: HttpHandler,
): HttpsFunction {
  return handler
    ? baseOnRequest(optsOrHandler as HttpsOptions, traceHttp(handler))
    : baseOnRequest(traceHttp(optsOrHandler as HttpHandler))
}

type ScheduleHandler = (event: ScheduledEvent) => void | Promise<void>

/** 예약 실행 — 끝나면(성공·실패) 로그. */
export const onSchedule = (
  opts: ScheduleOptions | string,
  handler: ScheduleHandler,
): ScheduleFunction =>
  baseOnSchedule(
    opts as ScheduleOptions,
    (event: ScheduledEvent) =>
      traced(fnName(), 'schedule', async () => {
        await handler(event)
      })(),
  )
