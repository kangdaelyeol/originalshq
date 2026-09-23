import cors from 'cors'
import * as logger from 'firebase-functions/logger'
import { setGlobalOptions } from 'firebase-functions'
import { onRequest } from 'firebase-functions/https'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { ConsultationRecord, IntakeRecord, Lead, PurchaseRecord } from './types'
import { DEVICE_EXPECTED_VALUE, sendMetaEvent } from './meta'
import {
  generateEventId,
  generateExternalId,
  generateRecordId,
  normalizeDomesticPhone,
} from './utils'
import {
  hasExternalId,
  validateContactLead,
  validateCreateLead,
  validateDeleteLead,
  validateDeleteRecord,
  validatePurchaseLead,
  validateResendConsultation,
  validateUpdateConsultation,
  validateUpdateIntake,
  validateUpdateLeadFn,
  validateUpdateLeadRemarks,
  validateUpdatePurchase,
  valiedateUpdateLeadPhone,
} from './validation'

initializeApp()

const db = getFirestore('xtool-read')
const corsHandler = cors({ origin: true })
setGlobalOptions({ maxInstances: 10 })

const metaPixelId = defineSecret('META_PIXEL_ID')
const metaAccessToken = defineSecret('META_ACCESS_TOKEN')

// ────────────────────────────────
// getAllLeads
// ────────────────────────────────
export const listLeads = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'GET') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

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
    } catch (error) {
      logger.error('listLeads 처리 실패:', error)
      response.status(500).send({ error: '서버 오류' })
    }
  })
})

// ────────────────────────────────
// createLead
// ────────────────────────────────
export const createLead = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const validationRes = validateCreateLead(request.body)
      if (!validationRes.ok) {
        response.status(400).send({ error: validationRes.error })
        return
      }

      const input = validationRes.data

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
    } catch (error) {
      logger.error('리드 생성 실패:', error)
      response.status(500).send({ error: '서버 오류' })
    }
  })
})

// ────────────────────────────────
// createLeadFromContact
// ────────────────────────────────
export const createLeadFromContact = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const validationRes = validateCreateLead(request.body)
      if (!validationRes.ok) {
        response.status(400).send({ error: validationRes.error })
        return
      }

      const input = validationRes.data

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
        remarks: input.remarks ?? '',
        // 최초 접수 1건 — device는 호출부가 보냈으면 그대로 싣는다.
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
    } catch (error) {
      logger.error('리드 생성 실패:', error)
      response.status(500).send({ error: '서버 오류' })
    }
  })
})

