import { onRequest } from 'firebase-functions/https'
import {
  deleteInquiries,
  getInquirySettings,
  listInquiries,
  retryInquiryStep,
  saveInquirySettings,
  submitInquiry as processInquiry,
  validateInquiry,
} from '../inquiry'
import { db, mondayApiKey, solapiApiKey, solapiApiSecret } from '../app'
import { endpoint } from '../http'

// ────────────────────────────────
// 웹사이트 상담 신청 — 예전 Zapier 자동화(Monday 보드 등록 + 접수 안내 문자)를
// 대신한다(inquiry/index.ts). 폼이 브라우저에서 바로 부른다(그래야 고객의
// IP·브라우저 정보가 잡힌다).
// ────────────────────────────────
const inquirySecrets = () => ({
  mondayApiKey: mondayApiKey.value(),
  solapiApiKey: solapiApiKey.value(),
  solapiApiSecret: solapiApiSecret.value(),
})

export const submitInquiry = onRequest(
  // 바깥 API 재시도(최대 3번 × 10초 + 대기)까지 기다릴 수 있게 넉넉히.
  {
    secrets: [mondayApiKey, solapiApiKey, solapiApiSecret],
    timeoutSeconds: 120,
  },
  endpoint(
    { name: 'submitInquiry', method: 'POST' },
    async ({ request, response }) => {
      const validation = validateInquiry(request.body)
      if (!validation.ok) {
        response.status(400).send({ error: validation.error })
        return
      }
      const ip =
        (request.headers['x-forwarded-for'] as string)
          ?.split(',')[0]
          ?.trim() ||
        request.ip ||
        ''
      const { inquiry, duplicate } = await processInquiry(
        db,
        validation.data,
        { ip, userAgent: request.headers['user-agent'] ?? '' },
        inquirySecrets(),
      )
      // 폼에는 접수 여부만 알려 준다(내부 처리 결과는 접수 로그 화면에서).
      response
        .status(duplicate ? 200 : 201)
        .send({ id: inquiry.id, duplicate })
    },
  ),
)

// listInquiries — 접수 로그 화면. ?days=N(기본 7, 최대 90)일 안의 문의.
export const listInquiryLogs = onRequest(
  endpoint(
    { name: 'listInquiryLogs', method: 'GET' },
    async ({ request, response }) => {
      const days = Math.min(Math.max(Number(request.query.days) || 7, 1), 90)
      const inquiries = await listInquiries(db, Date.now() - days * 86_400_000)
      response.status(200).send({ inquiries, days, fetchedAt: Date.now() })
    },
  ),
)

// retryInquiry — 실패한 단계(monday | sms)를 다시 실행. body: { id, step }
export const retryInquiry = onRequest(
  // 바깥 API 재시도(최대 3번 × 10초 + 대기)까지 기다릴 수 있게 넉넉히.
  {
    secrets: [mondayApiKey, solapiApiKey, solapiApiSecret],
    timeoutSeconds: 120,
  },
  endpoint(
    {
      name: 'retryInquiry',
      method: 'POST',
      onError: (error, response) => {
        response.status(400).send({
          error: error instanceof Error ? error.message : '서버 오류',
        })
      },
    },
    async ({ request, response }) => {
      const { id, step } = (request.body ?? {}) as {
        id?: unknown
        step?: unknown
      }
      if (typeof id !== 'string' || (step !== 'monday' && step !== 'sms')) {
        response.status(400).send({ error: 'id와 step(monday|sms)이 필요합니다' })
        return
      }
      const inquiry = await retryInquiryStep(db, id, step, inquirySecrets())
      response.status(200).send({ inquiry })
    },
  ),
)

// inquirySettings — 문자 발송 설정. GET은 조회, POST는 저장
// (body: { smsEnabled, senderNumber, template, subject }).
export const inquirySettings = onRequest(
  endpoint(
    {
      name: 'inquirySettings',
      method: ['GET', 'POST'],
      onError: (error, response) => {
        response.status(400).send({
          error: error instanceof Error ? error.message : '서버 오류',
        })
      },
    },
    async ({ request, response }) => {
      if (request.method === 'GET') {
        response.status(200).send({ settings: await getInquirySettings(db) })
        return
      }
      const settings = await saveInquirySettings(db, request.body)
      response.status(200).send({ settings })
    },
  ),
)

// deleteInquiryLogs — 접수 기록 선택 삭제. body: { ids: string[] }(최대 500).
// Monday 아이템·보낸 문자는 지우지 않는다.
export const deleteInquiryLogs = onRequest(
  endpoint(
    { name: 'deleteInquiryLogs', method: 'POST' },
    async ({ request, response }) => {
      const { ids } = (request.body ?? {}) as { ids?: unknown }
      if (
        !Array.isArray(ids) ||
        ids.length === 0 ||
        ids.length > 500 ||
        !ids.every((id) => typeof id === 'string' && id.length > 0)
      ) {
        response
          .status(400)
          .send({ error: 'ids는 문자열 1~500개 배열이어야 합니다' })
        return
      }
      const deleted = await deleteInquiries(db, ids as string[])
      response.status(200).send({ deleted })
    },
  ),
)
