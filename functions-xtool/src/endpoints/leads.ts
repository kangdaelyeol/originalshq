import * as logger from 'firebase-functions/logger'
import { onRequest } from 'firebase-functions/https'
import { Lead } from '../types'
import {
  generateExternalId,
  generateRecordId,
  normalizeDomesticPhone,
  normalizeEmail,
} from '../utils'
import {
  validateCreateLead,
  validateDeleteLead,
  validateUpdateLeadEm,
  validateUpdateLeadFn,
  validateUpdateLeadRemarks,
  validateUpdateLeadTrackingField,
  valiedateUpdateLeadPhone,
} from '../validation'
import { db } from '../app'
import { endpoint, findLead } from '../http'

// ────────────────────────────────
// getAllLeads
// ────────────────────────────────
export const listLeads = onRequest(
  endpoint(
    { name: 'listLeads', method: 'GET', member: true },
    async ({ response }) => {
      // createdAt은 더 이상 리드 최상위 필드가 아니라(intakes 배열로 옮김)
      // orderBy 대상으로 못 쓴다 — Firestore는 orderBy 필드가 없는 문서를
      // 결과에서 아예 빼버리므로, 여기서 정렬하지 않고 프론트(sortLeads,
      // intakes 최신 시각 기준)에 맡긴다.
      const snapshot = await db.collection('lead').get()

      const leads: Lead[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Lead, 'id'>),
      }))

      response.status(200).send({ leads, count: leads.length })
    },
  ),
)

// ────────────────────────────────
// createLead
// ────────────────────────────────
export const createLead = onRequest(
  endpoint(
    {
      name: 'createLead',
      member: true,
      method: 'POST',
      validate: validateCreateLead,
      logLabel: '리드 생성 실패:',
    },
    async ({ response, data }) => {
      const input = data

      const digitsOnlyPhone = normalizeDomesticPhone(
        input.ph.replace(/\D/g, ''),
      )

      const leadData: Omit<Lead, 'id'> = {
        utm_campaign: input.utm_campaign ?? '',
        utm_medium: input.utm_medium ?? '',
        utm_source: input.utm_source ?? '',
        ip: input.ip ?? '',
        fbc: input.fbc ?? '',
        fbp: input.fbp ?? '',
        user_agent: input.user_agent ?? '',
        fn: input.fn ?? '',
        ph: digitsOnlyPhone,
        em: normalizeEmail(input.em ?? ''),
        remarks: input.remarks ?? '',
        // 최초 접수 1건 — device는 호출부가 보냈으면 그대로 싣는다(수기
        // 등록 모달처럼 기기 입력이 없는 호출부도 있어 optional).
        intakes: [
          {
            id: generateRecordId(),
            at: input.createdAt,
            ...(input.device ? { device: input.device } : {}),
          },
        ],
        consultations: [],
        purchases: [],
        externalId: generateExternalId(digitsOnlyPhone),
      }

      const docRef = await db.collection('lead').add(leadData)
      logger.info('리드 생성 완료:', docRef.id)

      response.status(201).send({ id: docRef.id, ...leadData })
    },
  ),
)

// ────────────────────────────────
// createLeadFromContact
// ────────────────────────────────

/** 홈페이지 폼이 보낸 접수 시각 — 브라우저 시계라 조금 어긋날 수 있지만, 하루
 * 넘게 지났거나 5분 넘게 앞서면 잘못된 값으로 보고 서버 시각을 쓴다. */