// ────────────────────────────────
// contactLead — 상담 1건 등록(배열에 추가). 등록할 때마다 Meta "Contact" CAPI를
// 전송한다 — 재상담 고객도 매번 추적 대상이라 더 이상 "최초 1건만" 게이트를
// 두지 않는다.
// ────────────────────────────────
export const contactLead = onRequest(
  { secrets: [metaPixelId, metaAccessToken] },
  (request, response) => {
    corsHandler(request, response, async () => {
      try {
        if (request.method !== 'POST') {
          response.status(405).send({ error: 'Method Not Allowed' })
          return
        }

        const validationRes = validateContactLead(request.body)

        if (!validationRes.ok) {
          response.status(400).send({ error: validationRes.error })
          return
        }

        const { id, device, at, testEventCode } = validationRes.data

        const docRef = db.collection('lead').doc(id)
        const snapshot = await docRef.get()

        if (!snapshot.exists) {
          response.status(404).send({ error: 'lead not found' })
          return
        }

        const lead = snapshot.data() as Omit<Lead, 'id'>

        if (!lead.ph) {
          response.status(400).send({ error: 'lead has no ph to contact' })
          return
        }

        const hasEid = hasExternalId(lead)
        if (!hasEid) lead.externalId = generateExternalId(lead.ph)

        const eventTimeMs = at ?? Date.now()
        const eventId = generateEventId()

        const capiResult = await sendMetaEvent({
          pixelId: metaPixelId.value(),
          accessToken: metaAccessToken.value(),
          eventName: 'Contact',
          lead,
          testEventCode,
          customData: {
            currency: 'KRW',
            value: DEVICE_EXPECTED_VALUE[device],
          },
          eventTimeMs,
          eventId,
        })

        if (!capiResult.ok) {
          response
            .status(502)
            .send({ error: 'Meta CAPI 전송 실패', detail: capiResult.result })
          return
        }

        const record: ConsultationRecord = {
          id: generateRecordId(),
          at: eventTimeMs,
          device,
          externalId: lead.externalId,
          eventId,
        }
        // Firestore는 배열 원소를 부분 수정할 수 없어, 전체를 읽어 append한
        // 뒤 통째로 되쓴다(data/importer.ts의 read-modify-write와 같은 결).
        const consultations = [...(lead.consultations ?? []), record]

        await docRef.update({
          consultations,
          externalId: lead.externalId ?? '',
        })

        logger.info('contactLead 성공:', {
          leadId: id,
          recordId: record.id,
          device,
          at: new Date(record.at).toISOString(),
          actionSource: capiResult.actionSource,
          eventId: capiResult.eventId,
          externalId: lead.externalId,
          testEventCode: testEventCode ?? null,
        })

        response.status(200).send({
          id: snapshot.id,
          ...lead,
          consultations,
        })
      } catch (error) {
        logger.error('contactLead 처리 실패:', error)
        response.status(500).send({ error: '서버 오류' })
      }
    })
  },
)

// ────────────────────────────────
// purchaseLead — 구매 1건 등록(배열에 추가). contactLead와 같은 이유로 등록할
// 때마다 Meta "Purchase" CAPI를 전송한다.
// ────────────────────────────────
export const purchaseLead = onRequest(
  { secrets: [metaPixelId, metaAccessToken] },
  (request, response) => {
    corsHandler(request, response, async () => {
      try {
        if (request.method !== 'POST') {
          response.status(405).send({ error: 'Method Not Allowed' })
          return
        }

        const validationRes = validatePurchaseLead(request.body)

        if (!validationRes.ok) {
          response.status(400).send({ error: validationRes.error })
          return
        }

        const { id, device, price, at, testEventCode } = validationRes.data

        const docRef = db.collection('lead').doc(id)
        const snapshot = await docRef.get()

        if (!snapshot.exists) {
          response.status(404).send({ error: 'lead not found' })
          return
        }

        const lead = snapshot.data() as Omit<Lead, 'id'>

        const hasEid = hasExternalId(lead)
        if (!hasEid) lead.externalId = generateExternalId(lead.ph)

        const eventTimeMs = at ?? Date.now()
        const eventId = generateEventId()

        const capiResult = await sendMetaEvent({
          pixelId: metaPixelId.value(),
          accessToken: metaAccessToken.value(),
          eventName: 'Purchase',
          lead,
          testEventCode,
          customData: { currency: 'KRW', value: price },
          eventTimeMs,
          eventId,
        })

        if (!capiResult.ok) {
          response
            .status(502)
            .send({ error: 'Meta CAPI 전송 실패', detail: capiResult.result })
          return
        }

        const record: PurchaseRecord = {
          id: generateRecordId(),
          at: eventTimeMs,
          device,
          price,
          externalId: lead.externalId,
          eventId,
        }
        const purchases = [...(lead.purchases ?? []), record]

        await docRef.update({
          purchases,
          externalId: lead.externalId ?? '',
        })

        logger.info('purchaseLead 성공:', {
          leadId: id,
          recordId: record.id,
          device,
          price,
          at: new Date(record.at).toISOString(),
          actionSource: capiResult.actionSource,
          eventId: capiResult.eventId,
          externalId: lead.externalId,
          testEventCode: testEventCode ?? null,
        })

        response.status(200).send({
          id: snapshot.id,
          ...lead,
          purchases,
        })
      } catch (error) {
        logger.error('purchaseLead 처리 실패:', error)
        response.status(500).send({ error: '서버 오류' })
      }
    })
  },
)

