import * as logger from 'firebase-functions/logger'
import { onRequest } from 'firebase-functions/https'
import { ConsultationRecord, Lead, PurchaseRecord } from '../types'
import { DEVICE_EXPECTED_VALUE, sendMetaEvent } from '../meta'
import { GA4_CONSULTATION_EVENTS, sendGa4Event } from '../ga4'
import { generateEventId, generateExternalId, generateRecordId } from '../utils'
import {
  hasExternalId,
  validateContactLead,
  validateDeleteRecord,
  validatePurchaseLead,
  validateResendRecord,
  validateUpdateConsultation,
  validateUpdateIntake,
  validateUpdatePurchase,
} from '../validation'
import {
  metaPixelId,
  metaAccessToken,
  ga4MeasurementId,
  ga4ApiSecret,
} from '../app'
import { endpoint, findLead } from '../http'

// ────────────────────────────────
// contactLead — 상담 1건 등록(배열에 추가). 등록할 때마다 Meta "Contact" CAPI를
// 전송한다 — 재상담 고객도 매번 추적 대상이라 더 이상 "최초 1건만" 게이트를
// 두지 않는다.
// ────────────────────────────────
export const contactLead = onRequest(
  { secrets: [metaPixelId, metaAccessToken, ga4MeasurementId, ga4ApiSecret] },
  endpoint(
    { name: 'contactLead', method: 'POST', validate: validateContactLead },
    async ({ response, data }) => {
      const { id, device, at, testEventCode } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

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

      // GA4 — 기기별로 정해둔 이벤트가 있을 때만(지금은 '기타'·'B2G') 보낸다.
      // Meta CAPI 성공과 저장까지 끝난 뒤라, 여기서 실패해도 상담 등록
      // 자체는 되돌리지 않고 로그만 남긴다.
      const ga4Event = GA4_CONSULTATION_EVENTS[device]
      let ga4Result: Awaited<ReturnType<typeof sendGa4Event>> | null = null
      if (ga4Event) {
        try {
          ga4Result = await sendGa4Event({
            measurementId: ga4MeasurementId.value(),
            apiSecret: ga4ApiSecret.value(),
            // 문의 폼이 보낸 _ga 쿠키 값(ga4ClientId)이 있으면 그걸 써서 이
            // 고객의 웹 방문(광고 유입 세션)에 이벤트를 붙인다. 없으면(쿠키
            // 없음, 수기 등록, 예전 리드) 고객별로 고정된 externalId(전화번호
            // 해시)로 대신한다 — 같은 고객끼리는 묶이지만 유입 경로는 없다.
            // 상세 모달에서 지우면 빈 문자열로 저장되므로 ??가 아니라 ||로
            // 넘긴다(빈 client_id로 보내면 GA4가 이벤트를 버린다).
            clientId:
              lead.ga4ClientId ||
              lead.externalId ||
              generateExternalId(lead.ph),
            name: ga4Event.name,
            params: { currency: 'KRW', value: ga4Event.value },
            eventTimeMs,
          })
        } catch (error) {
          logger.error('GA4 전송 중 오류:', error)
        }
      }

      logger.info('contactLead 성공:', {
        leadId: id,
        recordId: record.id,
        device,
        at: new Date(record.at).toISOString(),
        actionSource: capiResult.actionSource,
        eventId: capiResult.eventId,
        externalId: lead.externalId,
        testEventCode: testEventCode ?? null,
        ga4: ga4Result,
      })

      response.status(200).send({
        id: snapshot.id,
        ...lead,
        consultations,
      })
    },
  ),
)

// ────────────────────────────────
// purchaseLead — 구매 1건 등록(배열에 추가). contactLead와 같은 이유로 등록할
// 때마다 Meta "Purchase" CAPI를 전송한다.
// ────────────────────────────────
export const purchaseLead = onRequest(
  { secrets: [metaPixelId, metaAccessToken] },
  endpoint(
    { name: 'purchaseLead', method: 'POST', validate: validatePurchaseLead },
    async ({ response, data }) => {
      const { id, device, price, at, testEventCode } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

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
    },
  ),
)

// ────────────────────────────────
// updateIntake / deleteIntake — 접수 이력 개별 항목을 고치거나 지울 때 쓴다.
// 등록 전용 엔드포인트(contactLead/purchaseLead 같은)는 없다 — 접수는
// createLead/createLeadFromContact가 리드 생성 시 최초 1건을 만드는 것으로
// 충분하고, 이후엔 이력 모달에서 그 1건을 고치거나(예: 시각 오타 정정)
// 지우는 것만 지원한다.
// ────────────────────────────────
export const updateIntake = onRequest(
  endpoint(
    { name: 'updateIntake', method: 'POST', validate: validateUpdateIntake },
    async ({ response, data }) => {
      const { id, recordId, at, device } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

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
    },
  ),
)