const plausibleSubmitTime = (at: number) => {
  const now = Date.now()
  return at >= now - 86_400_000 && at <= now + 5 * 60_000 ? at : now
}
export const createLeadFromContact = onRequest(
  endpoint(
    {
      name: 'createLeadFromContact',
      method: 'POST',
      validate: validateCreateLead,
      logLabel: '리드 생성 실패:',
    },
    async ({ request, response, data }) => {
      const input = data

      const digitsOnlyPhone = normalizeDomesticPhone(
        input.ph.replace(/\D/g, ''),
      )

      const ip =
        (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        request.ip ||
        ''
      const userAgent = request.headers['user-agent'] ?? ''

      const leadData: Omit<Lead, 'id'> = {
        utm_campaign: input.utm_campaign ?? '',
        utm_medium: input.utm_medium ?? '',
        utm_source: input.utm_source ?? '',
        ip,
        fbc: input.fbc ?? '',
        fbp: input.fbp ?? '',
        user_agent: userAgent,
        fn: input.fn ?? '',
        ph: digitsOnlyPhone,
        em: normalizeEmail(input.em ?? ''),
        remarks: input.remarks ?? '',
        // 최초 접수 1건 — device는 호출부가 보냈으면 그대로 싣는다. 시각은
        // 폼이 보낸 값이 그럴듯할 때만(로그인 없이 들어오는 요청이다).
        intakes: [
          {
            id: generateRecordId(),
            at: plausibleSubmitTime(input.createdAt),
            ...(input.device ? { device: input.device } : {}),
          },
        ],
        consultations: [],
        purchases: [],
        externalId: generateExternalId(digitsOnlyPhone),
        // 쿠키가 없으면(null/빈 값) 필드 자체를 뺀다 — contactLead가 없을 때
        // externalId로 대체한다.
        ...(input.ga4ClientId?.trim()
          ? { ga4ClientId: input.ga4ClientId.trim() }
          : {}),
      }

      const docRef = await db.collection('lead').add(leadData)
      logger.info('리드 생성 완료:', docRef.id)

      response.status(201).send({ id: docRef.id, ...leadData })
    },
  ),
)

// ────────────────────────────────
// updateLeadPhone
// ────────────────────────────────
export const updateLeadPhone = onRequest(
  endpoint(
    {
      name: 'updateLeadPhone',
      member: true,
      method: 'POST',
      validate: valiedateUpdateLeadPhone,
    },
    async ({ response, data }) => {
      const { id, ph } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

      const updateData = {
        ph,
        externalId: generateExternalId(ph),
      }

      await docRef.update(updateData)

      response.status(200).send({ id, ...snapshot.data(), ...updateData })
    },
  ),
)

// ────────────────────────────────
// updateLeadFn
// ────────────────────────────────
export const updateLeadFn = onRequest(
  endpoint(
    {
      name: 'updateLeadFn',
      method: 'POST',
      validate: validateUpdateLeadFn,
      member: true,
    },
    async ({ response, data }) => {
      const { id, fn } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

      await docRef.update({ fn })

      response.status(200).send({ id, ...snapshot.data(), fn })
    },
  ),
)

// ────────────────────────────────
// updateLeadEm — 이메일은 externalId(전화번호 해시)와 무관해서 updateLeadPhone
// 처럼 다시 만들 것이 없다. 이미 보낸 상담/구매 이벤트엔 반영되지 않으므로,
// 이메일을 나중에 채운 고객은 이력의 재전송(↻)으로 다시 보내야 em이 실린다.
// ────────────────────────────────
export const updateLeadEm = onRequest(
  endpoint(
    {
      name: 'updateLeadEm',
      method: 'POST',
      validate: validateUpdateLeadEm,
      member: true,
    },
    async ({ response, data }) => {
      const { id, em } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

      await docRef.update({ em })

      response.status(200).send({ id, ...snapshot.data(), em })
    },
  ),
)

// ────────────────────────────────
// updateLeadRemarks
// ────────────────────────────────
export const updateLeadRemarks = onRequest(
  endpoint(
    {
      name: 'updateLeadRemarks',
      member: true,
      method: 'POST',
      validate: validateUpdateLeadRemarks,
    },
    async ({ response, data }) => {
      const { id, remarks } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

      await docRef.update({ remarks })

      response.status(200).send({ id, ...snapshot.data(), remarks })
    },
  ),
)

// ────────────────────────────────
// updateLeadTrackingField — 유입경로/추적정보 섹션(utm_source/utm_medium/
// utm_campaign/ip/fbc/fbp/user_agent)의 자유 텍스트 필드. 전부 같은 모양이라
// updateLeadFn/updateLeadPhone/updateLeadRemarks처럼 필드마다 엔드포인트를
// 따로 두지 않고 field로 골라 하나로 처리한다.
// ────────────────────────────────
export const updateLeadTrackingField = onRequest(
  endpoint(
    {
      name: 'updateLeadTrackingField',
      member: true,
      method: 'POST',
      validate: validateUpdateLeadTrackingField,
    },
    async ({ response, data }) => {
      const { id, field, value } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

      await docRef.update({ [field]: value })

      response.status(200).send({ id, ...snapshot.data(), [field]: value })
    },
  ),
)

// ────────────────────────────────
// deleteLead
// ────────────────────────────────
export const deleteLead = onRequest(
  endpoint(
    {
      name: 'deleteLead',
      method: 'POST',
      validate: validateDeleteLead,
      member: true,
    },
    async ({ response, data }) => {
      const { id } = data

      const found = await findLead(response, id)
      if (!found) return
      await found.docRef.delete()

      logger.info('리드 삭제 완료:', id)

      response.status(200).send({ id, deleted: true })
    },
  ),
)