// ────────────────────────────────
// updateIntake / deleteIntake — 접수 이력 개별 항목을 고치거나 지울 때 쓴다.
// 등록 전용 엔드포인트(contactLead/purchaseLead 같은)는 없다 — 접수는
// createLead/createLeadFromContact가 리드 생성 시 최초 1건을 만드는 것으로
// 충분하고, 이후엔 이력 모달에서 그 1건을 고치거나(예: 시각 오타 정정)
// 지우는 것만 지원한다.
// ────────────────────────────────
export const updateIntake = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const validationRes = validateUpdateIntake(request.body)
      if (!validationRes.ok) {
        response.status(400).send({ error: validationRes.error })
        return
      }

      const { id, recordId, at, device } = validationRes.data

      const docRef = db.collection('lead').doc(id)
      const snapshot = await docRef.get()

      if (!snapshot.exists) {
        response.status(404).send({ error: 'lead not found' })
        return
      }

      const lead = snapshot.data() as Omit<Lead, 'id'>
      const target = (lead.intakes ?? []).find((i) => i.id === recordId)

      if (!target) {
        response.status(404).send({ error: 'intake record not found' })
        return
      }

      const intakes = (lead.intakes ?? []).map((i) =>
        i.id === recordId
          ? {
              ...i,
              ...(at !== undefined ? { at } : {}),
              ...(device ? { device } : {}),
            }
          : i,
      )

      await docRef.update({ intakes })

      response.status(200).send({ id: snapshot.id, ...lead, intakes })
    } catch (error) {
      logger.error('updateIntake 처리 실패:', error)
      response.status(500).send({ error: '서버 오류' })
    }
  })
})

export const deleteIntake = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const validationRes = validateDeleteRecord(request.body)
      if (!validationRes.ok) {
        response.status(400).send({ error: validationRes.error })
        return
      }

      const { id, recordId } = validationRes.data

      const docRef = db.collection('lead').doc(id)
      const snapshot = await docRef.get()

      if (!snapshot.exists) {
        response.status(404).send({ error: 'lead not found' })
        return
      }

      const lead = snapshot.data() as Omit<Lead, 'id'>
      const intakes = (lead.intakes ?? []).filter((i) => i.id !== recordId)

      await docRef.update({ intakes })

      response.status(200).send({ id: snapshot.id, ...lead, intakes })
    } catch (error) {
      logger.error('deleteIntake 처리 실패:', error)
      response.status(500).send({ error: '서버 오류' })
    }
  })
})

// ────────────────────────────────
// updateConsultation / deleteConsultation / updatePurchase / deletePurchase
// — 이력 모달에서 개별 항목을 고치거나 지울 때 쓴다. Firestore가 배열 원소를
// 부분 수정 못 하는 건 위 등록 엔드포인트와 같은 이유로, 전체 읽고 통째로 쓴다.
// ────────────────────────────────
export const updateConsultation = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const validationRes = validateUpdateConsultation(request.body)
      if (!validationRes.ok) {
        response.status(400).send({ error: validationRes.error })
        return
      }

      const { id, recordId, at, device } = validationRes.data

      const docRef = db.collection('lead').doc(id)
      const snapshot = await docRef.get()

      if (!snapshot.exists) {
        response.status(404).send({ error: 'lead not found' })
        return
      }

      const lead = snapshot.data() as Omit<Lead, 'id'>
      const target = (lead.consultations ?? []).find((c) => c.id === recordId)

      if (!target) {
        response.status(404).send({ error: 'consultation record not found' })
        return
      }

      const consultations = (lead.consultations ?? []).map((c) =>
        c.id === recordId
          ? {
              ...c,
              ...(at !== undefined ? { at } : {}),
              ...(device ? { device } : {}),
            }
          : c,
      )

      await docRef.update({ consultations })

      response.status(200).send({ id: snapshot.id, ...lead, consultations })
    } catch (error) {
      logger.error('updateConsultation 처리 실패:', error)
      response.status(500).send({ error: '서버 오류' })
    }
  })
})

