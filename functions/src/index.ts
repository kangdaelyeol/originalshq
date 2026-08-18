import { setGlobalOptions } from 'firebase-functions'
import { onRequest } from 'firebase-functions/https'
import * as logger from 'firebase-functions/logger'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import cors from 'cors'
import { CreateLeadInput, Device, Lead } from './types'
import { validateLeadCreationBody, DEVICE_VALUES } from './validation'
import { DEVICE_EXPECTED_VALUE, sendMetaEvent } from './meta'

initializeApp()

const db = getFirestore('xtool-read')
const corsHandler = cors({ origin: true })

const metaPixelId = defineSecret('META_PIXEL_ID')
const metaAccessToken = defineSecret('META_ACCESS_TOKEN')

setGlobalOptions({ maxInstances: 10 })

// ────────────────────────────────
// createLead
// ────────────────────────────────
const CREATE_LEAD_REQUIRED_FIELDS = [
  'utm_campaign',
  'utm_medium',
  'utm_source',
  'ip',
  'fbc',
  'fbp',
  'user_agent',
  'fn',
  'ph',
  'device',
]

export const createLead = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const validationError = validateLeadCreationBody(
        request.body,
        CREATE_LEAD_REQUIRED_FIELDS,
      )
      if (validationError) {
        response.status(400).send({ error: validationError })
        return
      }

      const input = request.body as CreateLeadInput
      const digitsOnlyPhone = input.ph.replace(/\D/g, '')

      if (!digitsOnlyPhone) {
        response.status(400).send({ error: 'ph must contain digits' })
        return
      }

      const now = Date.now()

      const leadData: Omit<Lead, 'id'> = {
        createdAt: now,
        utm_campaign: input.utm_campaign,
        utm_medium: input.utm_medium,
        utm_source: input.utm_source,
        ip: input.ip,
        fbc: input.fbc,
        fbp: input.fbp,
        user_agent: input.user_agent,
        fn: input.fn,
        ph: digitsOnlyPhone,
        device: input.device,
        price: 0,
        purchasedAt: 0,
        state: 'new',
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
// createLeadWithoutContact
// ────────────────────────────────
const CREATE_LEAD_WITHOUT_CONTACT_REQUIRED_FIELDS = [
  'utm_campaign',
  'utm_medium',
  'utm_source',
  'ip',
  'fbc',
  'fbp',
  'user_agent',
  'device',
]

export const createLeadWithoutContact = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const validationError = validateLeadCreationBody(
        request.body,
        CREATE_LEAD_WITHOUT_CONTACT_REQUIRED_FIELDS,
      )
      if (validationError) {
        response.status(400).send({ error: validationError })
        return
      }

      const input = request.body as Omit<CreateLeadInput, 'fn' | 'ph'>
      const now = Date.now()

      const leadData: Omit<Lead, 'id'> = {
        createdAt: now,
        utm_campaign: input.utm_campaign,
        utm_medium: input.utm_medium,
        utm_source: input.utm_source,
        ip: input.ip,
        fbc: input.fbc,
        fbp: input.fbp,
        user_agent: input.user_agent,
        fn: '',
        ph: '',
        device: input.device,
        price: 0,
        purchasedAt: 0,
        state: 'new',
      }

      const docRef = await db.collection('lead').add(leadData)
      logger.info('리드(연락처 미포함) 생성 완료:', docRef.id)

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

        const lead = snapshot.data() as Omit<Lead, 'id'>

        if (lead.state !== 'new') {
          response.status(409).send({ error: `lead is already ${lead.state}` })
          return
        }

        if (!lead.fn || !lead.ph) {
          response.status(400).send({ error: 'lead has no fn/ph to contact' })
          return
        }

        const capiResult = await sendMetaEvent({
          pixelId: metaPixelId.value(),
          accessToken: metaAccessToken.value(),
          eventName: 'Contact',
          lead,
          customData: {
            currency: 'KRW',
            value: DEVICE_EXPECTED_VALUE[lead.device],
          },
        })

        if (!capiResult.ok) {
          response
            .status(502)
            .send({ error: 'Meta CAPI 전송 실패', detail: capiResult.result })
          return
        }

        await docRef.update({ state: 'contacted' })

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

        const { id, price } = request.body as { id?: string; price?: number }

        if (!id || typeof id !== 'string') {
          response.status(400).send({ error: 'id is required' })
          return
        }

        if (typeof price !== 'number' || price <= 0) {
          response
            .status(400)
            .send({ error: 'price must be a positive number' })
          return
        }

        const docRef = db.collection('lead').doc(id)
        const snapshot = await docRef.get()

        if (!snapshot.exists) {
          response.status(404).send({ error: 'lead not found' })
          return
        }

        const lead = snapshot.data() as Omit<Lead, 'id'>

        if (lead.state !== 'contacted') {
          response.status(409).send({
            error: `lead must be contacted first (current: ${lead.state})`,
          })
          return
        }

        const capiResult = await sendMetaEvent({
          pixelId: metaPixelId.value(),
          accessToken: metaAccessToken.value(),
          eventName: 'Purchase',
          lead,
          customData: { currency: 'KRW', value: price },
        })

        if (!capiResult.ok) {
          response
            .status(502)
            .send({ error: 'Meta CAPI 전송 실패', detail: capiResult.result })
          return
        }

        const purchasedAt = Date.now()

        await docRef.update({ state: 'purchased', price, purchasedAt })

        response.status(200).send({
          id: snapshot.id,
          ...lead,
          state: 'purchased',
          price,
          purchasedAt,
        })
      } catch (error) {
        logger.error('purchaseLead 처리 실패:', error)
        response.status(500).send({ error: '서버 오류' })
      }
    })
  },
)

export const updateLeadContact = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const { id, fn, ph } = request.body as {
        id?: string
        fn?: string
        ph?: string
      }

      if (!id || typeof id !== 'string') {
        response.status(400).send({ error: 'id is required' })
        return
      }

      const hasFn = typeof fn === 'string' && fn !== ''
      const hasPh = typeof ph === 'string' && ph !== ''

      if (!hasFn && !hasPh) {
        response.status(400).send({ error: 'fn or ph is required' })
        return
      }

      const docRef = db.collection('lead').doc(id)
      const snapshot = await docRef.get()

      if (!snapshot.exists) {
        response.status(404).send({ error: 'lead not found' })
        return
      }

      const updateData: Partial<Pick<Lead, 'fn' | 'ph'>> = {}

      if (hasFn) {
        updateData.fn = fn as string
      }

      if (hasPh) {
        const digitsOnlyPhone = (ph as string).replace(/\D/g, '')

        if (!digitsOnlyPhone) {
          response.status(400).send({ error: 'ph must contain digits' })
          return
        }

        updateData.ph = digitsOnlyPhone
      }

      await docRef.update(updateData)

      const lead = snapshot.data() as Omit<Lead, 'id'>

      logger.info('리드 연락처 수정 완료:', id, updateData)

      response.status(200).send({
        id: snapshot.id,
        ...lead,
        ...updateData,
      })
    } catch (error) {
      logger.error('updateLeadContact 처리 실패:', error)
      response.status(500).send({ error: '서버 오류' })
    }
  })
})

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

      if (!DEVICE_VALUES.includes(device as Device)) {
        response
          .status(400)
          .send({ error: `device must be one of: ${DEVICE_VALUES.join(', ')}` })
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
