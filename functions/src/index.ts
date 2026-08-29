import { setGlobalOptions } from 'firebase-functions'
import { onRequest } from 'firebase-functions/https'
import * as logger from 'firebase-functions/logger'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import cors from 'cors'
import { Device, Lead } from './types'
import {
  hasExternalId,
  validateContactLead,
  validateCreateLead,
  validatePurchaseLead,
  validateUpdateTimestampParams,
  valiedateUpdateLeadPhone,
  validateUpdateLeanFn,
} from './validation'
import { DEVICE_EXPECTED_VALUE, sendMetaEvent } from './meta'
import { generateExternalId } from './utils'

initializeApp()

const db = getFirestore('xtool-read')
const corsHandler = cors({ origin: true })

const metaPixelId = defineSecret('META_PIXEL_ID')
const metaAccessToken = defineSecret('META_ACCESS_TOKEN')

setGlobalOptions({ maxInstances: 10 })

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

      const createdAt =
        typeof input.createdAt === 'number' && input.createdAt > 0
          ? input.createdAt
          : Date.now()

      const digitsOnlyPhone = input.ph.replace(/\D/g, '')

      const leadData: Omit<Lead, 'id'> = {
        createdAt,
        utm_campaign: input.utm_campaign ?? '',
        utm_medium: input.utm_medium ?? '',
        utm_source: input.utm_source ?? '',
        ip: input.ip ?? '',
        fbc: input.fbc ?? '',
        fbp: input.fbp ?? '',
        user_agent: input.user_agent ?? '',
        fn: input.fn ?? '',
        ph: digitsOnlyPhone,
        device: input.device,
        price: 0,
        purchasedAt: 0,
        state: input.state,
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
// contactLead
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

        const { id } = validationRes.data

        const docRef = db.collection('lead').doc(id)
        const snapshot = await docRef.get()

        if (!snapshot.exists) {
          response.status(404).send({ error: 'lead not found' })
          return
        }

        const lead = snapshot.data() as Omit<Lead, 'id'>

        if (lead.state !== 'new') {
          response.status(409).send({ error: `lead is already ${lead.state}` })
          return
        }

        if (!lead.ph) {
          response.status(400).send({ error: 'lead has no ph to contact' })
          return
        }

        const hasEid = hasExternalId(lead)

        if (!hasEid) lead.externalId = generateExternalId(lead.ph)

        const capiResult = await sendMetaEvent({
          pixelId: metaPixelId.value(),
          accessToken: metaAccessToken.value(),
          eventName: 'Contact',
          lead,
          customData: {
            currency: 'KRW',
            value: DEVICE_EXPECTED_VALUE[lead.device],
          },
          eventTimeMs: lead.createdAt,
        })

        if (!capiResult.ok) {
          response
            .status(502)
            .send({ error: 'Meta CAPI 전송 실패', detail: capiResult.result })
          return
        }

        await docRef.update({
          state: 'contacted',
          externalId: lead.externalId ?? '',
        })

        response.status(200).send({
          id: snapshot.id,
          ...lead,
          state: 'contacted',
        })
      } catch (error) {
        logger.error('contactLead 처리 실패:', error)
        response.status(500).send({ error: '서버 오류' })
      }
    })
  },
)

// ────────────────────────────────
// purchaseLead
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

        const { id, price, purchasedAt } = validationRes.data

        const docRef = db.collection('lead').doc(id)
        const snapshot = await docRef.get()

        if (!snapshot.exists) {
          response.status(404).send({ error: 'lead not found' })
          return
        }

        const lead = snapshot.data() as Omit<Lead, 'id'>

        if (lead.state === 'purchased') {
          response.status(409).send({
            error: `lead must not be purchase state`,
          })
          return
        }

        const hasEid = hasExternalId(lead)

        if (!hasEid) lead.externalId = generateExternalId(lead.ph)

        const capiResult = await sendMetaEvent({
          pixelId: metaPixelId.value(),
          accessToken: metaAccessToken.value(),
          eventName: 'Purchase',
          lead,
          customData: { currency: 'KRW', value: price },
          eventTimeMs: purchasedAt,
        })

        if (!capiResult.ok) {
          response
            .status(502)
            .send({ error: 'Meta CAPI 전송 실패', detail: capiResult.result })
          return
        }

        await docRef.update({
          state: 'purchased',
          price,
          purchasedAt: purchasedAt,
          externalId: lead.externalId,
        })

        response.status(200).send({
          id: snapshot.id,
          ...lead,
          state: 'purchased',
          price,
          purchasedAt: purchasedAt,
        })
      } catch (error) {
        logger.error('purchaseLead 처리 실패:', error)
        response.status(500).send({ error: '서버 오류' })
      }
    })
  },
)

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

      const validationRes = validateUpdateLeanFn(request.body)

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
// updateLeadDevice
// ────────────────────────────────
export const updateLeadDevice = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const { id, device } = request.body as { id?: string; device?: string }

      if (!id || typeof id !== 'string') {
        response.status(400).send({ error: 'id is required' })
        return
      }

      if (!device || typeof device !== 'string') {
        response.status(400).send({ error: 'device is required' })
        return
      }

      if (!Device.includes(device as Device)) {
        response
          .status(400)
          .send({ error: `device must be one of: ${Device.join(', ')}` })
        return
      }

      const docRef = db.collection('lead').doc(id)
      const snapshot = await docRef.get()

      if (!snapshot.exists) {
        response.status(404).send({ error: 'lead not found' })
        return
      }

      await docRef.update({ device })

      const lead = snapshot.data() as Omit<Lead, 'id'>

      logger.info('리드 디바이스 수정 완료:', id, device)

      response.status(200).send({
        id: snapshot.id,
        ...lead,
        device,
      })
    } catch (error) {
      logger.error('updateLeadDevice 처리 실패:', error)
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

      const { id } = request.body as { id?: string }

      if (!id || typeof id !== 'string') {
        response.status(400).send({ error: 'id is required' })
        return
      }

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
// updateLeadPrice
// ────────────────────────────────
export const updateLeadPrice = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const { id, price } = request.body as { id?: string; price?: number }

      if (!id || typeof id !== 'string') {
        response.status(400).send({ error: 'id is required' })
        return
      }

      if (typeof price !== 'number') {
        response
          .status(400)
          .send({ error: 'price must be a non-negative number' })
        return
      }

      const docRef = db.collection('lead').doc(id)
      const snapshot = await docRef.get()

      if (!snapshot.exists) {
        response.status(404).send({ error: 'lead not found' })
        return
      }

      await docRef.update({ price })

      const lead = snapshot.data() as Omit<Lead, 'id'>

      logger.info('리드 가격 수정 완료:', id, price)

      response.status(200).send({
        id: snapshot.id,
        ...lead,
        price,
      })
    } catch (error) {
      logger.error('updateLeadPrice 처리 실패:', error)
      response.status(500).send({ error: '서버 오류' })
    }
  })
})

// ────────────────────────────────
// updateLeadTimestamp - createdAt, purchasedAt
// ────────────────────────────────
export const updateLeadTimestamp = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const validationRes = validateUpdateTimestampParams(request.body)

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