export const deleteConsultation = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const validationRes = validateDeleteRecord(request.body)
      if (!validationRes.ok) {
        response.status(400).send({ error: validationRes.error })
        return
      }

      const { id, recordId } = validationRes.data

      const docRef = db.collection('lead').doc(id)
      const snapshot = await docRef.get()

      if (!snapshot.exists) {
        response.status(404).send({ error: 'lead not found' })
        return
      }

      const lead = snapshot.data() as Omit<Lead, 'id'>
      const consultations = (lead.consultations ?? []).filter(
        (c) => c.id !== recordId,
      )

      await docRef.update({ consultations })

      response.status(200).send({ id: snapshot.id, ...lead, consultations })
    } catch (error) {
      logger.error('deleteConsultation 처리 실패:', error)
      response.status(500).send({ error: '서버 오류' })
    }
  })
})

// ────────────────────────────────
// resendConsultation — 상담 이력 1건의 Meta CAPI "Contact" 이벤트를 다시
// 보낸다. 새 이력을 추가하지 않고 그 레코드의 device/at을 그대로 재사용해
// 이벤트만 다시 쏜다 — 주로 (1) 이전에 전송이 실패했던 건 재시도, (2)
// getActionSource 버그로 잘못 physical_store로 나갔던 7일 이내 건을 고친
// 코드로 다시 보내 website로 바로잡는 용도. 보낼 때마다 event_id를 새로
// 발급해 externalId/eventId를 그 레코드에 덮어쓴다(마지막으로 어떤 값으로
// 보냈는지가 남아야 이벤트 매니저와 대조할 수 있다).
// ────────────────────────────────
export const resendConsultation = onRequest(
  { secrets: [metaPixelId, metaAccessToken] },
  (request, response) => {
    corsHandler(request, response, async () => {
      try {
        if (request.method !== 'POST') {
          response.status(405).send({ error: 'Method Not Allowed' })
          return
        }

        const validationRes = validateResendConsultation(request.body)
        if (!validationRes.ok) {
          response.status(400).send({ error: validationRes.error })
          return
        }

        const { id, recordId, testEventCode } = validationRes.data

        const docRef = db.collection('lead').doc(id)
        const snapshot = await docRef.get()

        if (!snapshot.exists) {
          response.status(404).send({ error: 'lead not found' })
          return
        }

        const lead = snapshot.data() as Omit<Lead, 'id'>
        const target = (lead.consultations ?? []).find((c) => c.id === recordId)

        if (!target) {
          response.status(404).send({ error: 'consultation record not found' })
          return
        }

        if (!lead.ph) {
          response.status(400).send({ error: 'lead has no ph to contact' })
          return
        }

        const hasEid = hasExternalId(lead)
        if (!hasEid) lead.externalId = generateExternalId(lead.ph)

        const eventId = generateEventId()

        // event_time은 원래 상담 시각(target.at) 그대로 쓴다 — 재전송이라고
        // "지금"으로 새로 잡으면 실제로 언제 상담했는지가 아니라 언제
        // 재전송했는지가 기록돼버린다. getActionSource도 이 시각 기준으로
        // 다시 계산되므로, 상담 이후 7일이 지났다면(원래 등록 때 버그로
        // physical_store로 나갔던 것과 무관하게) 여전히 physical_store로
        // 나간다 — 이건 API의 하드 제약이라 재전송으로도 못 바꾼다.
        const capiResult = await sendMetaEvent({
          pixelId: metaPixelId.value(),
          accessToken: metaAccessToken.value(),
          eventName: 'Contact',
          lead,
          testEventCode,
          customData: {
            currency: 'KRW',
            value: DEVICE_EXPECTED_VALUE[target.device],
          },
          eventTimeMs: target.at,
          eventId,
        })

        if (!capiResult.ok) {
          response
            .status(502)
            .send({ error: 'Meta CAPI 전송 실패', detail: capiResult.result })
          return
        }

        const consultations = (lead.consultations ?? []).map((c) =>
          c.id === recordId
            ? { ...c, externalId: lead.externalId, eventId }
            : c,
        )

        await docRef.update({
          consultations,
          externalId: lead.externalId ?? '',
        })

        // action_source가 이번엔 뭘로 나갔는지(website인지 physical_store인지)를
        // 포함해서 남긴다 — Firebase 콘솔 로그에서 이 재전송이 실제로 광고 성과
        // 측정에 잡힐 건인지를 sendMetaEvent 내부 로그(원본 응답만 찍힘)와 별개로
        // 바로 확인할 수 있게 하기 위함.
        logger.info('resendConsultation 성공:', {
          leadId: id,
          recordId,
          device: target.device,
          at: new Date(target.at).toISOString(),
          actionSource: capiResult.actionSource,
          eventId: capiResult.eventId,
          externalId: lead.externalId,
          testEventCode: testEventCode ?? null,
        })

        response.status(200).send({
          id: snapshot.id,
          ...lead,
          consultations,
        })
      } catch (error) {
        logger.error('resendConsultation 처리 실패:', error)
        response.status(500).send({ error: '서버 오류' })
      }
    })
  },
)

