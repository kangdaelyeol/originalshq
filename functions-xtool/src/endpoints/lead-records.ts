import type { Response } from 'express'
import * as logger from 'firebase-functions/logger'
import { onRequest } from 'firebase-functions/https'
import {
  ConsultationRecord,
  IntakeRecord,
  Lead,
  PurchaseRecord,
  ValidationResponse,
} from '../types'
import { GA4_CONSULTATION_EVENTS } from '../constants'
import { expectedValueOf, sendMetaEvent, topDevice } from '../meta'
import { sendGa4Event } from '../ga4'
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
import { endpoint, findLead, patchLead } from '../http'

// 리드 한 명의 기록(접수·상담·구매) 등록·수정·삭제·재전송. 세 기록은 리드
// 문서 안의 배열이라 고치는 방법이 같아서, 공통 부분은 아래 헬퍼와 함수를
// 만드는 틀(update/delete/resend)로 한 번만 쓴다.

type LeadData = Omit<Lead, 'id'>

interface RecordOf {
  intakes: IntakeRecord
  consultations: ConsultationRecord
  purchases: PurchaseRecord
}
type RecordKey = keyof RecordOf

const NOT_FOUND: Record<RecordKey, string> = {
  intakes: 'intake record not found',
  consultations: 'consultation record not found',
  purchases: 'purchase record not found',
}

const recordsOf = <K extends RecordKey>(lead: LeadData, key: K) =>
  (lead[key] ?? []) as RecordOf[K][]

/** 기록 한 건을 최신 리드에서 트랜잭션으로 고친다(patchLead). 그 기록이
 * 없으면 404를 보내고 null — 리드가 없을 때의 404는 patchLead가 보낸다.
 * extra는 같은 쓰기에 붙일 리드 최상위 값(재전송의 externalId). */
const updateRecord = async <K extends RecordKey>(
  response: Response,
  id: string,
  key: K,
  recordId: string,
  change: (record: RecordOf[K]) => RecordOf[K],
  extra?: (fresh: LeadData) => Partial<LeadData>,
) => {
  const saved = await patchLead(response, id, (fresh) => {
    const records = recordsOf(fresh, key)
    if (!records.some((r) => r.id === recordId)) return null
    return {
      [key]: records.map((r) => (r.id === recordId ? change(r) : r)),
      ...extra?.(fresh),
    }
  })
  if (!saved) return null
  if (!saved.patch) {
    response.status(404).send({ error: NOT_FOUND[key] })
    return null
  }
  return saved
}

/** 새 기록을 최신 리드 배열 끝에 붙인다 — 보내는 사이 다른 요청이 같은
 * 리드를 고쳤을 수 있어 트랜잭션으로(patchLead). externalId는 CAPI에 실어
 * 보낸 값을 남긴다. */
const appendRecord = <K extends RecordKey>(
  response: Response,
  id: string,
  key: K,
  record: RecordOf[K],
  externalId: string | undefined,
) =>
  patchLead(response, id, (fresh) => ({
    [key]: [...recordsOf(fresh, key), record],
    externalId: fresh.externalId || externalId || '',
  }))

/** 리드로 Meta CAPI 이벤트 하나를 보낸다. 번호가 없으면 400(externalId를
 * 만들 수 없다), 전송이 실패하면 502를 보내고 null. externalId가 없던 리드는
 * 여기서 만들어 lead에 채운다. */
const sendLeadEvent = async (
  response: Response,
  lead: LeadData,
  event: {
    eventName: 'Contact' | 'Purchase'
    value: number
    eventTimeMs: number
    testEventCode?: string
  },
) => {
  if (!lead.ph) {
    response.status(400).send({ error: 'lead has no ph to contact' })
    return null
  }
  if (!hasExternalId(lead)) lead.externalId = generateExternalId(lead.ph)

  const eventId = generateEventId()
  const capiResult = await sendMetaEvent({
    pixelId: metaPixelId.value(),
    accessToken: metaAccessToken.value(),
    eventName: event.eventName,
    lead,
    testEventCode: event.testEventCode,
    customData: { currency: 'KRW', value: event.value },
    eventTimeMs: event.eventTimeMs,
    eventId,
  })
  if (!capiResult.ok) {
    response
      .status(502)
      .send({ error: 'Meta CAPI 전송 실패', detail: capiResult.result })
    return null
  }
  return { capiResult, eventId }
}

