import cors from 'cors'
import * as logger from 'firebase-functions/logger'
import { setGlobalOptions } from 'firebase-functions'
import { onRequest } from 'firebase-functions/https'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { ConsultationRecord, Lead, PurchaseRecord } from './types'
import { DEVICE_EXPECTED_VALUE, sendMetaEvent } from './meta'
import {
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
  validateUpdateConsultation,
  validateUpdateLeadFn,
  validateUpdateLeadRemarks,
  validateUpdatePurchase,
  validateUpdateTimestamp,
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

      const snapshot = await db
        .collection('lead')
        .orderBy('createdAt', 'desc')
        .get()

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
        createdAt: input.createdAt,
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
        createdAt: input.createdAt,
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
        }
        // Firestore는 배열 원소를 부분 수정할 수 없어, 전체를 읽어 append한
        // 뒤 통째로 되쓴다(data/importer.ts의 read-modify-write와 같은 결).
        const consultations = [...(lead.consultations ?? []), record]

        await docRef.update({
          consultations,
          externalId: lead.externalId ?? '',
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

        const capiResult = await sendMetaEvent({
          pixelId: metaPixelId.value(),
          accessToken: metaAccessToken.value(),
          eventName: 'Purchase',
          lead,
          testEventCode,
          customData: { currency: 'KRW', value: price },
          eventTimeMs,
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
        }
        const purchases = [...(lead.purchases ?? []), record]

        await docRef.update({
          purchases,
          externalId: lead.externalId ?? '',
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
// updateLeadTimestamp - createdAt(접수일)만 대상
// ────────────────────────────────
export const updateLeadTimestamp = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const validationRes = validateUpdateTimestamp(request.body)

      if (!validationRes.ok) {
        response.status(400).send({ error: validationRes.error })
        return
      }

      const { id, field, value } = validationRes.data

      const docRef = db.collection('lead').doc(id)
      const snapshot = await docRef.get()

      if (!snapshot.exists) {
        response.status(404).send({ error: 'lead not found' })
        return
      }

      await docRef.update({ [field]: value })

      const lead = snapshot.data() as Omit<Lead, 'id'>

      logger.info('리드 시각 수정 완료:', id, field, value)

      response.status(200).send({
        id: snapshot.id,
        ...lead,
        [field as string]: value,
      })
    } catch (error) {
      logger.error('updateLeadTimestamp 처리 실패:', error)
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