export const updatePurchase = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const validationRes = validateUpdatePurchase(request.body)
      if (!validationRes.ok) {
        response.status(400).send({ error: validationRes.error })
        return
      }

      const { id, recordId, at, device, price } = validationRes.data

      const docRef = db.collection('lead').doc(id)
      const snapshot = await docRef.get()

      if (!snapshot.exists) {
        response.status(404).send({ error: 'lead not found' })
        return
      }

      const lead = snapshot.data() as Omit<Lead, 'id'>
      const target = (lead.purchases ?? []).find((p) => p.id === recordId)

      if (!target) {
        response.status(404).send({ error: 'purchase record not found' })
        return
      }

      const purchases = (lead.purchases ?? []).map((p) =>
        p.id === recordId
          ? {
              ...p,
              ...(at !== undefined ? { at } : {}),
              ...(device ? { device } : {}),
              ...(price !== undefined ? { price } : {}),
            }
          : p,
      )

      await docRef.update({ purchases })

      response.status(200).send({ id: snapshot.id, ...lead, purchases })
    } catch (error) {
      logger.error('updatePurchase 처리 실패:', error)
      response.status(500).send({ error: '서버 오류' })
    }
  })
})

export const deletePurchase = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const validationRes = validateDeleteRecord(request.body)
      if (!validationRes.ok) {
        response.status(400).send({ error: validationRes.error })
        return
      }

      const { id, recordId } = validationRes.data

      const docRef = db.collection('lead').doc(id)
      const snapshot = await docRef.get()

      if (!snapshot.exists) {
        response.status(404).send({ error: 'lead not found' })
        return
      }

      const lead = snapshot.data() as Omit<Lead, 'id'>
      const purchases = (lead.purchases ?? []).filter(
        (p) => p.id !== recordId,
      )

      await docRef.update({ purchases })

      response.status(200).send({ id: snapshot.id, ...lead, purchases })
    } catch (error) {
      logger.error('deletePurchase 처리 실패:', error)
      response.status(500).send({ error: '서버 오류' })
    }
  })
})

// ────────────────────────────────
// updateLeadPhone
// ────────────────────────────────
export const updateLeadPhone = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const validationRes = valiedateUpdateLeadPhone(request.body)

      if (!validationRes.ok) {
        response.status(400).send({ error: validationRes.error })
        return
      }

      const { id, ph } = validationRes.data

      const docRef = db.collection('lead').doc(id)
      const snapshot = await docRef.get()

      if (!snapshot.exists) {
        response.status(404).send({ error: 'lead not found' })
        return
      }

      const updateData = {
        ph,
        externalId: generateExternalId(ph),
      }

      await docRef.update(updateData)

      response.status(200).send({ id, ...snapshot.data(), ...updateData })
    } catch (error) {
      logger.error('updateLeadPhone 처리 실패:', error)
      response.status(500).send({ error: '서버 오류' })
    }
  })
})