// ────────────────────────────────
// contactLead — 상담 1건 등록(배열에 추가). 등록할 때마다 Meta "Contact" CAPI를
// 전송한다 — 재상담 고객도 매번 추적 대상이라 더 이상 "최초 1건만" 게이트를
// 두지 않는다.
// ────────────────────────────────
export const contactLead = onRequest(
  { secrets: [metaPixelId, metaAccessToken, ga4MeasurementId, ga4ApiSecret] },
  endpoint(
    {
      name: 'contactLead',
      method: 'POST',
      validate: validateContactLead,
      member: true,
    },
    async ({ response, data }) => {
      const { id, devices, at, testEventCode } = data
      // 기기가 여럿이면 예상 금액이 가장 큰 것이 대표 — 그 금액으로 보낸다.
      const device = topDevice(devices)

      const found = await findLead(response, id)
      if (!found) return
      const lead = found.snapshot.data() as LeadData

      const eventTimeMs = at ?? Date.now()
      const sent = await sendLeadEvent(response, lead, {
        eventName: 'Contact',
        value: expectedValueOf(device),
        eventTimeMs,
        testEventCode,
      })
      if (!sent) return

      const record: ConsultationRecord = {
        id: generateRecordId(),
        at: eventTimeMs,
        device,
        devices,
        externalId: lead.externalId,
        eventId: sent.eventId,
      }
      const saved = await appendRecord(
        response,
        id,
        'consultations',
        record,
        lead.externalId,
      )
      if (!saved) return

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
        devices,
        at: new Date(record.at).toISOString(),
        actionSource: sent.capiResult.actionSource,
        eventId: sent.capiResult.eventId,
        externalId: lead.externalId,
        testEventCode: testEventCode ?? null,
        ga4: ga4Result,
      })

      response.status(200).send({ id, ...saved.lead })
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
    {
      name: 'purchaseLead',
      method: 'POST',
      validate: validatePurchaseLead,
      member: true,
    },
    async ({ response, data }) => {
      const { id, device, price, at, testEventCode } = data

      const found = await findLead(response, id)
      if (!found) return
      const lead = found.snapshot.data() as LeadData

      const eventTimeMs = at ?? Date.now()
      const sent = await sendLeadEvent(response, lead, {
        eventName: 'Purchase',
        value: price,
        eventTimeMs,
        testEventCode,
      })
      if (!sent) return

      const record: PurchaseRecord = {
        id: generateRecordId(),
        at: eventTimeMs,
        device,
        price,
        externalId: lead.externalId,
        eventId: sent.eventId,
      }
      const saved = await appendRecord(
        response,
        id,
        'purchases',
        record,
        lead.externalId,
      )
      if (!saved) return

      logger.info('purchaseLead 성공:', {
        leadId: id,
        recordId: record.id,
        device,
        price,
        at: new Date(record.at).toISOString(),
        actionSource: sent.capiResult.actionSource,
        eventId: sent.capiResult.eventId,
        externalId: lead.externalId,
        testEventCode: testEventCode ?? null,
      })

      response.status(200).send({ id, ...saved.lead })
    },
  ),
)

// ────────────────────────────────
// update* / delete* — 접수·상담·구매 이력의 개별 항목을 고치거나 지운다.
// 접수는 등록 전용 엔드포인트가 없다 — createLead/createLeadFromContact가 리드
// 생성 시 최초 1건을 만들고, 이후엔 이력 모달에서 고치거나(예: 시각 오타
// 정정) 지우는 것만 한다.
// ────────────────────────────────

/** 기록 한 건 고치기 — change가 요청 값(data)으로 새 기록을 만든다. */
const updateEndpoint = <
  K extends RecordKey,
  D extends { id: string; recordId: string },
>(
  name: string,
  key: K,
  validate: (body: Record<string, unknown>) => ValidationResponse<D>,
  change: (record: RecordOf[K], data: D) => RecordOf[K],
) =>
  onRequest(
    endpoint(
      { name, method: 'POST', validate, member: true },
      async ({ response, data }) => {
        const saved = await updateRecord(
          response,
          data.id,
          key,
          data.recordId,
          (record) => change(record, data),
        )
        if (!saved) return
        response.status(200).send({ id: data.id, ...saved.lead })
      },
    ),
  )

/** 기록 한 건 지우기 — 이미 없는 기록이면 쓰지 않고 그대로 200. */
const deleteEndpoint = (name: string, key: RecordKey) =>
  onRequest(
    endpoint(
      { name, method: 'POST', validate: validateDeleteRecord, member: true },
      async ({ response, data }) => {
        const { id, recordId } = data
        const saved = await patchLead(response, id, (lead) => {
          const records = recordsOf(lead, key)
          return records.some((r) => r.id === recordId)
            ? { [key]: records.filter((r) => r.id !== recordId) }
            : null
        })
        if (!saved) return
        response.status(200).send({ id, ...saved.lead })
      },
    ),
  )

export const updateIntake = updateEndpoint(
  'updateIntake',
  'intakes',
  validateUpdateIntake,
  (record, { at, device }) => ({
    ...record,
    ...(at !== undefined ? { at } : {}),
    ...(device ? { device } : {}),
  }),
)
export const deleteIntake = deleteEndpoint('deleteIntake', 'intakes')