export const deleteIntake = onRequest(
  endpoint(
    { name: 'deleteIntake', method: 'POST', validate: validateDeleteRecord },
    async ({ response, data }) => {
      const { id, recordId } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

      const lead = snapshot.data() as Omit<Lead, 'id'>
      const intakes = (lead.intakes ?? []).filter((i) => i.id !== recordId)

      await docRef.update({ intakes })

      response.status(200).send({ id: snapshot.id, ...lead, intakes })
    },
  ),
)

// ────────────────────────────────
// updateConsultation / deleteConsultation / updatePurchase / deletePurchase
// — 이력 모달에서 개별 항목을 고치거나 지울 때 쓴다. Firestore가 배열 원소를
// 부분 수정 못 하는 건 위 등록 엔드포인트와 같은 이유로, 전체 읽고 통째로 쓴다.
// ────────────────────────────────
export const updateConsultation = onRequest(
  endpoint(
    {
      name: 'updateConsultation',
      method: 'POST',
      validate: validateUpdateConsultation,
    },
    async ({ response, data }) => {
      const { id, recordId, at, device, note } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

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
              ...(note !== undefined ? { note } : {}),
            }
          : c,
      )

      await docRef.update({ consultations })

      response.status(200).send({ id: snapshot.id, ...lead, consultations })
    },
  ),
)

export const deleteConsultation = onRequest(
  endpoint(
    {
      name: 'deleteConsultation',
      method: 'POST',
      validate: validateDeleteRecord,
    },
    async ({ response, data }) => {
      const { id, recordId } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

      const lead = snapshot.data() as Omit<Lead, 'id'>
      const consultations = (lead.consultations ?? []).filter(
        (c) => c.id !== recordId,
      )

      await docRef.update({ consultations })

      response.status(200).send({ id: snapshot.id, ...lead, consultations })
    },
  ),
)

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
  endpoint(
    {
      name: 'resendConsultation',
      method: 'POST',
      validate: validateResendRecord,
    },
    async ({ response, data }) => {
      const { id, recordId, testEventCode } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

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
    },
  ),
)

export const updatePurchase = onRequest(
  endpoint(
    {
      name: 'updatePurchase',
      method: 'POST',
      validate: validateUpdatePurchase,
    },
    async ({ response, data }) => {
      const { id, recordId, at, device, price } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

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
    },
  ),
)

export const deletePurchase = onRequest(
  endpoint(
    { name: 'deletePurchase', method: 'POST', validate: validateDeleteRecord },
    async ({ response, data }) => {
      const { id, recordId } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

      const lead = snapshot.data() as Omit<Lead, 'id'>
      const purchases = (lead.purchases ?? []).filter((p) => p.id !== recordId)

      await docRef.update({ purchases })

      response.status(200).send({ id: snapshot.id, ...lead, purchases })
    },
  ),
)

// ────────────────────────────────
// resendPurchase — resendConsultation과 완전히 같은 패턴, 대상만 구매 이력.
// 구매 이력 1건의 Meta CAPI "Purchase" 이벤트를 다시 보낸다. 새 이력을
// 추가하지 않고 그 레코드의 device/price/at을 그대로 재사용한다.
// ────────────────────────────────
export const resendPurchase = onRequest(
  { secrets: [metaPixelId, metaAccessToken] },
  endpoint(
    { name: 'resendPurchase', method: 'POST', validate: validateResendRecord },
    async ({ response, data }) => {
      const { id, recordId, testEventCode } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

      const lead = snapshot.data() as Omit<Lead, 'id'>
      const target = (lead.purchases ?? []).find((p) => p.id === recordId)

      if (!target) {
        response.status(404).send({ error: 'purchase record not found' })
        return
      }

      if (!lead.ph) {
        response.status(400).send({ error: 'lead has no ph to contact' })
        return
      }

      const hasEid = hasExternalId(lead)
      if (!hasEid) lead.externalId = generateExternalId(lead.ph)

      const eventId = generateEventId()

      // resendConsultation과 같은 이유로 event_time은 원래 구매 시각
      // (target.at) 그대로 쓴다.
      const capiResult = await sendMetaEvent({
        pixelId: metaPixelId.value(),
        accessToken: metaAccessToken.value(),
        eventName: 'Purchase',
        lead,
        testEventCode,
        customData: { currency: 'KRW', value: target.price },
        eventTimeMs: target.at,
        eventId,
      })

      if (!capiResult.ok) {
        response
          .status(502)
          .send({ error: 'Meta CAPI 전송 실패', detail: capiResult.result })
        return
      }

      const purchases = (lead.purchases ?? []).map((p) =>
        p.id === recordId
          ? { ...p, externalId: lead.externalId, eventId }
          : p,
      )

      await docRef.update({
        purchases,
        externalId: lead.externalId ?? '',
      })

      logger.info('resendPurchase 성공:', {
        leadId: id,
        recordId,
        device: target.device,
        price: target.price,
        at: new Date(target.at).toISOString(),
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
    },
  ),
)