// ────────────────────────────────
// updateLeadFn
// ────────────────────────────────
export const updateLeadFn = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const validationRes = validateUpdateLeadFn(request.body)

      if (!validationRes.ok) {
        response.status(400).send({ error: validationRes.error })
        return
      }

      const { id, fn } = validationRes.data

      const docRef = db.collection('lead').doc(id)
      const snapshot = await docRef.get()

      if (!snapshot.exists) {
        response.status(404).send({ error: 'lead not found' })
        return
      }

      await docRef.update({ fn })

      response.status(200).send({ id, ...snapshot.data(), fn })
    } catch (error) {
      logger.error('updateLeadFn 처리 실패:', error)
      response.status(500).send({ error: '서버 오류' })
    }
  })
})

// ────────────────────────────────
// updateLeadRemarks
// ────────────────────────────────
export const updateLeadRemarks = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const validationRes = validateUpdateLeadRemarks(request.body)

      if (!validationRes.ok) {
        response.status(400).send({ error: validationRes.error })
        return
      }

      const { id, remarks } = validationRes.data

      const docRef = db.collection('lead').doc(id)
      const snapshot = await docRef.get()

      if (!snapshot.exists) {
        response.status(404).send({ error: 'lead not found' })
        return
      }

      await docRef.update({ remarks })

      response.status(200).send({ id, ...snapshot.data(), remarks })
    } catch (error) {
      logger.error('updateLeadRemarks 처리 실패:', error)
      response.status(500).send({ error: '서버 오류' })
    }
  })
})

// ────────────────────────────────
// deleteLead
// ────────────────────────────────
export const deleteLead = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const validationRes = validateDeleteLead(request.body)

      if (!validationRes.ok) {
        response.status(400).send({ error: validationRes.error })
        return
      }

      const { id } = validationRes.data

      const docRef = db.collection('lead').doc(id)
      const snapshot = await docRef.get()

      if (!snapshot.exists) {
        response.status(404).send({ error: 'lead not found' })
        return
      }

      await docRef.delete()

      logger.info('리드 삭제 완료:', id)

      response.status(200).send({ id, deleted: true })
    } catch (error) {
      logger.error('deleteLead 처리 실패:', error)
      response.status(500).send({ error: '서버 오류' })
    }
  })
})