export const updateConsultation = updateEndpoint(
  'updateConsultation',
  'consultations',
  validateUpdateConsultation,
  (record, { at, devices, note }) => ({
    ...record,
    ...(at !== undefined ? { at } : {}),
    // 기기를 고치면 대표 기기도 다시 고른다.
    ...(devices ? { device: topDevice(devices), devices } : {}),
    ...(note !== undefined ? { note } : {}),
  }),
)
export const deleteConsultation = deleteEndpoint(
  'deleteConsultation',
  'consultations',
)

export const updatePurchase = updateEndpoint(
  'updatePurchase',
  'purchases',
  validateUpdatePurchase,
  (record, { at, device, price }) => ({
    ...record,
    ...(at !== undefined ? { at } : {}),
    ...(device ? { device } : {}),
    ...(price !== undefined ? { price } : {}),
  }),
)
export const deletePurchase = deleteEndpoint('deletePurchase', 'purchases')

// ────────────────────────────────
// resendConsultation / resendPurchase — 이력 1건의 Meta CAPI 이벤트를 다시
// 보낸다. 새 이력을 추가하지 않고 그 레코드의 값(기기·금액·시각)을 그대로
// 다시 쓴다 — 주로 (1) 이전에 전송이 실패했던 건 재시도, (2)
// getActionSource 버그로 잘못 physical_store로 나갔던 7일 이내 건을 고친
// 코드로 다시 보내 website로 바로잡는 용도. 보낼 때마다 event_id를 새로
// 발급해 externalId/eventId를 그 레코드에 덮어쓴다(마지막으로 어떤 값으로
// 보냈는지가 남아야 이벤트 매니저와 대조할 수 있다).
//
// event_time은 원래 기록 시각(target.at) 그대로 쓴다 — 재전송이라고 "지금"으로
// 새로 잡으면 실제로 언제 상담·구매했는지가 아니라 언제 재전송했는지가
// 기록돼버린다. getActionSource도 이 시각 기준으로 다시 계산되므로, 7일이
// 지났다면 여전히 physical_store로 나간다 — API의 하드 제약이라 재전송으로도
// 못 바꾼다. 로그에 action_source를 남겨 이번엔 무엇으로 나갔는지(광고 성과
// 측정에 잡힐 건인지)를 콘솔에서 바로 확인할 수 있게 한다.
// ────────────────────────────────
const resendEndpoint = <K extends 'consultations' | 'purchases'>(
  name: string,
  key: K,
  eventName: 'Contact' | 'Purchase',
  /** 보낼 금액과 로그에 남길 값. */
  describe: (record: RecordOf[K]) => {
    value: number
    log: Record<string, unknown>
  },
) =>
  onRequest(
    { secrets: [metaPixelId, metaAccessToken] },
    endpoint(
      { name, member: true, method: 'POST', validate: validateResendRecord },
      async ({ response, data }) => {
        const { id, recordId, testEventCode } = data

        const found = await findLead(response, id)
        if (!found) return
        const lead = found.snapshot.data() as LeadData
        const target = recordsOf(lead, key).find((r) => r.id === recordId)
        if (!target) {
          response.status(404).send({ error: NOT_FOUND[key] })
          return
        }

        const { value, log } = describe(target)
        const sent = await sendLeadEvent(response, lead, {
          eventName,
          value,
          eventTimeMs: target.at,
          testEventCode,
        })
        if (!sent) return

        // 보내는 사이 그 기록이 지워졌으면 404(이벤트는 이미 나갔다).
        const saved = await updateRecord(
          response,
          id,
          key,
          recordId,
          (record) => ({
            ...record,
            externalId: lead.externalId,
            eventId: sent.eventId,
          }),
          (fresh) => ({
            externalId: fresh.externalId || lead.externalId || '',
          }),
        )
        if (!saved) return

        logger.info(`${name} 성공:`, {
          leadId: id,
          recordId,
          ...log,
          at: new Date(target.at).toISOString(),
          actionSource: sent.capiResult.actionSource,
          eventId: sent.capiResult.eventId,
          externalId: lead.externalId,
          testEventCode: testEventCode ?? null,
        })

        response.status(200).send({ id, ...saved.lead })
      },
    ),
  )

export const resendConsultation = resendEndpoint(
  'resendConsultation',
  'consultations',
  'Contact',
  (record) => ({
    value: expectedValueOf(record.device),
    log: { device: record.device },
  }),
)

export const resendPurchase = resendEndpoint(
  'resendPurchase',
  'purchases',
  'Purchase',
  (record) => ({
    value: record.price,
    log: { device: record.device, price: record.price },
  }),
)