// ────────────────────────────────
// migrateLeadsToArrays — 일회성 마이그레이션. 기존 state/createdAt/purchasedAt/
// price/device 구조의 리드를 consultations/purchases 배열 구조로 변환해
// 추가한다(기존 필드는 지우지 않고 그대로 둔다 — 새 코드가 안 읽으니 무해하고
// 문제 생기면 롤백 가능). 배포 후 한 번 호출해서 실행하고, 정상 확인되면 이
// 함수 자체를 지운다.
//
// 변환 규칙(사용자 확인 완료) — 옛 스키마엔 "상담 시각"을 따로 담는 필드가
// 없고 createdAt이 그 역할을 겸했다(예전 화면에서도 이 컬럼 라벨이
// "상담 시각"이었다 — 리드 구조 재설계 때 "접수일"로 바뀜). 그래서 아래
// contactedAt은 곧 data.createdAt이다.
//   1) state === 'contacted' && contactedAt 있음 → 상담 1건(consultations)
//   2) state === 'purchased' && purchasedAt 있음 → 구매 1건(purchases)
//   3) state === 'purchased' && contactedAt && purchasedAt 둘 다 있음
//      → 상담 1건 + 구매 1건 모두 추가
// ────────────────────────────────
export const migrateLeadsToArrays = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'GET') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const snapshot = await db.collection('lead').get()
      let migrated = 0
      let skipped = 0

      for (const doc of snapshot.docs) {
        const data = doc.data() as Record<string, unknown>

        // 이미 새 구조로 마이그레이션된 문서는 다시 건드리지 않는다(재실행 안전).
        if (Array.isArray(data.consultations)) {
          skipped += 1
          continue
        }

        const state = data.state as string | undefined
        const device = data.device as string | undefined
        // 옛 스키마엔 상담 시각 전용 필드가 없어 createdAt이 그 역할을 겸한다.
        const contactedAt = (data.createdAt as number) ?? 0
        const purchasedAt = (data.purchasedAt as number) ?? 0
        const price = (data.price as number) ?? 0

        const hasContact =
          (state === 'contacted' || state === 'purchased') &&
          !!device &&
          contactedAt > 0
        const hasPurchase =
          state === 'purchased' && !!device && purchasedAt > 0 && price > 0

        const consultations: ConsultationRecord[] = hasContact
          ? [
              {
                id: generateRecordId(),
                at: contactedAt,
                device: device as ConsultationRecord['device'],
              },
            ]
          : []

        const purchases: PurchaseRecord[] = hasPurchase
          ? [
              {
                id: generateRecordId(),
                at: purchasedAt,
                device: device as PurchaseRecord['device'],
                price,
              },
            ]
          : []

        await doc.ref.update({
          consultations,
          purchases,
          remarks: (data.remarks as string) ?? '',
        })
        migrated += 1
      }

      logger.info(`리드 마이그레이션 완료: ${migrated}건, 스킵 ${skipped}건`)
      response.status(200).send({ migrated, skipped, total: snapshot.size })
    } catch (error) {
      logger.error('migrateLeadsToArrays 처리 실패:', error)
      response.status(500).send({ error: '서버 오류' })
    }
  })
})

// ────────────────────────────────
// migrateLeadsToIntakes — 일회성 마이그레이션(2차). 리드 최상위 createdAt(+
// 레거시 raw device — 지금 Lead 타입엔 없지만 옛 문서엔 아직 남아있다)을
// intakes 배열로 옮긴다. createdAt 필드 자체는 지우지 않는다(다른 마이그레이션과
// 같은 이유 — 무해하고 롤백 가능). migrateLeadsToArrays와 별도 함수로 둔 이유는
// 그 함수가 이미 한 번 실행돼 모든 리드에 consultations 배열이 생겨서, 그
// 재실행-안전 체크(Array.isArray(data.consultations))로는 이 마이그레이션을
// 더 이상 걸러낼 수 없기 때문 — 여기서는 intakes 배열 존재 여부로 따로 체크한다.
// 배포 후 한 번 호출해서 실행하고, 정상 확인되면 이 함수 자체를 지운다.
// ────────────────────────────────
export const migrateLeadsToIntakes = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'GET') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const snapshot = await db.collection('lead').get()
      let migrated = 0
      let skipped = 0

      for (const doc of snapshot.docs) {
        const data = doc.data() as Record<string, unknown>

        // 이미 마이그레이션된 문서는 다시 건드리지 않는다(재실행 안전).
        if (Array.isArray(data.intakes)) {
          skipped += 1
          continue
        }

        const createdAt = (data.createdAt as number) ?? 0
        const device = data.device as string | undefined

        const intakes: IntakeRecord[] =
          createdAt > 0
            ? [
                {
                  id: generateRecordId(),
                  at: createdAt,
                  ...(device
                    ? { device: device as IntakeRecord['device'] }
                    : {}),
                },
              ]
            : []

        await doc.ref.update({ intakes })
        migrated += 1
      }

      logger.info(`리드 접수 이력 마이그레이션 완료: ${migrated}건, 스킵 ${skipped}건`)
      response.status(200).send({ migrated, skipped, total: snapshot.size })
    } catch (error) {
      logger.error('migrateLeadsToIntakes 처리 실패:', error)
      response.status(500).send({ error: '서버 오류' })
    }
  })
})
